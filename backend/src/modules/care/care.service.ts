import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { WeatherService } from '../weather/weather.service';
import { MembershipService } from '../membership/membership.service';
import type {
  AirQuality,
  DailyItem,
  HourlyItem,
  WeatherAlert,
  WeatherNow,
} from '../weather/weather.types';

/** 亲情守护关系错误码（PRD 附录 B：4xxx） */
const ERR = {
  INVALID_CODE: 4001,
  ALREADY_BOUND: 4002,
  RELATION_NOT_FOUND: 4003,
  CANNOT_SELF_BIND: 4004,
  CODE_USED: 4005,
} as const;

const INVITE_CODE_TTL_MS = 24 * 60 * 60 * 1000;
const INVITE_CODE_LEN = 8;

function randomInviteCode(len: number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去除易混淆字符
  let out = '';
  for (let i = 0; i < len; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export interface RelationshipVo {
  id: string;
  role: 'guardian' | 'elder';
  counterpartId: string;
  counterpartName: string;
  status: string;
  invitedAt: Date;
  acceptedAt: Date | null;
}

export interface ElderSummaryVo {
  elderId: string;
  displayName: string;
  cityName: string | null;
  hasCity: boolean;
  now: WeatherNow | null;
  alertCount: number;
}

export interface ElderWeatherVo {
  elder: { id: string; displayName: string };
  city: { name: string; lat: number; lng: number } | null;
  now: WeatherNow | null;
  hourly: HourlyItem[];
  daily: DailyItem[];
  alerts: WeatherAlert[];
  aqi: AirQuality | null;
}

export interface ElderProfileVo {
  birthYear: number | null;
  cityId: string | null;
  cityName: string | null;
  note: string | null;
}

@Injectable()
export class CareService {
  private readonly logger = new Logger(CareService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly weather: WeatherService,
    private readonly membership: MembershipService,
  ) {}

  // ---------- 绑定关系 ----------

  /** 守护人生成邀请码（FR-C1） */
  async createInvite(guardianUserId: string) {
    let code = '';
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = randomInviteCode(INVITE_CODE_LEN);
      const existing = await this.prisma.careInvite.findUnique({ where: { code: candidate } });
      if (!existing) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      throw new BusinessException(4006, '邀请码生成失败，请重试', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const invite = await this.prisma.careInvite.create({
      data: {
        code,
        guardianUserId,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + INVITE_CODE_TTL_MS),
      },
    });

    // 过期邀请码惰性清理（避免无限增长）
    void this.prisma.careInvite
      .deleteMany({ where: { status: 'ACTIVE', expiresAt: { lt: new Date() } } })
      .catch(() => undefined);

    return { code: invite.code, expiresAt: invite.expiresAt };
  }

  /** 长辈凭邀请码确认绑定（FR-C1） */
  async acceptInvite(elderUserId: string, code: string): Promise<RelationshipVo> {
    const invite = await this.prisma.careInvite.findUnique({ where: { code } });
    if (!invite || invite.status !== 'ACTIVE') {
      throw new BusinessException(ERR.INVALID_CODE, '邀请码无效或已失效', HttpStatus.BAD_REQUEST);
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      await this.prisma.careInvite
        .update({ where: { code }, data: { status: 'EXPIRED' } })
        .catch(() => undefined);
      throw new BusinessException(ERR.INVALID_CODE, '邀请码已过期', HttpStatus.BAD_REQUEST);
    }
    if (invite.guardianUserId === elderUserId) {
      throw new BusinessException(ERR.CANNOT_SELF_BIND, '不能绑定自己', HttpStatus.BAD_REQUEST);
    }

    // 幂等：已存在关系直接返回，避免重复入库
    const existing = await this.prisma.careRelationship.findUnique({
      where: { elderUserId_guardianUserId: { elderUserId, guardianUserId: invite.guardianUserId } },
    });
    if (existing) {
      await this.prisma.careInvite
        .update({ where: { code }, data: { status: 'USED' } })
        .catch(() => undefined);
      throw new BusinessException(ERR.ALREADY_BOUND, '已与该家人建立守护关系', HttpStatus.CONFLICT);
    }

    // FR-C5 亲情绑定数量上限：免费 1 位长辈，会员提升（按守护人当前等级权益）
    const guardian = await this.prisma.user.findUnique({
      where: { id: invite.guardianUserId },
      select: { membershipTier: true },
    });
    const benefit = await this.membership.getEffectiveBenefit(guardian?.membershipTier ?? null);
    const boundCount = await this.prisma.careRelationship.count({
      where: { guardianUserId: invite.guardianUserId, status: 'ACTIVE' },
    });
    if (boundCount >= benefit.careLimit) {
      throw new BusinessException(
        5005,
        '绑定长辈数量已达当前会员等级上限，请升级会员解锁更多亲情守护',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const relation = await this.prisma.careRelationship.create({
      data: {
        elderUserId,
        guardianUserId: invite.guardianUserId,
        status: 'ACTIVE',
        acceptedAt: new Date(),
      },
    });
    const full = await this.prisma.careRelationship.findUnique({
      where: { id: relation.id },
      include: { elder: true, guardian: true },
    });
    await this.prisma.careInvite
      .update({ where: { code }, data: { status: 'USED' } })
      .catch(() => undefined);

    // 长辈接受绑定后确保存在轻量档案
    await this.prisma.elderProfile.upsert({
      where: { userId: elderUserId },
      create: { userId: elderUserId },
      update: {},
    });

    await this.audit(elderUserId, 'care.bind', invite.guardianUserId, relation.id);
    this.logger.log(`亲情绑定建立：elder=${elderUserId} guardian=${invite.guardianUserId}`);

    return this.toVo(full!, elderUserId);
  }

  /** 当前用户的关系列表（区分自己是守护人还是长辈，FR-C2 / FR-C4） */
  async listRelationships(userId: string): Promise<RelationshipVo[]> {
    const relations = await this.prisma.careRelationship.findMany({
      where: { OR: [{ elderUserId: userId }, { guardianUserId: userId }] },
      include: { elder: true, guardian: true },
      orderBy: { updatedAt: 'desc' },
    });
    return relations.map((r) => this.toVo(r, userId));
  }

  /** 解除绑定（双方均可发起，FR-C1） */
  async removeRelationship(userId: string, id: string): Promise<{ ok: true }> {
    const relation = await this.prisma.careRelationship.findUnique({ where: { id } });
    if (!relation) {
      throw new BusinessException(ERR.RELATION_NOT_FOUND, '关系不存在', HttpStatus.NOT_FOUND);
    }
    if (relation.elderUserId !== userId && relation.guardianUserId !== userId) {
      throw new BusinessException(ERR.RELATION_NOT_FOUND, '无权操作该关系', HttpStatus.FORBIDDEN);
    }
    await this.prisma.careRelationship.delete({ where: { id } });
    await this.audit(userId, 'care.unbind', relation.elderUserId, id);
    this.logger.log(`亲情绑定解除：relation=${id} by=${userId}`);
    return { ok: true };
  }

  // ---------- 守护中心（子女端） ----------

  /** 守护人视角：所有绑定长辈 + 城市天气摘要（FR-C2） */
  async listElders(guardianUserId: string): Promise<ElderSummaryVo[]> {
    const relations = await this.prisma.careRelationship.findMany({
      where: { guardianUserId, status: 'ACTIVE' },
      include: { elder: true },
      orderBy: { createdAt: 'asc' },
    });

    const result: ElderSummaryVo[] = [];
    for (const r of relations) {
      const elder = r.elder;
      const city = await this.prisma.favoriteCity.findFirst({
        where: { userId: elder.id, isDefault: true },
      });
      let now: WeatherNow | null = null;
      let alertCount = 0;
      if (city && city.lat != null && city.lng != null) {
        try {
          const [nowWeather, alerts] = await Promise.all([
            this.weather.getNow(city.lng, city.lat),
            this.weather.getAlerts(city.lng, city.lat),
          ]);
          now = nowWeather;
          alertCount = alerts.length;
        } catch {
          // 数据源未配置或拉取失败：降级为无天气（守护中心仍可展示家人列表）
        }
      }
      result.push({
        elderId: elder.id,
        displayName: elder.displayName,
        cityName: city?.name ?? null,
        hasCity: Boolean(city),
        now,
        alertCount,
      });
    }
    return result;
  }

  /** 长辈详情（子女端）：长辈城市实时天气 + 逐小时 + 15 天 + 预警 + AQI（FR-C3） */
  async getElderWeather(guardianUserId: string, elderId: string): Promise<ElderWeatherVo> {
    const relation = await this.prisma.careRelationship.findFirst({
      where: { guardianUserId, elderUserId: elderId, status: 'ACTIVE' },
    });
    if (!relation) {
      throw new BusinessException(ERR.RELATION_NOT_FOUND, '未绑定该长辈或无权限', HttpStatus.NOT_FOUND);
    }
    const elder = await this.prisma.user.findUnique({ where: { id: elderId } });
    const city = await this.prisma.favoriteCity.findFirst({
      where: { userId: elderId, isDefault: true },
    });

    const vo: ElderWeatherVo = {
      elder: { id: elderId, displayName: elder?.displayName ?? '长辈' },
      city: city && city.lat != null && city.lng != null ? { name: city.name, lat: city.lat, lng: city.lng } : null,
      now: null,
      hourly: [],
      daily: [],
      alerts: [],
      aqi: null,
    };
    if (!vo.city) return vo;

    try {
      const [now, hourly, daily, alerts, aqi] = await Promise.all([
        this.weather.getNow(vo.city.lng, vo.city.lat),
        this.weather.getHourly(vo.city.lng, vo.city.lat),
        this.weather.getDaily(vo.city.lng, vo.city.lat),
        this.weather.getAlerts(vo.city.lng, vo.city.lat),
        this.weather.getAirQuality(vo.city.lng, vo.city.lat),
      ]);
      vo.now = now;
      vo.hourly = hourly;
      vo.daily = daily;
      vo.alerts = alerts;
      vo.aqi = aqi;
    } catch {
      // 天气数据源不可用时返回空天气，前端展示降级提示
    }
    return vo;
  }

  // ---------- 长辈档案（FR-C4） ----------

  async getProfile(userId: string): Promise<ElderProfileVo> {
    const profile = await this.prisma.elderProfile.findUnique({ where: { userId } });
    return {
      birthYear: profile?.birthYear ?? null,
      cityId: profile?.cityId ?? null,
      cityName: profile?.cityName ?? null,
      note: profile?.note ?? null,
    };
  }

  async updateProfile(userId: string, dto: { birthYear?: number; cityId?: string; cityName?: string; note?: string }) {
    const profile = await this.prisma.elderProfile.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto },
    });
    return {
      birthYear: profile.birthYear,
      cityId: profile.cityId,
      cityName: profile.cityName,
      note: profile.note,
    };
  }

  // ---------- 工具 ----------

  private toVo(r: { id: string; elderUserId: string; guardianUserId: string; status: string; invitedAt: Date; acceptedAt: Date | null; elder: { displayName: string }; guardian: { displayName: string } }, userId: string): RelationshipVo {
    const isGuardian = r.guardianUserId === userId;
    return {
      id: r.id,
      role: isGuardian ? 'guardian' : 'elder',
      counterpartId: isGuardian ? r.elderUserId : r.guardianUserId,
      counterpartName: isGuardian ? r.elder.displayName : r.guardian.displayName,
      status: r.status,
      invitedAt: r.invitedAt,
      acceptedAt: r.acceptedAt,
    };
  }

  private async audit(actorId: string, action: string, targetId: string | null, relationId: string) {
    await this.prisma.auditLog
      .create({
        data: { actorId, action, targetType: 'care_relationship', targetId: relationId, detail: targetId ? `counterpart=${targetId}` : null },
      })
      .catch(() => undefined);
  }
}
