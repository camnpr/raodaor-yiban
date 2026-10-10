import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../common/config/configuration';
import { BroadcastService } from './broadcast.service';

/**
 * 每日定时播报调度（FR-M4）：进程内 setInterval 轮询（沿用生态无 Redis 单进程方案，
 * 与 AlertInspector 一致），到点调用 BroadcastService 投递天气播报。
 */
@Injectable()
export class BroadcastSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BroadcastSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly broadcast: BroadcastService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  onModuleInit(): void {
    const intervalMs = this.config.get('broadcast.intervalSeconds', { infer: true }) * 1000;
    this.timer = setInterval(() => {
      void this.tick().catch((err) =>
        this.logger.error(`定时播报调度异常：${err instanceof Error ? err.message : String(err)}`),
      );
    }, intervalMs);
    this.logger.log(`每日定时播报调度已启动，周期 ${intervalMs / 1000}s`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** 手动触发一轮（运维/测试用），与定时任务互斥 */
  async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      return await this.broadcast.processDueBroadcasts();
    } finally {
      this.running = false;
    }
  }
}
