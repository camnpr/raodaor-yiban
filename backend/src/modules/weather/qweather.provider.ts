import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../common/config/configuration';
import { BusinessException } from '../../common/exceptions/business.exception';
import type { WeatherProvider, WeatherLocation } from './weather-provider.interface';
import type {
  AirQuality,
  CityResult,
  DailyItem,
  HourlyItem,
  WeatherAlert,
  WeatherNow,
} from './weather.types';

/**
 * 和风天气（QWeather）实现（国内主数据源）。
 * 端点与字段以 QWeather 官方 v7 文档为准；API Key 仅存后端（`?key=` 查询参数）。
 */

interface QWeatherEnvelope<T> {
  code: string;
  now?: T;
  hourly?: T[];
  daily?: T[];
  warning?: T[];
  location?: T[];
}

interface RawNow {
  obsTime: string;
  temp: string;
  feelsLike: string;
  icon: string;
  text: string;
  windDir: string;
  windScale: string;
  humidity: string;
  precip: string;
  pressure: string;
  vis: string;
}

interface RawHourly {
  fxTime: string;
  temp: string;
  icon: string;
  text: string;
  pop: string;
  windDir: string;
  windScale: string;
}

interface RawDaily {
  fxDate: string;
  tempMax: string;
  tempMin: string;
  iconDay: string;
  textDay: string;
  textNight: string;
  windDirDay: string;
  windScaleDay: string;
  humidity: string;
  precip: string;
  uvIndex: string;
  sunrise: string;
  sunset: string;
}

interface RawWarning {
  id: string;
  sender: string;
  title: string;
  text: string;
  type: string;
  severity: string;
  severityColor: string;
  pubTime: string;
  startTime: string;
  endTime: string;
}

interface RawAirNow {
  aqi: string;
  level: string;
  category: string;
  primary: string;
  pm10: string;
  pm2p5: string;
  no2: string;
  so2: string;
  co: string;
  o3: string;
}

interface RawCity {
  id: string;
  name: string;
  adm1: string;
  adm2: string;
  lat: string;
  lon: string;
}

@Injectable()
export class QWeatherProvider implements WeatherProvider {
  readonly name = 'qweather';
  private readonly logger = new Logger(QWeatherProvider.name);

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  private get host(): string {
    return this.config.get('weather.qweatherHost', { infer: true });
  }

  private get key(): string {
    return this.config.get('weather.qweatherKey', { infer: true });
  }

  /** 通用 GET（weather/warning/air 类：location 用 lon,lat + key） */
  private async get<T>(path: string, location: WeatherLocation): Promise<QWeatherEnvelope<T>> {
    const url = new URL(`${this.host}${path}`);
    url.searchParams.set('location', `${location.lon.toFixed(2)},${location.lat.toFixed(2)}`);
    url.searchParams.set('key', this.key);

    const res = await fetch(url.toString());
    const json = (await res.json().catch(() => null)) as QWeatherEnvelope<T> | null;
    if (!res.ok || !json || json.code !== '200') {
      this.logger.warn(`QWeather ${path} 失败: HTTP ${res.status} code=${json?.code ?? 'unknown'}`);
      throw new BusinessException(3001, '天气数据源不可用，请稍后重试', HttpStatus.BAD_GATEWAY);
    }
    return json;
  }

  async getNow(location: WeatherLocation): Promise<WeatherNow> {
    const { now } = await this.get<RawNow>('/v7/weather/now', location);
    if (!now) throw new BusinessException(3001, '天气数据缺失', HttpStatus.BAD_GATEWAY);
    return {
      temp: now.temp,
      feelsLike: now.feelsLike,
      icon: now.icon,
      text: now.text,
      windDir: now.windDir,
      windScale: now.windScale,
      humidity: now.humidity,
      precip: now.precip,
      pressure: now.pressure,
      vis: now.vis,
      obsTime: now.obsTime,
    };
  }

  async getHourly(location: WeatherLocation): Promise<HourlyItem[]> {
    const { hourly } = await this.get<RawHourly>('/v7/weather/24h', location);
    return (hourly ?? []).map((h) => ({
      fxTime: h.fxTime,
      temp: h.temp,
      icon: h.icon,
      text: h.text,
      pop: h.pop,
      windDir: h.windDir,
      windScale: h.windScale,
    }));
  }

  async getDaily(location: WeatherLocation): Promise<DailyItem[]> {
    const { daily } = await this.get<RawDaily>('/v7/weather/15d', location);
    return (daily ?? []).map((d) => ({
      fxDate: d.fxDate,
      tempMax: d.tempMax,
      tempMin: d.tempMin,
      iconDay: d.iconDay,
      textDay: d.textDay,
      textNight: d.textNight,
      windDirDay: d.windDirDay,
      windScaleDay: d.windScaleDay,
      humidity: d.humidity,
      precip: d.precip,
      uvIndex: d.uvIndex,
      sunrise: d.sunrise,
      sunset: d.sunset,
    }));
  }

  async getAlerts(location: WeatherLocation): Promise<WeatherAlert[]> {
    const { warning } = await this.get<RawWarning>('/v7/warning/now', location);
    return (warning ?? []).map((w) => ({
      id: w.id,
      sender: w.sender,
      title: w.title,
      text: w.text,
      type: w.type,
      severity: w.severity,
      severityColor: w.severityColor,
      pubTime: w.pubTime,
      startTime: w.startTime,
      endTime: w.endTime,
    }));
  }

  async getAirQuality(location: WeatherLocation): Promise<AirQuality | null> {
    const { now } = await this.get<RawAirNow>('/v7/air/now', location);
    if (!now || now.aqi === undefined) return null;
    return {
      aqi: now.aqi,
      level: now.level,
      category: now.category,
      primary: now.primary,
      pm10: now.pm10,
      pm2p5: now.pm2p5,
      no2: now.no2,
      so2: now.so2,
      co: now.co,
      o3: now.o3,
    };
  }

  async searchCity(keyword: string): Promise<CityResult[]> {
    const url = new URL(`${this.host}/geo/v2/city/lookup`);
    url.searchParams.set('location', keyword);
    url.searchParams.set('key', this.key);
    url.searchParams.set('range', 'cn');

    const res = await fetch(url.toString());
    const json = (await res.json().catch(() => null)) as QWeatherEnvelope<RawCity> | null;
    if (!res.ok || !json || json.code !== '200') {
      throw new BusinessException(3001, '城市搜索不可用，请稍后重试', HttpStatus.BAD_GATEWAY);
    }
    return (json.location ?? []).map((c) => ({
      cityId: c.id,
      name: c.name,
      adm1: c.adm1,
      adm2: c.adm2,
      lat: Number(c.lat),
      lon: Number(c.lon),
    }));
  }
}
