import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { TIER_PRICES } from '../membership/membership.service';
import type { CreateCheckoutDto } from './dto/create-checkout.dto';

export interface CheckoutVo {
  externalOrderId: string;
  tierCode: string;
  amount: string;
  currency: string;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 创建会员购买意图（FR-M1）：本地落 checkout_sessions，金额以服务端权威价为准（覆盖前端传入，防篡改） */
  async createCheckout(userId: string, dto: CreateCheckoutDto): Promise<CheckoutVo> {
    const price = TIER_PRICES[dto.tierCode] ?? TIER_PRICES.free;
    const externalOrderId = `mem_${randomUUID()}`;
    const session = await this.prisma.checkoutSession.create({
      data: {
        externalOrderId,
        subjectType: 'user',
        subjectId: userId,
        targetPlan: dto.tierCode,
        amount: price.amount,
        currency: price.currency,
        status: 'PENDING',
      },
    });
    return {
      externalOrderId: session.externalOrderId,
      tierCode: session.targetPlan ?? dto.tierCode,
      amount: session.amount,
      currency: session.currency,
    };
  }

  /** 当前用户的购买意图列表（FR-M1 订单查询） */
  async listOrders(userId: string) {
    return this.prisma.checkoutSession.findMany({
      where: { subjectType: 'user', subjectId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        externalOrderId: true,
        targetPlan: true,
        amount: true,
        currency: true,
        status: true,
        idstackOrderId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /** 按 externalOrderId 取意图（webhook 反查，FR-M2） */
  async findByExternalId(externalOrderId: string) {
    if (!externalOrderId) return null;
    return this.prisma.checkoutSession.findUnique({ where: { externalOrderId } });
  }

  /** 标记意图为已核销并落地会员（事务，FR-M2） */
  async markVerified(sessionId: string, idstackOrderId: string, userId: string, tierCode: string, expiresAt: Date | null) {
    try {
      await this.prisma.$transaction([
        this.prisma.checkoutSession.update({
          where: { id: sessionId },
          data: { status: 'VERIFIED', idstackOrderId },
        }),
        this.prisma.user.update({
          where: { id: userId },
          data: { membershipTier: tierCode, membershipExpiresAt: expiresAt },
        }),
      ]);
    } catch (error) {
      throw new BusinessException(5006, `核销落地失败：${error instanceof Error ? error.message : String(error)}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
