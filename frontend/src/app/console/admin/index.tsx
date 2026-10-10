import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../design/theme';
import { fontSize, spacing } from '../../../design/tokens';
import { useT } from '../../../i18n';
import { AppHeader } from '../../../components/ui/app-header';

/**
 * 平台运营后台首页（/console/admin，PRD §8）。
 * 模块清单：概览 / 用户与长辈档案 / 亲情守护 / 会员 / 预警事件。
 * 仅「会员」子页当前可用（含运营补单）；其余为建设中占位，待后端接口补齐。
 * 入口由 me.tsx 按 capabilities.consoleAdmin 显隐。
 */
export default function AdminHubScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();

  const modules: { key: string; label: string; href: string | null }[] = [
    { key: 'overview', label: t.admin.overview, href: null },
    { key: 'users', label: t.admin.users, href: null },
    { key: 'care', label: t.admin.care, href: null },
    { key: 'membership', label: t.admin.membership, href: '/console/admin/membership' },
    { key: 'alerts', label: t.admin.alerts, href: null },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <AppHeader title={t.admin.centerTitle} />
      <View style={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        {modules.map((m) => {
          const disabled = !m.href;
          return (
            <Pressable
              key={m.key}
              disabled={disabled}
              onPress={() => m.href && router.push(m.href as never)}
              style={({ pressed }) => [
                styles.row,
                { borderColor: theme.border, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 },
              ]}
            >
              <View style={styles.rowMain}>
                <Text style={[styles.rowText, { color: theme.textPrimary }]}>{m.label}</Text>
                {disabled && (
                  <Text style={[styles.rowHint, { color: theme.textSecondary }]}>{t.admin.comingSoon}</Text>
                )}
              </View>
              {!disabled && <Text style={[styles.rowChevron, { color: theme.textSecondary }]}>›</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
  },
  rowMain: { flexDirection: 'column', gap: 2 },
  rowText: { fontSize: fontSize.body, fontWeight: '600' },
  rowHint: { fontSize: fontSize.caption },
  rowChevron: { fontSize: 22 },
});
