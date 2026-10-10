import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import type { AppConfig } from '../../common/config/configuration';
import { TIER_PRICES } from '../membership/membership.service';
import { IdstackApiClient } from './idstack-api.client';
import type { CreateCheckoutDto } from './dto/create-checkout.dto';

export interface CheckoutVo {
  externalOrderId: string;
  tierCode: string;
  amount: string;
  currency: string;
  /** IDStack 支付页链接（服务端下单后返回）；null 时前端回退到旧版 URL 跳转 */
  payUrl: string | null;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly idstack: IdstackApiClient,
  ) {}

  /**
   * 创建会员购买意图（FR-M1）+ 服务端代下单 IDStack（对齐 SnapCompress 契约）：
   * 透传 external_order_id，webhook 核销时据此回查落地；返回 payUrl 给前端拉起支付。
   * 无 IDStack token 时回退到旧版「前端直达 payment/create URL」方式（仍带 externalOrderId）。
   */
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

    const vo: CheckoutVo = {
      externalOrderId: session.externalOrderId,
      tierCode: session.targetPlan ?? dto.tierCode,
      amount: session.amount,
      currency: session.currency,
      payUrl: null,
    };

    // 服务端代下单：以用户 IDStack token 调 /payment/orders，external_order_id 保证 webhook 可回查
    if (dto.idstackAccessToken) {
      try {
        const idstack = this.config.get('idstack', { infer: true });
        const businessId = idstack.planBusinessIds[dto.tierCode] ?? dto.tierCode;
        const order = await this.idstack.createPaymentOrder(dto.idstackAccessToken, {
          businessType: 'membership',
          businessId,
          amount: Number(price.amount),
          currency: price.currency,
          externalOrderId,
          paymentChannel: 'qr',
        });
        await this.prisma.checkoutSession.update({
          where: { id: session.id },
          data: { idstackOrderId: order.orderId },
        });
        vo.payUrl = order.payUrl;
        this.logger.log(`IDStack 代下单成功：externalOrderId=${externalOrderId} orderId=${order.orderId}`);
      } catch (err) {
        // 下单失败不应阻断意图创建（前端可回退到旧版 URL 跳转）；记录便于排查
        this.logger.warn(`IDStack 代下单失败，回退 URL 跳转：${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return vo;
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
