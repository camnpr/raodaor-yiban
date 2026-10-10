import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 账号合规（PRD §4.6 / §7.2 / FR-G9）：
 * - 语言偏好持久化（PUT /account/locale）
 * - 账号注销（DELETE /account/deactivate）：软删 + 个人数据匿名化 + 解除亲情关系
 */
@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  /** 更新语言偏好（仅本人） */
  async updateLocale(userId: string, locale: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { locale },
      select: { id: true, locale: true },
    });
  }

  /**
   * 注销账号：在事务内清理个人数据并匿名化。
   * - 解除全部亲情关系（CareRelationship）
   * - 删除长辈档案、城市收藏、预警订阅（最小必要清理）
   * - 用户标记 deletedAt、展示名匿名化、清空头像
   * - 写入审计日志
   */
  async deactivate(userId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.careRelationship.deleteMany({
        where: { OR: [{ elderUserId: userId }, { guardianUserId: userId }] },
      });
      await tx.elderProfile.deleteMany({ where: { userId } });
      await tx.favoriteCity.deleteMany({ where: { userId } });
      await tx.alertSubscription.deleteMany({ where: { userId } });

      await tx.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          displayName: '已注销用户',
          avatarFileId: null,
          locale: 'zh-CN',
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'account.deactivate',
          targetType: 'user',
          targetId: userId,
          detail: '用户主动注销账号，个人数据已匿名化',
        },
      });
    });

    return { id: userId, deletedAt: true };
  }
}
