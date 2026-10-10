import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './common/config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { WeatherModule } from './modules/weather/weather.module';
import { CitiesModule } from './modules/cities/cities.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { CareModule } from './modules/care/care.module';
import { MembershipModule } from './modules/membership/membership.module';
import { BillingModule } from './modules/billing/billing.module';
import { AdminModule } from './modules/admin/admin.module';
import { BroadcastModule } from './modules/broadcast/broadcast.module';
import { AccountModule } from './modules/account/account.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // NODE_ENV 决定加载 .env.development / .env.production
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    WeatherModule,
    CitiesModule,
    AlertsModule,
    CareModule,
    MembershipModule,
    BillingModule,
    AdminModule,
    BroadcastModule,
    AccountModule,
  ],
})
export class AppModule {}
