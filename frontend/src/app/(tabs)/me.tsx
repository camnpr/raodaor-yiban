import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../design/theme';
import { fontSize, spacing } from '../../design/tokens';
import { useT } from '../../i18n';
import { useAuthStore } from '../../stores/auth-store';
import { Button } from '../../components/ui/button';

/** 我的（M1 骨架：展示登录态 + 登出；会员/设置后续里程碑补齐） */
export default function MeScreen() {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>{t.me.title}</Text>

      {session ? (
        <>
          <Text style={[styles.name, { color: theme.textPrimary }]}>{session.user.displayName}</Text>
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            {t.me.membership} · {t.me.settings} · {t.me.fontSize}
          </Text>
          <Pressable
            onPress={() => router.push('/care')}
            style={({ pressed }) => [
              styles.row,
              { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.rowText, { color: theme.textPrimary }]}>{t.care.title}</Text>
            <Text style={[styles.rowChevron, { color: theme.textSecondary }]}>›</Text>
          </Pressable>
          <Button title={t.me.logout} variant="secondary" onPress={logout} block />
        </>
      ) : (
        <>
          <Text style={[styles.hint, { color: theme.textSecondary }]}>{t.me.guest}</Text>
          <Button title={t.me.login} onPress={() => router.push('/login')} block />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, gap: spacing.md, justifyContent: 'center' },
  title: { fontSize: fontSize.title, fontWeight: '700', textAlign: 'center' },
  name: { fontSize: fontSize.heading, fontWeight: '700', textAlign: 'center' },
  hint: { fontSize: fontSize.body, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
  },
  rowText: { fontSize: fontSize.body, fontWeight: '600' },
  rowChevron: { fontSize: 22 },
});
