import { API_BASE_URL } from '../config';
import { useAuthStore, type AuthSession } from '../stores/auth-store';

/**
 * 极简 API client：统一解包后端响应 { code, data, message }。
 * 0 = 成功；非 0 抛 ApiError（分段错误码：1xxx 通用 / 2xxx 认证 / 9xxx 生态依赖）。
 */

const BASE_URL = API_BASE_URL;

export class ApiError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiEnvelope<T> {
  code: number;
  data: T;
  message: string;
}

type AuthedRequestInit = Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };

/** 认证失效错误码（后端 auth 模块）：2001 登录已过期 / 2002 刷新令牌无效 */
const AUTH_EXPIRED_CODES = new Set([2001, 2002]);
/** 网关直接返回 401 而无业务码时的兜底判定 */
const HTTP_UNAUTHORIZED = 401;

/** 认证入口自身不做「续期重放」：授权码是一次性的，重放会拿到 CODE_ALREADY_USED */
const NO_RETRY_PATHS = new Set(['/auth/idstack/login', '/auth/refresh']);

function isAuthExpired(code: number): boolean {
  return AUTH_EXPIRED_CODES.has(code) || code === HTTP_UNAUTHORIZED;
}

/** 单飞（single-flight）：并发的认证失效只触发一次续期 */
let refreshInFlight: Promise<string | null> | null = null;

/** 临期判定余量（秒） */
const EXPIRY_MARGIN_SECONDS = 60;

function tokenExpSeconds(token: string | undefined): number | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return (JSON.parse(json) as { exp?: number }).exp ?? null;
  } catch {
    return null;
  }
}

/** 请求前主动续期：access_token 临期（<60s）先静默续期，避免请求在途时失效 */
async function ensureFreshAccessToken(): Promise<string | undefined> {
  const session = useAuthStore.getState().session;
  if (!session) return undefined;
  const exp = tokenExpSeconds(session.accessToken);
  if (exp === null || exp - EXPIRY_MARGIN_SECONDS > Date.now() / 1000) {
    return session.accessToken;
  }
  const renewed = await refreshAccessToken();
  return renewed ?? session.accessToken;
}

/**
 * 用 refresh_token 静默续期（旋转签发，新令牌立即写回 auth-store）。
 * 这里直接 fetch，不复用 auth-api（避免循环依赖）。
 */
async function refreshAccessToken(): Promise<string | null> {
  const session = useAuthStore.getState().session;
  if (!session?.refreshToken) return null;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        });
        const json = (await res.json().catch(() => null)) as ApiEnvelope<AuthSession> | null;
        if (!res.ok || !json || json.code !== 0 || !json.data?.accessToken) return null;
        useAuthStore.getState().setSession(json.data);
        return json.data.accessToken;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

/** 统一请求：解包 { code, data, message } + 认证失效自动续期重放 */
async function authedRequest<T>(
  path: string,
  init: AuthedRequestInit,
  opts: { jsonHeaders?: boolean; retryOnExpiry?: boolean } = {},
): Promise<T> {
  const { jsonHeaders = true, retryOnExpiry = true } = opts;
  const accessToken = (await ensureFreshAccessToken()) ?? '';
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(jsonHeaders ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });

  let json: ApiEnvelope<T> | null = null;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    // 非 JSON 响应（网关错误等）
  }

  if (!res.ok || !json || json.code !== 0) {
    const code = json?.code ?? res.status;
    if (retryOnExpiry && isAuthExpired(code) && !NO_RETRY_PATHS.has(path)) {
      const renewed = await refreshAccessToken();
      if (renewed) return authedRequest<T>(path, init, { ...opts, retryOnExpiry: false });
      useAuthStore.getState().logout();
    }
    throw new ApiError(code, json?.message ?? `HTTP ${res.status}`);
  }
  return json.data;
}

export function apiFetch<T>(path: string, init: AuthedRequestInit = {}): Promise<T> {
  return authedRequest<T>(path, init);
}

/** multipart 上传（FormData；不得手写 Content-Type） */
export function apiUpload<T>(path: string, body: FormData): Promise<T> {
  return authedRequest<T>(path, { method: 'POST', body }, { jsonHeaders: false });
}
