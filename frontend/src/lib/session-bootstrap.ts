import { fetchMe } from './auth-api';
import { useAuthStore } from '../stores/auth-store';

/** 每次进程仅对齐一次（登录 / 换账号时，登录响应已带最新能力布尔，无需重复拉取） */
let started = false;

/**
 * 启动对齐会话：本地恢复会话后调用 `GET /auth/me`，用服务端下发的最新能力布尔覆盖本地旧值。
 * - access_token 过期无需在此处理：`apiFetch` 会用 refresh_token 静默续期并重放请求；
 * - 任何异常都保留本地会话——不能因为一次拉取失败就把已登录用户踢成未登录。
 */
export async function bootstrapSession(): Promise<void> {
  if (started) return;
  started = true;
  if (!useAuthStore.getState().session) return;

  try {
    const { user, capabilities, membership } = await fetchMe();
    useAuthStore.getState().patchSession({ user, capabilities, membership });
  } catch {
    // 网络抖动 / 服务端异常：保留本地会话，下次启动再对齐
  }
}
