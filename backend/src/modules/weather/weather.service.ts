import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../common/config/configuration';
import { BusinessException } from '../../common/exceptions/business.exception';
import { QWeatherProvider } from './qweather.provider';
import type {
  AirQuality,
  CityResult,
  DailyItem,
  HourlyItem,
  WeatherAlert,
  WeatherNow,
} from './weather.types';

/**
 * 天气服务：配置校验 + 短期 TTL 缓存 + 委托 Provider。
 * 缓存按「方法:lon,lat」键控，应对数据源限流与降级（不因数据源故障阻塞核心链路）。
 */
@Injectable()
export class WeatherService {
  private readonly cache = new Map<string, { at: number; value: unknown }>();

  constructor(
    private readonly provider: QWeatherProvider,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private assertConfigured(): void {
    if (!this.config.get('weather.qweatherKey', { infer: true })) {
      throw new BusinessException(
        3001,
        '天气数据源未配置（QWEATHER_API_KEY）',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private async cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < ttlSeconds * 1000) return hit.value as T;
    const value = await load();
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  private ttl(which: 'now' | 'hourly' | 'daily' | 'alerts'): number {
    const map = {
      now: 'cacheTtlNow',
      hourly: 'cacheTtlHourly',
      daily: 'cacheTtlDaily',
      alerts: 'cacheTtlAlerts',
    } as const;
    return this.config.get(`weather.${map[which]}`, { infer: true });
  }

  getNow(lon: number, lat: number): Promise<WeatherNow> {
    this.assertConfigured();
    return this.cached(`now:${lon},${lat}`, this.ttl('now'), () => this.provider.getNow({ lon, lat }));
  }

  getHourly(lon: number, lat: number): Promise<HourlyItem[]> {
    this.assertConfigured();
    return this.cached(`hourly:${lon},${lat}`, this.ttl('hourly'), () => this.provider.getHourly({ lon, lat }));
  }

  getDaily(lon: number, lat: number): Promise<DailyItem[]> {
    this.assertConfigured();
    return this.cached(`daily:${lon},${lat}`, this.ttl('daily'), () => this.provider.getDaily({ lon, lat }));
  }

  getAlerts(lon: number, lat: number): Promise<WeatherAlert[]> {
    this.assertConfigured();
    return this.cached(`alerts:${lon},${lat}`, this.ttl('alerts'), () => this.provider.getAlerts({ lon, lat }));
  }

  getAirQuality(lon: number, lat: number): Promise<AirQuality | null> {
    this.assertConfigured();
    return this.cached(`aqi:${lon},${lat}`, this.ttl('now'), () => this.provider.getAirQuality({ lon, lat }));
  }

  async searchCity(keyword: string): Promise<CityResult[]> {
    this.assertConfigured();
    return this.provider.searchCity(keyword);
  }
}
