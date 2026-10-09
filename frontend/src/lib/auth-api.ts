import type { AuthMembership, AuthSession, AuthUser, Capabilities } from '../stores/auth-store';
import { apiFetch } from './api';

/** 后端 /auth/* 封装（密钥只在后端；前端只持有本平台 JWT 对） */

export interface MeResult {
  user: AuthUser;
  capabilities: Capabilities;
  membership: AuthMembership;
}

/** IDStack 授权码 → 本平台 JWT 对（后端持 api_key/secret_key 换 token + JWKS 验签读 roles） */
export function loginWithIdstackCode(code: string, redirectUri: string): Promise<AuthSession> {
  return apiFetch<AuthSession>('/auth/idstack/login', {
    method: 'POST',
    body: JSON.stringify({ code, redirectUri }),
  });
}

/** 当前登录用户（能力布尔随 token roles 派生，前端入口一律以此驱动） */
export function fetchMe(): Promise<MeResult> {
  return apiFetch<MeResult>('/auth/me');
}

// 令牌续期不在此封装：`lib/api.ts` 的 authedRequest 在认证失效时用 refresh_token 单飞静默续期并重放。
