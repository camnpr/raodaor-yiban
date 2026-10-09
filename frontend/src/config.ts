/**
 * 公共配置（唯一消费入口）：
 * 所有 EXPO_PUBLIC_* 环境变量与站点常量在此集中读取，
 * 业务代码禁止直接使用 process.env.EXPO_PUBLIC_* 或硬编码域名/地址。
 */

function trimEnd(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeApiBase(raw: string | undefined, fallback: string): string {
  const base = trimEnd(raw ?? '') || fallback;
  // 已含 /api/v1（或未来 /api/v2）前缀则原样使用，否则补齐
  return /\/api\/v\d+$/.test(base) ? base : `${base}/api/v1`;
}

/** API 基础地址（默认本机开发后端） */
export const API_BASE_URL = normalizeApiBase(
  process.env.EXPO_PUBLIC_API_BASE_URL,
  'http://localhost:9015/api/v1',
);

/** IDStack（SSO / 支付 / 会员目录）前端站点：/oauth/authorize 授权页、嵌入页 origin */
export const IDSTACK_BASE_URL = trimEnd(process.env.EXPO_PUBLIC_IDSTACK_BASE_URL ?? 'https://idstack.raodaor.com');

/**
 * IDStack 应用 UUID（授权跳转的 `app_id`；**非密钥**，可下发客户端）。
 * ⚠️ 授权用 `app_id`，换 token 用 `client_id=api_key`——两者不是一回事（api_key/secret 只在后端）。
 */
export const IDSTACK_APP_ID = (process.env.EXPO_PUBLIC_IDSTACK_APP_ID ?? '').trim();

/** IDStack SSO 登录按钮展示的官方 Logo（仅展示，不参与鉴权；缺省回退官方地址） */
export const IDSTACK_LOGO_URL =
  process.env.EXPO_PUBLIC_IDSTACK_LOGO_URL ?? `${IDSTACK_BASE_URL}/images/logo/icon-128x128.png`;

/**
 * SSO 回调地址覆盖项（通常留空，由 lib/idstack-sso.ts 按端推导）：
 * - Web：`${当前站点源}/auth/callback`
 * - Native：`raodaoryiban://auth/callback`
 */
export const IDSTACK_REDIRECT_URI = (process.env.EXPO_PUBLIC_IDSTACK_REDIRECT_URI ?? '').trim();

/** RaoDaor Message（站内消息中心：token 交换与通知读写，均为 message 域 API） */
export const MESSAGE_API_BASE_URL = normalizeApiBase(
  process.env.EXPO_PUBLIC_MESSAGE_API_BASE_URL,
  'https://message.raodaor.com/api/v1',
);

/** 本平台站点域（分享链接 / 深链落地） */
export const SITE_URL = trimEnd(process.env.EXPO_PUBLIC_SITE_URL ?? 'https://yiban.raodaor.com');

/** 默认语言 */
export const DEFAULT_LOCALE = process.env.EXPO_PUBLIC_DEFAULT_LOCALE ?? 'zh-CN';

/**
 * 是否开发构建（仅用于「开发期辅助信息」的显隐，不得参与业务逻辑）。
 */
export const IS_DEV = process.env.NODE_ENV !== 'production';
