import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { IdstackApiClient } from './idstack-api.client';

@Module({
  controllers: [BillingController],
  providers: [BillingService, IdstackApiClient],
  exports: [BillingService],
})
export class BillingModule {}
