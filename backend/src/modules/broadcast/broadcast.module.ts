import { Module } from '@nestjs/common';
import { BroadcastController } from './broadcast.controller';
import { BroadcastService } from './broadcast.service';
import { BroadcastSchedulerService } from './broadcast-scheduler.service';
import { WeatherModule } from '../weather/weather.module';
import { MembershipModule } from '../membership/membership.module';
import { MessageClient } from '../alerts/message.client';

@Module({
  imports: [WeatherModule, MembershipModule],
  controllers: [BroadcastController],
  providers: [BroadcastService, BroadcastSchedulerService, MessageClient],
  exports: [BroadcastService],
})
export class BroadcastModule {}
