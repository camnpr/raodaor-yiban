import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { MembershipService } from '../membership/membership.service';
import { WeatherService } from '../weather/weather.service';
import { MessageClient } from '../alerts/message.client';
import type { UpdateBroadcastSettingsDto } from './dto/update-broadcast-settings.dto';
import type { AirQuality, WeatherNow } from '../weather/weather.types';

export interface BroadcastSettings {
  enabled: boolean;
  time: string | null;
  /** 当前会员等级是否包含「每日定时播报」权益 */
  entitled: boolean;
}

/**
 * 每日定时播报（FR-M4）：设置读写 + 到点播报投递。
 * 时段按用户各自时区（User.timezone，默认 Asia/Shanghai）换算；投递经 raodaor-message（category=benefit）。
 */
@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly weather: WeatherService,
    private readonly message: MessageClient,
  ) {}

  async getSettings(userId: string): Promise<BroadcastSettings> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timedBroadcastEnabled: true, timedBroadcastTime: true, membershipTier: true },
    });
    const entitled = (await this.membership.getEffectiveBenefit(user?.membershipTier ?? null)).timedBroadcast;
    return {
      enabled: user?.timedBroadcastEnabled ?? false,
      time: user?.timedBroadcastTime ?? null,
      entitled,
    };
  }

  async updateSettings(userId: string, dto: UpdateBroadcastSettingsDto): Promise<BroadcastSettings> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { membershipTier: true },
    });
    const entitled = (await this.membership.getEffectiveBenefit(user?.membershipTier ?? null)).timedBroadcast;
    if (dto.enabled && !entitled) {
      throw new BusinessException(4021, '当前会员等级不包含「每日定时播报」权益', HttpStatus.PAYMENT_REQUIRED);
    }
    if (dto.enabled && !dto.time) {
      throw new BusinessException(4022, '开启定时播报需先设置播报时段', HttpStatus.BAD_REQUEST);
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        timedBroadcastEnabled: dto.enabled,
        timedBroadcastTime: dto.enabled ? dto.time ?? null : null,
      },
      select: { timedBroadcastEnabled: true, timedBroadcastTime: true, membershipTier: true },
    });
    return {
      enabled: updated.timedBroadcastEnabled,
      time: updated.timedBroadcastTime,
      entitled,
    };
  }

  /** 调度器调用：向所有「到点且今日未播」的会员推送天气播报（FR-M4）。时段按用户各自时区换算。返回本轮回推人数。 */
  async processDueBroadcasts(): Promise<number> {
    const now = new Date();
    const candidates = await this.prisma.user.findMany({
      where: { timedBroadcastEnabled: true, timedBroadcastTime: { not: null } },
      select: {
        id: true,
        idstackUserId: true,
        timedBroadcastTime: true,
        timezone: true,
        timedBroadcastLastSent: true,
      },
    });
    if (!candidates.length) return 0;

    let sent = 0;
    for (const u of candidates) {
      const tz = u.timezone || 'Asia/Shanghai';
      if (u.timedBroadcastTime !== hhmmIn(tz, now)) continue;
      // 幂等：同一用户在其时区内当日已播过则跳过
      if (u.timedBroadcastLastSent && ymdIn(tz, u.timedBroadcastLastSent) === ymdIn(tz, now)) continue;

      // 先落今日已发送，避免重启/并发在同一分钟重复投递
      await this.prisma.user
        .update({ where: { id: u.id }, data: { timedBroadcastLastSent: now } })
        .catch(() => undefined);

      try {
        const city = await this.prisma.favoriteCity.findFirst({
          where: { userId: u.id, isDefault: true },
        });
        if (!city || city.lat == null || city.lng == null) continue;

        const [wNow, aqi] = await Promise.all([
          this.weather.getNow(city.lng, city.lat),
          this.weather.getAirQuality(city.lng, city.lat),
        ]);
        const summary = buildSummary(city.name, wNow, aqi);
        await this.message.send({
          idstackUserId: u.idstackUserId,
          category: 'benefit',
          title: '每日天气播报',
          summary,
          level: 'A',
          link: 'rdm://yiban/home',
        });
        sent += 1;
      } catch (err) {
        this.logger.warn(`定时播报投递失败 user=${u.id}：${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return sent;
  }
}

/** 指定时区下的 HH:mm（24 小时制，去前导空格）；非法时区回退 Asia/Shanghai */
function hhmmIn(tz: string, at: Date): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })
      .format(at)
      .replace(/\s/g, '');
  } catch {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false })
      .format(at)
      .replace(/\s/g, '');
  }
}

/** 指定时区下的本地日期 YYYY-MM-DD（用于「当日是否已播」判定）；非法时区回退 Asia/Shanghai */
function ymdIn(tz: string, at: Date): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  }
}

/** 组装适老口语化播报文案 */
function buildSummary(cityName: string | null, now: WeatherNow, aqi: AirQuality | null): string {
  const parts = [`${cityName ?? '您所在城市'}今天${now.text}`];
  parts.push(`气温 ${now.temp} 度，体感 ${now.feelsLike} 度`);
  parts.push(`湿度 ${now.humidity}%`);
  if (aqi && aqi.aqi) parts.push(`空气质量 ${aqi.category}（AQI ${aqi.aqi}）`);
  return parts.join('，') + '。';
}
