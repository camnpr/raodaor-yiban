import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/auth-store';

/**
 * 平台运营中心（owner 专属路由组）。
 * 非 owner 直接回退到首页，避免越权深链（最终鉴权仍以后端 @Roles('owner') 为准）。
 */
export default function OwnerLayout() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const isOwner = useAuthStore((s) => Boolean(s.session?.capabilities.owner));
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !isOwner) {
      router.replace('/(tabs)');
    }
  }, [hydrated, isOwner, router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
