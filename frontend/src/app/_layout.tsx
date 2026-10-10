import { useEffect } from 'react';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { ActivityIndicator, Platform, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '../design/theme';
import { useAuthStore } from '../stores/auth-store';
import { bootstrapSession } from '../lib/session-bootstrap';
import { ConsentModal } from '../components/common/consent-modal';

/** 根布局：主题 + 会话启动对齐（能力布尔由服务端 /auth/me 覆盖本地快照） */
export default function RootLayout() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const authHydrated = useAuthStore((s) => s.hydrated);
  const hasSession = useAuthStore((s) => Boolean(s.session));

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void SystemUI.setBackgroundColorAsync(theme.background).catch(() => undefined);
  }, [theme.background]);

  useEffect(() => {
    if (authHydrated && hasSession) void bootstrapSession();
  }, [authHydrated, hasSession]);

  return (
    <SafeAreaProvider>
      <Head>
        <title>绕道儿颐伴 - Raodaor Yiban</title>
        <meta
          name="description"
          content="绕道儿颐伴 是绕道儿（RaoDaor）生态面向中老年的 AI 暖心陪伴 + 健康安全守护综合生活助手"
        />
      </Head>
      {authHydrated ? (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="login" />
          <Stack.Screen name="auth/callback" />
          <Stack.Screen name="cities" />
          <Stack.Screen name="care/invite" />
          <Stack.Screen name="owner" />
          <Stack.Screen name="guard/[elderId]" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="privacy" />
        </Stack>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
          <ActivityIndicator size="large" color={theme.brand} />
        </View>
      )}
      <ConsentModal />
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </SafeAreaProvider>
  );
}
