import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { IDSTACK_APP_ID, IDSTACK_BASE_URL, IDSTACK_REDIRECT_URI } from '../config';
import type { AuthSession } from '../stores/auth-store';
import { platformStorage } from '../stores/storage';
import { loginWithIdstackCode } from './auth-api';

/**
 * IDStack SSO（OAuth 2.0 授权码模式）客户端。
 * - 前端：动态拼接 `/oauth/authorize`（app_id + redirect_uri + state），state 随机存储防 CSRF；
 * - 后端：用 code 换 token（api_key/secret_key 只在服务端）+ 验签读 roles，再签发本平台 JWT；
 * - 前端绝不接触 client_secret，也绝不自行解码 JWT 做权限决策。
 */

export const SSO_CALLBACK_PATH = '/auth/callback';

const STATE_KEY = 'raodaor-yiban-sso-state';
const STATE_TTL_MS = 10 * 60 * 1000;

interface StoredState {
  state: string;
  redirectUri: string;
  createdAt: number;
}

export type SsoStartResult =
  | { status: 'redirected' }
  | { status: 'completed'; callbackUrl: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export type SsoErrorReason =
  | 'not_configured'
  | 'state_missing'
  | 'state_expired'
  | 'state_mismatch'
  | 'missing_code'
  | 'provider_error'
  | 'exchange_failed';

export type SsoCompleteResult =
  | { status: 'success'; session: AuthSession }
  | { status: 'error'; reason: SsoErrorReason; detail?: string };

export function isSsoConfigured(): boolean {
  return Boolean(IDSTACK_APP_ID && IDSTACK_BASE_URL);
}

/** 回调地址（须与 IDStack 应用 redirect_uris 白名单字节级一致） */
export function resolveRedirectUri(): string {
  if (IDSTACK_REDIRECT_URI) return IDSTACK_REDIRECT_URI;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${SSO_CALLBACK_PATH}`;
  }
  return Linking.createURL(SSO_CALLBACK_PATH);
}

/** 授权 URL 动态拼接（禁止整条写成静态配置；state 每次随机） */
export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const params: Record<string, string> = {
    app_id: IDSTACK_APP_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile offline_access',
    state,
  };
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return `${IDSTACK_BASE_URL}/oauth/authorize?${query}`;
}

function randomState(): string {
  const bytes = new Uint8Array(16);
  const cryptoObj = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => void } }).crypto;
  if (typeof cryptoObj?.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function saveState(redirectUri: string): Promise<string> {
  const state = randomState();
  const payload: StoredState = { state, redirectUri, createdAt: Date.now() };
  await platformStorage.setItem(STATE_KEY, JSON.stringify(payload));
  return state;
}

async function readState(): Promise<StoredState | null> {
  try {
    const raw = await platformStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    if (typeof parsed.state !== 'string' || typeof parsed.createdAt !== 'number') return null;
    return {
      state: parsed.state,
      redirectUri: typeof parsed.redirectUri === 'string' ? parsed.redirectUri : resolveRedirectUri(),
      createdAt: parsed.createdAt,
    };
  } catch {
    return null;
  }
}

/** 发起 SSO：Web 整页跳转 / Native 起系统浏览器并在回跳后返回回调 URL */
export async function beginSsoLogin(): Promise<SsoStartResult> {
  if (!isSsoConfigured()) {
    return { status: 'error', message: 'IDStack 未配置（缺少 EXPO_PUBLIC_IDSTACK_APP_ID）' };
  }
  const redirectUri = resolveRedirectUri();
  const state = await saveState(redirectUri);
  const authorizeUrl = buildAuthorizeUrl(redirectUri, state);

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') {
      return { status: 'error', message: '当前环境不支持跳转授权页' };
    }
    window.location.href = authorizeUrl;
    return { status: 'redirected' };
  }

  const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, redirectUri);
  if (result.type === 'success') {
    return { status: 'completed', callbackUrl: result.url };
  }
  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { status: 'cancelled' };
  }
  return { status: 'error', message: `打开授权页失败（${result.type}）` };
}

export interface SsoCallbackParams {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
}

export function parseCallbackUrl(url: string): SsoCallbackParams {
  const { queryParams } = Linking.parse(url);
  const pick = (key: string): string | undefined => {
    const value = queryParams?.[key];
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    return undefined;
  };
  return {
    code: pick('code'),
    state: pick('state'),
    error: pick('error'),
    errorDescription: pick('error_description'),
  };
}

/** 归一化 expo-router 的 search params（可能为 string | string[]） */
export function normalizeParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

/** 完成 SSO：校验 state（防 CSRF/重放）→ 调后端用 code 换本平台登录态 */
export async function completeSsoLogin(params: SsoCallbackParams): Promise<SsoCompleteResult> {
  if (params.error) {
    return { status: 'error', reason: 'provider_error', detail: params.errorDescription ?? params.error };
  }
  if (!params.code) {
    return { status: 'error', reason: 'missing_code' };
  }

  const stored = await readState();
  if (!stored) {
    return { status: 'error', reason: 'state_missing' };
  }
  if (Date.now() - stored.createdAt > STATE_TTL_MS) {
    await platformStorage.removeItem(STATE_KEY);
    return { status: 'error', reason: 'state_expired' };
  }
  if (params.state && params.state !== stored.state) {
    await platformStorage.removeItem(STATE_KEY);
    return { status: 'error', reason: 'state_mismatch' };
  }

  try {
    const session = await loginWithIdstackCode(params.code, stored.redirectUri);
    await platformStorage.removeItem(STATE_KEY);
    return { status: 'success', session };
  } catch (error) {
    return {
      status: 'error',
      reason: 'exchange_failed',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
