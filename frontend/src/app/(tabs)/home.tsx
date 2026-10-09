import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../design/theme';
import { fontSize, spacing } from '../../design/tokens';
import { useT } from '../../i18n';
import { useAuthStore } from '../../stores/auth-store';
import { Button } from '../../components/ui/button';

/**
 * 天气首页（M1 骨架；天气核心能力 M2 落地）。
 * 游客可浏览（后续天气数据公开），登录态展示用户身份与收藏入口。
 */
export default function HomeScreen() {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>{t.home.title}</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t.home.subtitle}</Text>

      {session ? (
        <Text style={[styles.placeholder, { color: theme.textSecondary }]}>
          {t.home.weatherComingSoon}
        </Text>
      ) : (
        <View style={styles.guest}>
          <Text style={[styles.loginPrompt, { color: theme.textPrimary }]}>{t.home.loginPrompt}</Text>
          <Button title={t.home.loginButton} onPress={() => router.push('/login')} block />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, gap: spacing.md, justifyContent: 'center' },
  title: { fontSize: fontSize.title, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: fontSize.body, textAlign: 'center' },
  placeholder: { fontSize: fontSize.body, textAlign: 'center' },
  guest: { gap: spacing.md },
  loginPrompt: { fontSize: fontSize.body, textAlign: 'center' },
});
