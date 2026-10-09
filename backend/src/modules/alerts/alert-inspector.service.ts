import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../common/config/configuration';
import { PrismaService } from '../../prisma/prisma.service';
import { WeatherService } from '../weather/weather.service';
import type { WeatherAlert } from '../weather/weather.types';
import { MessageClient } from './message.client';

/**
 * 极端天气预警巡检（FR-A4 / FR-A5，PRD §6.6）：
 * 定时扫描所有「激活绑定关系」中长辈的默认城市预警 → 按 alertId+cityId 去重
 * → 推送给长辈与全部绑定守护人（raodaor-message）。
 *
 * 使用进程内 setInterval（沿用生态无 Redis 单进程方案，兼容目标部署环境），
 * 不引入 @nestjs/schedule 依赖；PM2 单实例部署下巡检唯一执行。
 */
@Injectable()
export class AlertInspectorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertInspectorService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly weather: WeatherService,
    private readonly message: MessageClient,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  onModuleInit(): void {
    const intervalMs = this.config.get('alert.inspectIntervalSeconds', { infer: true }) * 1000;
    this.timer = setInterval(() => {
      void this.tick().catch((err) => this.logger.error(`巡检异常：${err instanceof Error ? err.message : String(err)}`));
    }, intervalMs);
    this.logger.log(`极端天气预警巡检已启动，周期 ${intervalMs / 1000}s`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** 手动触发一轮（便于运维/测试），与定时任务互斥 */
  async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      return await this.inspect();
    } finally {
      this.running = false;
    }
  }

  private async inspect(): Promise<number> {
    const relations = await this.prisma.careRelationship.findMany({
      where: { status: 'ACTIVE' },
      select: { elderUserId: true, guardianUserId: true },
    });
    if (!relations.length) return 0;

    const elderIds = [...new Set(relations.map((r) => r.elderUserId))];
    let pushed = 0;

    for (const elderId of elderIds) {
      const city = await this.prisma.favoriteCity.findFirst({
        where: { userId: elderId, isDefault: true },
      });
      if (!city || city.lat == null || city.lng == null) continue;

      let alerts: WeatherAlert[];
      try {
        alerts = await this.weather.getAlerts(city.lng, city.lat);
      } catch (error) {
        this.logger.warn(`长辈 ${elderId} 城市预警拉取失败，跳过：${error instanceof Error ? error.message : String(error)}`);
        continue;
      }

      const party = relations.filter((r) => r.elderUserId === elderId);
      const recipientUserIds = [...new Set(party.flatMap((r) => [r.elderUserId, r.guardianUserId]))];

      for (const a of alerts) {
        const record = await this.prisma.weatherAlertRecord.upsert({
          where: { alertId_cityId: { alertId: a.id, cityId: city.cityId } },
          update: {
            title: a.title,
            content: a.text,
            level: a.severity,
            type: a.type,
            source: a.sender,
            startedAt: a.startTime ? new Date(a.startTime) : null,
            endedAt: a.endTime ? new Date(a.endTime) : null,
          },
          create: {
            alertId: a.id,
            cityId: city.cityId,
            type: a.type,
            level: a.severity,
            title: a.title,
            content: a.text,
            source: a.sender,
            startedAt: a.startTime ? new Date(a.startTime) : null,
            endedAt: a.endTime ? new Date(a.endTime) : null,
          },
        });

        // 已推送过（或本条记录在巡检前已存在）不再重复打扰（FR-A4 去重）
        if (record.pushedAt) continue;

        const users = await this.prisma.user.findMany({
          where: { id: { in: recipientUserIds } },
          select: { idstackUserId: true },
        });
        for (const u of users) {
          await this.message.send({
            idstackUserId: u.idstackUserId,
            category: 'system',
            title: `天气预警：${a.title}`,
            summary: (a.text ?? a.title).slice(0, 120),
            level: 'A',
            link: `rdm://yiban/guard/${elderId}`,
          });
        }

        await this.prisma.weatherAlertRecord.update({
          where: { id: record.id },
          data: { pushedAt: new Date() },
        });
        pushed += 1;
      }
    }
    return pushed;
  }
}
