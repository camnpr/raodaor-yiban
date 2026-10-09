import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { AppConfig } from '../../common/config/configuration';
import { BillingModule } from '../billing/billing.module';
import { AuthController } from './auth.controller';
import { IdStackWebhookController } from './idstack-webhook.controller';
import { AuthService } from './auth.service';
import { WebhookService } from './webhook.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    BillingModule,
    // global：JwtAuthGuard 在各业务模块复用，JwtService 必须全局可见
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        secret: config.get('jwt.accessSecret', { infer: true }),
        signOptions: { expiresIn: config.get('jwt.accessTtl', { infer: true }) },
      }),
    }),
  ],
  controllers: [AuthController, IdStackWebhookController],
  providers: [AuthService, WebhookService, JwtAuthGuard],
})
export class AuthModule {}
