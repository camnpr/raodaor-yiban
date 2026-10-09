/** 天气领域 VO（Provider 响应统一归一化后的内部模型，与具体数据源解耦） */

export interface WeatherNow {
  /** 温度（℃） */
  temp: string;
  /** 体感温度（℃） */
  feelsLike: string;
  /** 天气图标码（QWeather icon，前端映射到图标） */
  icon: string;
  /** 天气现象文案 */
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
  /** 降水概率（%） */
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

/** 气象灾害预警（红/橙/黄/蓝四级，映射自 QWeather severity） */
export interface WeatherAlert {
  id: string;
  sender: string;
  title: string;
  text: string;
  /** 预警类型编码（如 11B01 暴雨） */
  type: string;
  /** Minor=蓝 / Moderate=黄 / Severe=橙 / Extreme=红 */
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
