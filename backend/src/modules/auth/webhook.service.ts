import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { verify as cryptoVerify } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../common/config/configuration';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { resolveJwksUri, selectPublicKey } from './idstack-jwks';

interface WebhookPayload {
  event?: string;
  externalOrderId?: string;
  businessType?: string;
  tierCode?: string;
  planCode?: string;
  orderId?: string;
  periodStart?: string;
  periodEnd?: string;
  billingCycle?: string;
}

/** IDStack webhook 消费（FR-M2）：RS256 验签 + 时间窗 + eventId 去重，落地会员核销 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  /** 单实例进程内 eventId 去重（PM2 单实例部署） */
  private readonly seen = new Map<string, number>();
  private readonly SEEN_TTL_MS = 10 * 60 * 1000;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  async handle(
    rawBody: Buffer,
    signatureHeader: string | undefined,
    timestamp: string | undefined,
    eventId: string | undefined,
  ): Promise<void> {
    if (!signatureHeader || !timestamp || !eventId) {
      throw new BusinessException(9006, '缺少 webhook 签名头', HttpStatus.UNAUTHORIZED);
    }
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
      throw new BusinessException(9007, 'webhook 时间戳超出窗口', HttpStatus.UNAUTHORIZED);
    }
    if (this.seen.has(eventId)) {
      this.logger.warn(`webhook eventId 重复，忽略：${eventId}`);
      return;
    }
    const ok = await this.verify(rawBody, signatureHeader, timestamp, eventId);
    if (!ok) {
      throw new BusinessException(9008, 'webhook 签名校验失败', HttpStatus.UNAUTHORIZED);
    }
    this.seen.set(eventId, Date.now());
    this.purgeSeen();

    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as WebhookPayload;
    } catch {
      throw new BusinessException(9009, 'webhook 消息体非法', HttpStatus.BAD_REQUEST);
    }
    if (payload.event !== 'payment.verified') return; // 仅处理核销事件
    await this.consumePaymentVerified(payload);
  }

  private async verify(
    rawBody: Buffer,
    signatureHeader: string,
    timestamp: string,
    eventId: string,
  ): Promise<boolean> {
    const params = parseSigHeader(signatureHeader);
    if (params.algorithm !== 'rs256' || !params.signature) return false;
    const idstack = this.config.get('idstack', { infer: true });
    const jwksUri = resolveJwksUri(idstack.jwksUri, idstack.apiBaseUrl);
    let pub: string;
    try {
      pub = await selectPublicKey(jwksUri, params.keyId);
    } catch (err) {
      this.logger.error(`JWKS 公钥获取失败：${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
    const signed = Buffer.concat([Buffer.from(`${timestamp}.${eventId}.`), rawBody]);
    try {
      return cryptoVerify('RSA-SHA256', signed, pub, Buffer.from(params.signature, 'base64url'));
    } catch {
      return false;
    }
  }

  private async consumePaymentVerified(payload: WebhookPayload): Promise<void> {
    const session = await this.billing.findByExternalId(payload.externalOrderId ?? '');
    if (!session) {
      this.logger.warn(`webhook 未知 externalOrderId：${payload.externalOrderId ?? '(空)'}`);
      return;
    }
    if (session.status === 'VERIFIED') {
      this.logger.warn(`webhook 订单已核销，幂等跳过：${session.externalOrderId}`);
      return;
    }
    const tierCode = payload.tierCode ?? session.targetPlan ?? 'premium';
    let expiresAt: Date | null = null;
    if (payload.periodEnd) expiresAt = new Date(payload.periodEnd);
    else if (payload.billingCycle) expiresAt = computeExpiry(payload.billingCycle);

    await this.billing.markVerified(session.id, payload.orderId ?? '', session.subjectId, tierCode, expiresAt);
    this.logger.log(`会员核销落地：externalOrderId=${session.externalOrderId} tier=${tierCode} expiresAt=${expiresAt?.toISOString() ?? '永久'}`);
  }

  private purgeSeen(): void {
    const now = Date.now();
    for (const [id, t] of this.seen) {
      if (now - t > this.SEEN_TTL_MS) this.seen.delete(id);
    }
  }
}

interface SigParams {
  keyId?: string;
  algorithm?: string;
  signature?: string;
}

function parseSigHeader(header: string): SigParams {
  const params: SigParams = {};
  for (const part of header.split(',')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const value = part.slice(idx + 1).trim();
    if (key === 'keyid') params.keyId = value;
    else if (key === 'algorithm') params.algorithm = value.toLowerCase();
    else if (key === 'signature') params.signature = value;
  }
  return params;
}

function computeExpiry(billingCycle?: string): Date | null {
  if (!billingCycle) return new Date(Date.now() + 30 * 86400_000);
  switch (billingCycle.toLowerCase()) {
    case 'lifetime':
    case 'forever':
    case '一次性':
      return null;
    case 'quarter':
    case '季':
      return new Date(Date.now() + 90 * 86400_000);
    case 'year':
    case '年':
      return new Date(Date.now() + 365 * 86400_000);
    case 'month':
    case '月':
    default:
      return new Date(Date.now() + 30 * 86400_000);
  }
}
