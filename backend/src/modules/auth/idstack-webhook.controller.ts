import { Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { WebhookService } from './webhook.service';

/**
 * IDStack webhook 入口（FR-M2）：RS256 验签 + 核销落地会员。
 * 单独 controller（不带 JwtAuthGuard），因 webhook 靠签名鉴权而非 JWT。
 */
@Controller('auth')
export class IdStackWebhookController {
  constructor(private readonly webhook: WebhookService) {}

  @Post('idstack-webhook')
  async handle(@Req() req: Request) {
    const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      return { success: false, error: 'missing raw body' };
    }
    await this.webhook.handle(
      rawBody,
      req.header('x-idstack-signature'),
      req.header('x-idstack-timestamp'),
      req.header('x-idstack-event-id'),
    );
    return { success: true };
  }
}
