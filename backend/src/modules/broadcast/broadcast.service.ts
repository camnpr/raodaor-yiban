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
 * 时段按 Asia/Shanghai 时区比较；投递经 raodaor-message（category=benefit）。
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

  /** 调度器调用：向所有「到点且今日未播」的会员推送天气播报（FR-M4）。返回本轮回推人数。 */
  async processDueBroadcasts(): Promise<number> {
    const hhmm = shanghaiHHmm();
    const startToday = startOfTodayShanghai();
    const due = await this.prisma.user.findMany({
      where: {
        timedBroadcastEnabled: true,
        timedBroadcastTime: hhmm,
        OR: [{ timedBroadcastLastSent: null }, { timedBroadcastLastSent: { lt: startToday } }],
      },
      select: { id: true, idstackUserId: true },
    });
    if (!due.length) return 0;

    let sent = 0;
    for (const u of due) {
      // 先落今日已发送，避免重启/并发在同一分钟重复投递
      await this.prisma.user
        .update({ where: { id: u.id }, data: { timedBroadcastLastSent: new Date() } })
        .catch(() => undefined);

      try {
        const city = await this.prisma.favoriteCity.findFirst({
          where: { userId: u.id, isDefault: true },
        });
        if (!city || city.lat == null || city.lng == null) continue;

        const [now, aqi] = await Promise.all([
          this.weather.getNow(city.lng, city.lat),
          this.weather.getAirQuality(city.lng, city.lat),
        ]);
        const summary = buildSummary(city.name, now, aqi);
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

/** 当前 Asia/Shanghai 的 HH:mm（24 小时制，去前导空格） */
function shanghaiHHmm(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date())
    .replace(/\s/g, '');
}

/** 当前 Asia/Shanghai 日期 00:00 对应的 UTC 时刻（用于「今日是否已播」判定） */
function startOfTodayShanghai(): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return new Date(`${ymd}T00:00:00+08:00`);
}

/** 组装适老口语化播报文案 */
function buildSummary(cityName: string | null, now: WeatherNow, aqi: AirQuality | null): string {
  const parts = [`${cityName ?? '您所在城市'}今天${now.text}`];
  parts.push(`气温 ${now.temp} 度，体感 ${now.feelsLike} 度`);
  parts.push(`湿度 ${now.humidity}%`);
  if (aqi && aqi.aqi) parts.push(`空气质量 ${aqi.category}（AQI ${aqi.aqi}）`);
  return parts.join('，') + '。';
}
