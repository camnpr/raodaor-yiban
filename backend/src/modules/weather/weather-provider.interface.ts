import type {
  AirQuality,
  CityResult,
  DailyItem,
  HourlyItem,
  LifeIndex,
  WeatherAlert,
  WeatherNow,
} from './weather.types';

export interface WeatherLocation {
  lon: number;
  lat: number;
}

/**
 * 天气数据源抽象（PRD §6.4）：
 * 国内走 QWeather，出海（V1.2）走 OpenWeatherMap——响应统一归一化为 weather.types.ts 的 VO。
 * 新增数据源只需实现本接口并挂到 provider 路由。
 */
export interface WeatherProvider {
  readonly name: string;
  getNow(location: WeatherLocation): Promise<WeatherNow>;
  getHourly(location: WeatherLocation): Promise<HourlyItem[]>;
  getDaily(location: WeatherLocation): Promise<DailyItem[]>;
  getAlerts(location: WeatherLocation): Promise<WeatherAlert[]>;
  getAirQuality(location: WeatherLocation): Promise<AirQuality | null>;
  getIndices(location: WeatherLocation): Promise<LifeIndex[]>;
  searchCity(keyword: string): Promise<CityResult[]>;
}
