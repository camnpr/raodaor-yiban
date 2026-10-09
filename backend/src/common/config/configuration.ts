/**
 * 类型化配置（@nestjs/config load 工厂）。
 * 密钥类字段不设默认值，缺省为空串——缺失时由对应模块在调用点显式报错。
 */

function toNumber(raw: string | undefined): number {
  return Number(raw);
}

function toList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  cors: { allowOrigins: string[] };
  jwt: { accessSecret: string; accessTtl: string; refreshTtl: string };
  idstack: {
    /** IDStack 前端站点（/oauth/authorize 授权页、嵌入页 origin） */
    baseUrl: string;
    /** IDStack 后端 API（/api/v1/oauth/token 换 token；与前端不同域时必配，缺省回退 baseUrl） */
    apiBaseUrl: string;
    appId: string;
    appApiKey: string;
    appSecretKey: string;
    /** JWKS 端点（RS256 验签；缺省由 apiBaseUrl 推导） */
    jwksUri: string;
    /** 签发方 iss（消费方校验，缺省 https://idstack.raodaor.com） */
    issuer: string;
  };
  message: {
    /** raodaor-message 后端 API 根（站内通知投递） */
    baseUrl: string;
    /** 应用入站密钥（rdae_ 前缀，message 开放平台签发；仅服务端持有） */
    inboundKey: string;
  };
  /** 极端天气预警巡检（M3 亲情守护推送） */
  alert: {
    /** 巡检周期（秒），默认 300（5 分钟） */
    inspectIntervalSeconds: number;
  };
  file: { baseUrl: string; apiKey: string };
  docs: { baseUrl: string; orgKey: string };
  weather: {
    /** QWeather API Host（国内主数据源） */
    qweatherHost: string;
    /** QWeather API Key（仅服务端持有） */
    qweatherKey: string;
    cacheTtlNow: number;
    cacheTtlHourly: number;
    cacheTtlDaily: number;
    cacheTtlAlerts: number;
  };
}

export default (): AppConfig => ({
  port: toNumber(process.env.PORT) || 9017,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? '',
  cors: { allowOrigins: toList(process.env.CORS_ALLOW_ORIGINS) },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
  idstack: {
    baseUrl: process.env.IDSTACK_BASE_URL ?? 'https://idstack.raodaor.com',
    apiBaseUrl:
      process.env.IDSTACK_API_BASE_URL ??
      process.env.IDSTACK_BASE_URL ??
      'https://idstack.raodaor.com',
    appId: process.env.IDSTACK_APP_ID ?? '',
    appApiKey: process.env.IDSTACK_APP_API_KEY ?? '',
    appSecretKey: process.env.IDSTACK_APP_SECRET_KEY ?? '',
    jwksUri: process.env.IDSTACK_JWKS_URI ?? '',
    issuer: process.env.IDSTACK_ISSUER ?? 'https://idstack.raodaor.com',
  },
  message: {
    baseUrl: (process.env.RAODAOR_MESSAGE_BASE_URL ?? 'https://message.raodaor.com').replace(/\/+$/, ''),
    inboundKey: process.env.RAODAOR_MESSAGE_INBOUND_KEY ?? '',
  },
  alert: {
    inspectIntervalSeconds: toNumber(process.env.ALERT_INSPECT_INTERVAL_SECONDS) || 300,
  },
  file: {
    baseUrl: process.env.RAODAOR_FILE_BASE_URL ?? '',
    apiKey: process.env.RAODAOR_FILE_API_KEY ?? '',
  },
  docs: {
    baseUrl: process.env.RAODAOR_DOCS_BASE_URL ?? '',
    orgKey: process.env.RAODAOR_DOCS_ORG_KEY ?? '',
  },
  weather: {
    qweatherHost: (process.env.QWEATHER_API_HOST ?? 'https://api.qweather.com').replace(/\/+$/, ''),
    qweatherKey: process.env.QWEATHER_API_KEY ?? '',
    cacheTtlNow: toNumber(process.env.WEATHER_CACHE_TTL_NOW) || 600,
    cacheTtlHourly: toNumber(process.env.WEATHER_CACHE_TTL_HOURLY) || 1800,
    cacheTtlDaily: toNumber(process.env.WEATHER_CACHE_TTL_DAILY) || 7200,
    cacheTtlAlerts: toNumber(process.env.WEATHER_CACHE_TTL_ALERTS) || 300,
  },
});
