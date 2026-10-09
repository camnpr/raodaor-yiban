import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertInspectorService } from './alert-inspector.service';
import { MessageClient } from './message.client';
import { WeatherModule } from '../weather/weather.module';

@Module({
  imports: [WeatherModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertInspectorService, MessageClient],
  exports: [AlertsService, AlertInspectorService],
})
export class AlertsModule {}
