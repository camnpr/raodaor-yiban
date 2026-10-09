import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import type { AppConfig } from './common/config/configuration';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  // rawBody: true —— IDStack webhook 需按「原始 body 字节」验签（M4 支付核销，见 billing.controller）
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService<AppConfig, true>);

  // 统一前缀 /api/v1（PRD §6.3）
  app.setGlobalPrefix('api/v1');

  // 响应 SIGTERM/SIGINT（PM2 restart / 发版优雅退出）
  app.enableShutdownHooks();

  // IIS ARR 反代场景下取真实 IP
  app.getHttpAdapter().getInstance().set('trust proxy', true);

  app.enableCors({
    origin: config.get('cors.allowOrigins', { infer: true }),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = config.get('port', { infer: true });
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`[raodaor-yiban] backend listening on :${port} (${process.env.NODE_ENV ?? 'development'})`);
}

void bootstrap();
