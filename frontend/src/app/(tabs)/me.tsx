import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/theme';
import { fontSize, spacing } from '../../design/tokens';
import { useT } from '../../i18n';
import { useAuthStore } from '../../stores/auth-store';
import { Button } from '../../components/ui/button';
import { AppHeader } from '../../components/ui/app-header';

/** 我的（M1 骨架：展示登录态 + 登出；会员/设置后续里程碑补齐） */
export default function MeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const hydrated = useAuthStore((s) => s.hydrated);
  const logout = useAuthStore((s) => s.logout);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <AppHeader title={t.me.title} showBack={false} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      >
      {!hydrated ? (
        <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl }}>
          <ActivityIndicator color={theme.brand} />
        </View>
      ) : session ? (
        <>
          <Text style={[styles.name, { color: theme.textPrimary, fontSize: fontSize.heading }]}>
            {session.user.displayName}
          </Text>
          <Text style={[styles.hint, { color: theme.textSecondary, fontSize: fontSize.body }]}>
            {t.me.membership}
          </Text>
          <Pressable
            onPress={() => router.push('/care')}
            style={({ pressed }) => [
              styles.row,
              { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.rowText, { color: theme.textPrimary, fontSize: fontSize.body }]}>
              {t.care.title}
            </Text>
            <Text style={[styles.rowChevron, { color: theme.textSecondary }]}>›</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/membership')}
            style={({ pressed }) => [
              styles.row,
              { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.rowText, { color: theme.textPrimary, fontSize: fontSize.body }]}>
              {t.membership.title}
            </Text>
            <View style={styles.rowRight}>
              <Text
                style={[
                  styles.badge,
                  {
                    color: session.membership?.isActive ? theme.brand : theme.textSecondary,
                    borderColor: session.membership?.isActive ? theme.brand : theme.border,
                    fontSize: fontSize.caption,
                  },
                ]}
              >
                {session.membership?.isActive ? t.membership.statusActive : t.membership.statusFree}
              </Text>
              <Text style={[styles.rowChevron, { color: theme.textSecondary }]}>›</Text>
            </View>
          </Pressable>

          {session.capabilities.owner && (
            <Pressable
              // /owner 路由由 owner/index.tsx 提供，运行时有效；expo 生成的 typed-routes 偶发漏列该路由（生成产物损坏），此处显式断言。
              onPress={() => router.push('/owner' as never)}
              style={({ pressed }) => [
                styles.row,
                { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.rowText, { color: theme.textPrimary, fontSize: fontSize.body }]}>
                {t.admin.entry}
              </Text>
              <Text style={[styles.rowChevron, { color: theme.textSecondary }]}>›</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [
              styles.row,
              { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.rowText, { color: theme.textPrimary, fontSize: fontSize.body }]}>
              {t.settings.title}
            </Text>
            <Text style={[styles.rowChevron, { color: theme.textSecondary }]}>›</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/privacy')}
            style={({ pressed }) => [
              styles.row,
              { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.rowText, { color: theme.textPrimary, fontSize: fontSize.body }]}>
              {t.settings.privacy}
            </Text>
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxl },
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
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    fontSize: fontSize.caption,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
});
