import { useEffect, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { completeSsoLogin, normalizeParam } from '../../lib/idstack-sso';
import { useAuthStore } from '../../stores/auth-store';

/**
 * SSO 回调页（Web 主路径；Native 走 login.tsx 的 openAuthSessionAsync 回跳）。
 * 校验 state → 调后端用 code 换登录态 → 写回 auth-store 并回首页。
 */
export default function SsoCallbackScreen() {
  const params = useLocalSearchParams<{
    code?: string | string[];
    state?: string | string[];
    error?: string | string[];
    error_description?: string | string[];
  }>();
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    void (async () => {
      const result = await completeSsoLogin({
        code: normalizeParam(params.code),
        state: normalizeParam(params.state),
        error: normalizeParam(params.error),
        errorDescription: normalizeParam(params.error_description),
      });

      if (result.status === 'success') {
        setSession(result.session);
        router.replace('/');
      } else {
        router.replace({ pathname: '/login', params: { error: result.reason } });
      }
    })();
  }, [params, router, setSession]);

  return null;
}
