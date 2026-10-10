import { apiFetch } from './api';

/** 天气领域类型（与后端 weather.types.ts 对齐） */

export interface WeatherNow {
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
  obsTime: string;
}

export interface HourlyItem {
  fxTime: string;
  temp: string;
  icon: string;
  text: string;
  pop: string;
  windDir: string;
  windScale: string;
}

export interface DailyItem {
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

export interface WeatherAlert {
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

export interface AirQuality {
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

export interface CityResult {
  cityId: string;
  name: string;
  adm1: string;
  adm2: string;
  lat: number;
  lon: number;
}

/** 生活指数（FR-W5）：type 为数据源类型编码；name/category/text 由数据源直接给出（中文） */
export interface LifeIndex {
  /** 指数类型编码（QWeather type：1=运动 2=洗车 3=穿衣 5=紫外线 8=舒适度 9=感冒） */
  type: string;
  /** 指数名称（如 穿衣指数） */
  name: string;
  /** 等级数字（1-5） */
  level: string;
  /** 等级名称（如 较舒适、适宜） */
  category: string;
  /** 适老 / 详细建议文案 */
  text: string;
}

export interface FavoriteCity {
  id: string;
  cityId: string;
  name: string;
  adminDiv: string | null;
  lat: number;
  lng: number;
  isDefault: boolean;
  sortOrder: number;
}

export interface AlertSubscription {
  id: string;
  cityId: string | null;
  minLevel: string | null;
  quietStart: string | null;
  quietEnd: string | null;
  enabled: boolean;
}

// ---------- 天气（公开接口，游客可浏览） ----------

export function fetchWeatherNow(lon: number, lat: number): Promise<WeatherNow> {
  return apiFetch<WeatherNow>(`/weather/now?lon=${lon}&lat=${lat}`);
}

export function fetchHourly(lon: number, lat: number): Promise<HourlyItem[]> {
  return apiFetch<HourlyItem[]>(`/weather/hourly?lon=${lon}&lat=${lat}`);
}

export function fetchDaily(lon: number, lat: number): Promise<DailyItem[]> {
  return apiFetch<DailyItem[]>(`/weather/daily?lon=${lon}&lat=${lat}`);
}

export function fetchAlerts(lon: number, lat: number): Promise<WeatherAlert[]> {
  return apiFetch<WeatherAlert[]>(`/weather/alerts?lon=${lon}&lat=${lat}`);
}

export function fetchAirQuality(lon: number, lat: number): Promise<AirQuality | null> {
  return apiFetch<AirQuality | null>(`/weather/air-quality?lon=${lon}&lat=${lat}`);
}

export function searchCity(keyword: string): Promise<CityResult[]> {
  return apiFetch<CityResult[]>(`/weather/search-city?keyword=${encodeURIComponent(keyword)}`);
}

export function fetchLifeIndices(lon: number, lat: number): Promise<LifeIndex[]> {
  return apiFetch<LifeIndex[]>(`/weather/indices?lon=${lon}&lat=${lat}`);
}

// ---------- 城市收藏（需登录） ----------

export function fetchCities(): Promise<FavoriteCity[]> {
  return apiFetch<FavoriteCity[]>('/cities');
}

export function addCity(dto: { cityId: string; name: string; adminDiv?: string; lat: number; lng: number }): Promise<FavoriteCity> {
  return apiFetch<FavoriteCity>('/cities', { method: 'POST', body: JSON.stringify(dto) });
}

export function setDefaultCity(id: string): Promise<FavoriteCity[]> {
  return apiFetch<FavoriteCity[]>(`/cities/${id}/default`, { method: 'PATCH' });
}

export function removeCity(id: string): Promise<FavoriteCity[]> {
  return apiFetch<FavoriteCity[]>(`/cities/${id}`, { method: 'DELETE' });
}

// ---------- 预警订阅（需登录） ----------

export function fetchSubscription(): Promise<AlertSubscription | null> {
  return apiFetch<AlertSubscription | null>('/alerts/subscription');
}

export function updateSubscription(dto: Partial<AlertSubscription>): Promise<AlertSubscription> {
  return apiFetch<AlertSubscription>('/alerts/subscription', { method: 'PUT', body: JSON.stringify(dto) });
}
