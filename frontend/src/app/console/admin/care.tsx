import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../design/theme';
import { fontSize, radius, spacing } from '../../../design/tokens';
import { useT } from '../../../i18n';
import { ApiError } from '../../../lib/api';
import { listCareRelations, type CareRelation } from '../../../lib/admin-api';
import { AppHeader } from '../../../components/ui/app-header';

type StatusFilter = 'ALL' | 'PENDING' | 'ACTIVE' | 'REJECTED';

const STATUS_LABEL: Record<Exclude<StatusFilter, 'ALL'>, string> = {
  PENDING: '',
  ACTIVE: '',
  REJECTED: '',
};

function statusTone(status: CareRelation['status'], theme: ReturnType<typeof useTheme>): string {
  if (status === 'ACTIVE') return theme.success;
  if (status === 'PENDING') return theme.warning;
  return theme.danger;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export default function AdminCareScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();

  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [items, setItems] = useState<CareRelation[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = (targetFilter: StatusFilter, targetPage: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    listCareRelations({
      status: targetFilter === 'ALL' ? undefined : targetFilter,
      page: targetPage,
      pageSize: 20,
    })
      .then((res) => {
        setItems((prev) => (append ? [...prev, ...res.items] : res.items));
        setTotal(res.total);
        setPage(res.page);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : '加载失败'))
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  };

  useEffect(() => {
    fetchPage(filter, 1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const loadMore = () => {
    if (loadingMore || items.length >= total) return;
    fetchPage(filter, page + 1, true);
  };

  const filters: StatusFilter[] = ['ALL', 'PENDING', 'ACTIVE', 'REJECTED'];
  STATUS_LABEL.PENDING = t.admin.carePending;
  STATUS_LABEL.ACTIVE = t.admin.careActive;
  STATUS_LABEL.REJECTED = t.admin.careRejected;

  const renderItem = ({ item }: { item: CareRelation }) => (
    <View style={[styles.row, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <View style={styles.rowMain}>
        <Text style={[styles.name, { color: theme.textPrimary }]} numberOfLines={1}>
          {item.elder.displayName ?? item.elderUserId} → {item.guardian.displayName ?? item.guardianUserId}
        </Text>
        <Text style={[styles.sub, { color: theme.textSecondary }]}>{fmtDate(item.createdAt)}</Text>
      </View>
      <Text style={[styles.badge, { color: statusTone(item.status, theme) }]}>
        {STATUS_LABEL[item.status] ?? item.status}
      </Text>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <AppHeader title={t.admin.care} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsWrap}
        contentContainerStyle={styles.chips}
      >
        {filters.map((f) => {
          const activeFilter = filter === f;
          const label = f === 'ALL' ? t.admin.careStatus : STATUS_LABEL[f as Exclude<StatusFilter, 'ALL'>];
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={({ pressed }) => [
                styles.chip,
                {
                  borderColor: theme.border,
                  backgroundColor: activeFilter ? theme.brand : theme.surface,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={{ color: activeFilter ? theme.brandOn : theme.textPrimary, fontSize: fontSize.caption }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {loading ? (
        <ActivityIndicator style={styles.load} color={theme.brand} />
      ) : error ? (
        <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
      ) : items.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>{t.admin.emptyData}</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xxl }]}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  chipsWrap: { maxHeight: 56 },
  chips: { gap: spacing.sm, padding: spacing.md },
  chip: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  load: { marginVertical: spacing.xxl },
  error: { fontSize: fontSize.body, margin: spacing.lg },
  empty: { fontSize: fontSize.body, margin: spacing.xl, textAlign: 'center' },
  list: { padding: spacing.md, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
  },
  rowMain: { flex: 1, gap: 2 },
  name: { fontSize: fontSize.body, fontWeight: '600' },
  sub: { fontSize: fontSize.caption },
  badge: { fontSize: fontSize.caption, fontWeight: '700', marginLeft: spacing.sm },
});
