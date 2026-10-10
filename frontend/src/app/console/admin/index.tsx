import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../design/theme';
import { fontSize, spacing } from '../../../design/tokens';
import { useT } from '../../../i18n';
import { ApiError } from '../../../lib/api';
import { getOverview, type AdminOverview } from '../../../lib/admin-api';
import { AppHeader } from '../../../components/ui/app-header';

/**
 * 平台运营后台概览（/console/admin，PRD §8）。
 * 顶部统计卡片 + 模块网格（用户 / 亲情守护 / 会员 / 预警事件），全部已对接后端。
 * 入口由 me.tsx 按 capabilities.consoleAdmin 显隐。
 */
export default function AdminHubScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getOverview()
      .then((data) => active && setOverview(data))
      .catch((e) => active && setError(e instanceof ApiError ? e.message : '加载失败'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const modules: { key: string; label: string; href: string }[] = [
    { key: 'users', label: t.admin.users, href: '/console/admin/users' },
    { key: 'care', label: t.admin.care, href: '/console/admin/care' },
    { key: 'membership', label: t.admin.membership, href: '/console/admin/membership' },
    { key: 'alerts', label: t.admin.alerts, href: '/console/admin/alerts' },
  ];

  const stats: { key: string; label: string; value: number | string }[] = overview
    ? [
        { key: 'users', label: t.admin.overviewUsers, value: overview.users },
        { key: 'care', label: t.admin.overviewCare, value: overview.careRelations },
        { key: 'active', label: t.admin.overviewActiveMembers, value: overview.activeMembers },
        { key: 'alerts', label: t.admin.overviewAlerts, value: overview.alertEvents },
        { key: 'revenue', label: t.admin.overviewRevenue, value: overview.membershipRevenue.toFixed(2) },
      ]
    : [];

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <AppHeader title={t.admin.centerTitle} />
      <View style={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        {loading ? (
          <ActivityIndicator style={styles.load} color={theme.brand} />
        ) : error ? (
          <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
        ) : (
          <View style={styles.statGrid}>
            {stats.map((s) => (
              <View key={s.key} style={[styles.statCard, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                <Text style={[styles.statValue, { color: theme.textPrimary }]}>{String(s.value)}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t.admin.entry}</Text>
        <View style={styles.moduleList}>
          {modules.map((m) => (
            <Pressable
              key={m.key}
              onPress={() => router.push(m.href as never)}
              style={({ pressed }) => [
                styles.row,
                { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.rowText, { color: theme.textPrimary }]}>{m.label}</Text>
              <Text style={[styles.rowChevron, { color: theme.textSecondary }]}>›</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxl },
  load: { marginVertical: spacing.xxl },
  error: { fontSize: fontSize.body, marginVertical: spacing.lg },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  statCard: {
    width: '47%',
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
  },
  statValue: { fontSize: fontSize.title, fontWeight: '700' },
  statLabel: { fontSize: fontSize.caption },
  sectionTitle: { fontSize: fontSize.heading, fontWeight: '700', marginTop: spacing.sm },
  moduleList: { gap: spacing.md },
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
