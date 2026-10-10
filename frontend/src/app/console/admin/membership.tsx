import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../design/theme';
import { fontSize, spacing } from '../../../design/tokens';
import { useT } from '../../../i18n';
import { AppHeader } from '../../../components/ui/app-header';

/**
 * 运营后台 · 会员子页（/console/admin/membership）。
 * 订阅订单、权益映射为建设中占位（待后端接口）；运营补单为已上线功能。
 */
export default function AdminMembershipScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();

  const items: { key: string; label: string; href: string | null }[] = [
    { key: 'orders', label: t.admin.orders, href: null },
    { key: 'benefits', label: t.admin.benefits, href: null },
    { key: 'grant', label: t.admin.grantItem, href: '/console/admin/grant' },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <AppHeader title={t.admin.membership} />
      <View style={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        {items.map((m) => {
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
