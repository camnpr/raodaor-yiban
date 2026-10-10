import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuthStore } from '../../../stores/auth-store';

/**
 * 平台运营后台（/console/admin，PRD §8）。
 * 仅平台运营者（capabilities.consoleAdmin = system_admin | owner）可进入；
 * 非运营者回退首页，避免越权深链（最终鉴权仍以后端 @Roles 为准）。
 */
export default function AdminLayout() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const canAdmin = useAuthStore((s) => Boolean(s.session?.capabilities.consoleAdmin));
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !canAdmin) {
      router.replace('/(tabs)');
    }
  }, [hydrated, canAdmin, router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
