import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** 存活探针：始终 200；db 字段反映数据库连通性（IIS/PM2 探活用） */
  @Get()
  async check(): Promise<{
    status: 'ok';
    service: string;
    env: string;
    db: 'up' | 'down';
    uptime: number;
    timestamp: string;
  }> {
    let db: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }
    return {
      status: 'ok',
      service: 'raodaor-yiban-backend',
      env: process.env.NODE_ENV ?? 'development',
      db,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
