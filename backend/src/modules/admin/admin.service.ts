import { Injectable, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign } from 'node:crypto';
import { CareStatus, CheckoutStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MembershipService } from '../membership/membership.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { pageSkip, paged, type Paged } from '../../common/dto/page-query.dto';
import type { UsersQueryDto, CareQueryDto, OrdersQueryDto, AuditQueryDto } from './dto/queries.dto';
import type { UpdateBenefitDto } from './dto/update-benefit.dto';
import type { AppConfig } from '../../common/config/configuration';

export interface UserLite {
  id: string;
  displayName: string;
  locale: string;
  membershipTier: string | null;
  membershipExpiresAt: Date | null;
  createdAt: Date;
}

export interface UserDetail extends UserLite {
  timezone: string;
  careCount: number;
  cityCount: number;
  elderProfile: { birthYear: number | null; cityName: string | null; note: string | null } | null;
}

/**
 * 运营后台数据服务（PRD §8 / Phase 1）。
 * 只读聚合与列表；高危写操作（补单、权益映射）下沉到 MembershipService 或保持 owner 专属。
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** 概览：用户数 / 亲情关系数 / 预警事件量 / 活跃会员数 / 会员营收（已核销订单金额汇总） */
  async overview() {
    const [users, careRelations, alertEvents, activeMembers, verified] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.careRelationship.count(),
      this.prisma.weatherAlertRecord.count(),
      this.prisma.user.count({ where: { deletedAt: null, membershipExpiresAt: { gt: new Date() } } }),
      this.prisma.checkoutSession.findMany({ where: { status: 'VERIFIED' }, select: { amount: true } }),
    ]);
    const membershipRevenue = verified.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
    return { users, careRelations, alertEvents, activeMembers, membershipRevenue };
  }

  async listUsers(query: UsersQueryDto): Promise<Paged<UserLite>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.UserWhereInput = { deletedAt: null };
    const q = query.q?.trim();
    if (q) {
      where.OR = [
        { displayName: { contains: q } },
        { idstackUserId: { contains: q } },
        { id: q },
      ];
    }
    const [total, items] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: pageSkip(page, pageSize),
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          displayName: true,
          locale: true,
          membershipTier: true,
          membershipExpiresAt: true,
          createdAt: true,
        },
      }),
    ]);
    return paged(items, total, page, pageSize);
  }

  async getUser(id: string): Promise<UserDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        displayName: true,
        locale: true,
        membershipTier: true,
        membershipExpiresAt: true,
        createdAt: true,
        timezone: true,
      },
    });
    if (!user) {
      throw new BusinessException(2001, '用户不存在', HttpStatus.NOT_FOUND);
    }
    const [careCount, cityCount, elderProfile] = await Promise.all([
      this.prisma.careRelationship.count({
        where: { OR: [{ elderUserId: id }, { guardianUserId: id }] },
      }),
      this.prisma.favoriteCity.count({ where: { userId: id } }),
      this.prisma.elderProfile.findUnique({
        where: { userId: id },
        select: { birthYear: true, cityName: true, note: true },
      }),
    ]);
    return { ...user, careCount, cityCount, elderProfile };
  }

  async listCareRelations(query: CareQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.CareRelationshipWhereInput = {};
    if (query.status) where.status = query.status as CareStatus;
    if (query.elderUserId) where.elderUserId = query.elderUserId;
    if (query.guardianUserId) where.guardianUserId = query.guardianUserId;
    const [total, items] = await Promise.all([
      this.prisma.careRelationship.count({ where }),
      this.prisma.careRelationship.findMany({
        where,
        skip: pageSkip(page, pageSize),
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          elder: { select: { displayName: true } },
          guardian: { select: { displayName: true } },
        },
      }),
    ]);
    return paged(items, total, page, pageSize);
  }

  async listOrders(query: OrdersQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.CheckoutSessionWhereInput = {};
    if (query.status) where.status = query.status as CheckoutStatus;
    const [total, items] = await Promise.all([
      this.prisma.checkoutSession.count({ where }),
      this.prisma.checkoutSession.findMany({
        where,
        skip: pageSkip(page, pageSize),
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          externalOrderId: true,
          subjectType: true,
          subjectId: true,
          targetPlan: true,
          amount: true,
          currency: true,
          status: true,
          grantedAt: true,
          createdAt: true,
        },
      }),
    ]);
    return paged(items, total, page, pageSize);
  }

  /** 权益映射（FR-M3）：复用会员模块的阶梯读取 */
  async getBenefits() {
    return this.membership.getPlans();
  }

  async updateBenefit(tierCode: string, dto: UpdateBenefitDto) {
    return this.membership.updateBenefit(tierCode, dto);
  }

  async listAuditLogs(query: AuditQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.AuditLogWhereInput = {};
    if (query.action) where.action = { contains: query.action };
    if (query.actorId) where.actorId = query.actorId;
    if (query.targetType) where.targetType = query.targetType;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }
    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip: pageSkip(page, pageSize),
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          actorId: true,
          action: true,
          targetType: true,
          targetId: true,
          detail: true,
          createdAt: true,
        },
      }),
    ]);
    return paged(items, total, page, pageSize);
  }

  /**
   * 预警事件大屏嵌入描述（PRD §6.5）：返回 DataCanvas 大屏地址 + 嵌入令牌。
   * 嵌入令牌为 RS256（≤600s），仅在配置了 DATACANVAS_EMBED_PRIVATE_KEY 时签发；
   * 未配置密钥时返回 signed=false 与空令牌，由前端降级展示「大屏未配置」。
   */
  async getAlertEmbed(operatorId: string) {
    const cfg = this.config.get('datacanvas', { infer: true });
    const privateKey = process.env.DATACANVAS_EMBED_PRIVATE_KEY;
    let token: string | null = null;
    if (privateKey && privateKey.trim()) {
      const header = JSON.stringify({ alg: 'RS256', typ: 'JWT' });
      const payload = JSON.stringify({
        sub: operatorId,
        iss: 'raodaor-yiban',
        exp: Math.floor(Date.now() / 1000) + 600,
      });
      const signingInput = `${base64url(header)}.${base64url(payload)}`;
      const signature = createSign('RSA-SHA256').update(signingInput).sign(privateKey, 'base64url');
      token = `${signingInput}.${signature}`;
    }
    const sep = cfg.baseUrl.includes('?') ? '&' : '?';
    const embedUrl = `${cfg.baseUrl}${sep}token=${encodeURIComponent(token ?? '')}`;
    return { embedUrl, apiKey: cfg.apiKey, signed: Boolean(token) };
  }
}

/** 无依赖的 base64url 编码（Header / Payload 仅 ASCII JSON） */
function base64url(input: string): string {
  return Buffer.from(input, 'utf-8').toString('base64url');
}
