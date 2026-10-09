import { Module } from '@nestjs/common';
import { CareController } from './care.controller';
import { CareService } from './care.service';
import { WeatherModule } from '../weather/weather.module';

@Module({
  imports: [WeatherModule],
  controllers: [CareController],
  providers: [CareService],
  exports: [CareService],
})
export class CareModule {}
