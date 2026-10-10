import { apiFetch } from './api';
import type { Locale } from '../i18n';

/** 更新语言偏好（同步后端，便于跨端一致与合规留痕） */
export function updateLocale(locale: Locale) {
  return apiFetch<{ id: string; locale: string }>('/account/locale', {
    method: 'PUT',
    body: JSON.stringify({ locale }),
  });
}

/** 注销账号（后端软删 + 匿名化；前端登出本地会话） */
export function deactivateAccount() {
  return apiFetch<{ id: string; deletedAt: boolean }>('/account/deactivate', {
    method: 'DELETE',
  });
}
