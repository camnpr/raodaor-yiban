import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../common/config/configuration';

export interface IdstackOrderCreateResult {
  orderId: string;
  orderNo: string;
  externalOrderId: string | null;
  voucher: { shareToken?: string; shareUrl?: string } | null;
  payUrl: string | null;
}

/**
 * IDStack 后端 API 客户端（仅支付相关）：创建支付订单 / 查单。
 * 严格对齐 SnapCompress 的对接契约（Bearer = 用户 IDStack access_token）。
 * 下单时透传 `external_order_id`，webhook 核销时据此回查本地订单 —— 这是会员状态能同步的关键。
 */
@Injectable()
export class IdstackApiClient {
  private readonly logger = new Logger(IdstackApiClient.name);

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  private get apiBase(): string {
    return this.config.get('idstack.apiBaseUrl', { infer: true }).replace(/\/+$/, '');
  }

  private get origin(): string {
    return this.config.get('idstack.baseUrl', { infer: true }).replace(/\/+$/, '');
  }

  private async fetchWithCause(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (error) {
      const cause = (error as Error & { cause?: { code?: string } })?.cause?.code;
      throw new Error(
        `IDStack API 请求失败（${url}）${cause ? `：${cause}` : `：${error instanceof Error ? error.message : String(error)}`}`,
      );
    }
  }

  /**
   * 创建 IDStack 支付订单（Bearer = 用户 IDStack access_token）。
   * 透传 external_order_id，保证 webhook 能回查落地。
   */
  async createPaymentOrder(
    accessToken: string,
    body: {
      businessType: 'membership';
      businessId: string;
      amount: number;
      currency: string;
      externalOrderId: string;
      paymentChannel?: string;
    },
  ): Promise<IdstackOrderCreateResult> {
    const res = await this.fetchWithCause(`${this.apiBase}/payment/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        business_type: body.businessType,
        business_id: body.businessId,
        amount: body.amount,
        currency: body.currency,
        external_order_id: body.externalOrderId,
        payment_channel: body.paymentChannel ?? 'qr',
      }),
    });
    const json = (await res.json().catch(() => null)) as
      | {
          success?: boolean;
          message?: string;
          data?: {
            order_id?: string;
            order_no?: string;
            external_order_id?: string | null;
            voucher?: { share_token?: string; share_url?: string } | null;
          };
        }
      | null;
    if (!res.ok || !json?.data?.order_id) {
      this.logger.warn(`[IDStack] 下单失败: HTTP ${res.status} ${json?.message ?? ''}`);
      throw new Error(json?.message ?? `下单失败（HTTP ${res.status}）`);
    }
    const voucher = json.data.voucher ?? null;
    const payUrl =
      voucher?.share_url ??
      (voucher?.share_token ? `${this.origin}/pay?token=${voucher.share_token}` : null);
    return {
      orderId: json.data.order_id,
      orderNo: json.data.order_no ?? '',
      externalOrderId: json.data.external_order_id ?? null,
      voucher,
      payUrl,
    };
  }

  /** 查询 IDStack 订单状态（兜底对账，webhook 未达时使用） */
  async getPaymentOrder(accessToken: string, idstackOrderId: string): Promise<{ status: string } | null> {
    const res = await this.fetchWithCause(`${this.apiBase}/payment/orders/${idstackOrderId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 404) return null;
    const json = (await res.json().catch(() => null)) as
      | { success?: boolean; data?: { status?: string } }
      | null;
    if (!res.ok || !json?.success || !json.data) return null;
    return { status: json.data.status ?? 'pending' };
  }
}
