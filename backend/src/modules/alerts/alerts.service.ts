import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UpdateSubscriptionDto } from './dto/update-subscription.dto';

/**
 * 极端天气预警订阅（FR-A3）：存储用户预警级别阈值与免打扰时段。
 * 预警巡检 + 推送在 M3（亲情守护）实现，本模块仅维护订阅配置。
 */
@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  getSubscription(userId: string) {
    return this.prisma.alertSubscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsertSubscription(userId: string, dto: UpdateSubscriptionDto) {
    const existing = await this.prisma.alertSubscription.findFirst({ where: { userId } });
    if (existing) {
      return this.prisma.alertSubscription.update({
        where: { id: existing.id },
        data: { ...dto },
      });
    }
    return this.prisma.alertSubscription.create({
      data: { userId, ...dto },
    });
  }
}
