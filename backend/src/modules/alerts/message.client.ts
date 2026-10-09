import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../common/config/configuration';

export interface NotificationInput {
  /** IDStack 用户主键（message 据此投递到对应账号） */
  idstackUserId: string;
  category: 'system' | 'benefit' | 'order' | 'interaction' | 'app';
  title: string;
  summary: string;
  level: 'A' | 'B' | 'C';
  link?: string;
}

/**
 * RaoDaor Message 入站投递客户端（PRD §5.2 / SDK docs）：
 * POST /api/v1/internal/notifications + X-Raodaor-Message-Inbound-Key。
 * 推送失败不影响预警巡检主流程（仅记录日志）。
 */
@Injectable()
export class MessageClient {
  private readonly logger = new Logger(MessageClient.name);

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  async send(input: NotificationInput): Promise<void> {
    const inboundKey = this.config.get('message.inboundKey', { infer: true });
    if (!inboundKey) {
      this.logger.warn('RAODAOR_MESSAGE_INBOUND_KEY 未配置，跳过预警推送');
      return;
    }
    const baseUrl = this.config.get('message.baseUrl', { infer: true });
    try {
      const res = await fetch(`${baseUrl}/api/v1/internal/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Raodaor-Message-Inbound-Key': inboundKey },
        body: JSON.stringify({ event: 'notification.create', data: input }),
      });
      if (!res.ok) {
        this.logger.error(`预警推送响应异常：HTTP ${res.status}`);
      }
    } catch (error) {
      this.logger.error(
        `预警推送失败（idstackUserId=${input.idstackUserId}）：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
