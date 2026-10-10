import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { BusinessException } from '../../common/exceptions/business.exception';
import { WeatherService } from './weather.service';
import { LocationQueryDto, SearchCityQueryDto } from './dto/weather-query.dto';
import type {
  AirQuality,
  CityResult,
  DailyItem,
  HourlyItem,
  LifeIndex,
  WeatherAlert,
  WeatherNow,
} from './weather.types';

/**
 * 天气公开接口（FR-G5：游客可浏览，免登录；由网关/全局限流兜底）。
 */
@Controller('weather')
export class WeatherController {
  constructor(private readonly weather: WeatherService) {}

  private parseLocation(q: LocationQueryDto): { lon: number; lat: number } {
    const lon = Number(q.lon);
    const lat = Number(q.lat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90) {
      throw new BusinessException(1001, '无效的坐标参数', HttpStatus.BAD_REQUEST);
    }
    return { lon, lat };
  }

  @Get('now')
  now(@Query() q: LocationQueryDto): Promise<WeatherNow> {
    const { lon, lat } = this.parseLocation(q);
    return this.weather.getNow(lon, lat);
  }

  @Get('hourly')
  hourly(@Query() q: LocationQueryDto): Promise<HourlyItem[]> {
    const { lon, lat } = this.parseLocation(q);
    return this.weather.getHourly(lon, lat);
  }

  @Get('daily')
  daily(@Query() q: LocationQueryDto): Promise<DailyItem[]> {
    const { lon, lat } = this.parseLocation(q);
    return this.weather.getDaily(lon, lat);
  }

  @Get('alerts')
  alerts(@Query() q: LocationQueryDto): Promise<WeatherAlert[]> {
    const { lon, lat } = this.parseLocation(q);
    return this.weather.getAlerts(lon, lat);
  }

  @Get('air-quality')
  airQuality(@Query() q: LocationQueryDto): Promise<AirQuality | null> {
    const { lon, lat } = this.parseLocation(q);
    return this.weather.getAirQuality(lon, lat);
  }

  @Get('search-city')
  searchCity(@Query() q: SearchCityQueryDto): Promise<CityResult[]> {
    return this.weather.searchCity(q.keyword);
  }

  @Get('indices')
  indices(@Query() q: LocationQueryDto): Promise<LifeIndex[]> {
    const { lon, lat } = this.parseLocation(q);
    return this.weather.getIndices(lon, lat);
  }
}
