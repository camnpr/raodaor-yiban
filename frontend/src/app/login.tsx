import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useTheme } from '../design/theme';
import { fontSize, spacing } from '../design/tokens';
import { useT } from '../i18n';
import { useAuthStore } from '../stores/auth-store';
import { Button } from '../components/ui/button';
import { AppHeader } from '../components/ui/app-header';
import { IDSTACK_LOGO_URL } from '../config';
import { beginSsoLogin, completeSsoLogin, parseCallbackUrl } from '../lib/idstack-sso';

/** IDStack SSO 登录页（Web 整页跳转 / Native 系统浏览器回跳） */
export default function LoginScreen() {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    const result = await beginSsoLogin();

    if (result.status === 'completed') {
      // Native：openAuthSessionAsync 回跳成功，手动完成登录
      const complete = await completeSsoLogin(parseCallbackUrl(result.callbackUrl));
      if (complete.status === 'success') {
        setSession(complete.session);
        router.replace('/');
      } else {
        setError(complete.detail ?? complete.reason);
      }
    } else if (result.status === 'redirected') {
      // Web：整页跳转，回调由 /auth/callback 处理（本页即将卸载）
    } else if (result.status === 'cancelled') {
      setError(t.login.cancelled);
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <AppHeader title={t.common.appName} showBack={false} />
      <View style={styles.content}>
        <Image source={{ uri: IDSTACK_LOGO_URL }} style={styles.logo} />
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t.login.subtitle}</Text>
        <Button title={t.login.button} onPress={handleLogin} loading={loading} block />
        {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, padding: spacing.xl, gap: spacing.md, justifyContent: 'center' },
  logo: { width: 64, height: 64, alignSelf: 'center' },
  subtitle: { fontSize: fontSize.body, textAlign: 'center', color: '#888' },
  error: { fontSize: fontSize.caption, textAlign: 'center' },
});
