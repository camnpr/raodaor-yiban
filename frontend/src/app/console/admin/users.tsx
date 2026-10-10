import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../design/theme';
import { fontSize, radius, spacing, touchMinHeight } from '../../../design/tokens';
import { useT } from '../../../i18n';
import { ApiError } from '../../../lib/api';
import { listUsers, type UserLite } from '../../../lib/admin-api';
import { AppHeader } from '../../../components/ui/app-header';
import { Button } from '../../../components/ui/button';

const TIER_LABEL: Record<string, string> = { free: 'Free', standard: 'Standard', premium: 'Premium' };

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString() : '';
}

export default function AdminUsersScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();

  const [q, setQ] = useState('');
  const [items, setItems] = useState<UserLite[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPage = (targetQ: string, targetPage: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    listUsers({ q: targetQ || undefined, page: targetPage, pageSize: 20 })
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
    fetchPage(q, 1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearchChange = (value: string) => {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPage(value, 1, false), 400);
  };

  const loadMore = () => {
    if (loadingMore || items.length >= total) return;
    fetchPage(q, page + 1, true);
  };

  const renderItem = ({ item }: { item: UserLite }) => (
    <Pressable
      onPress={() => router.push(`/console/admin/users/${item.id}` as never)}
      style={({ pressed }) => [
        styles.row,
        { borderColor: theme.border, backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.rowMain}>
        <Text style={[styles.name, { color: theme.textPrimary }]} numberOfLines={1}>
          {item.displayName || item.id}
        </Text>
        <Text style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={1}>
          {item.locale} · {item.membershipTier ? TIER_LABEL[item.membershipTier] ?? item.membershipTier : t.admin.noTier}
          {item.membershipExpiresAt ? ` · ${fmtDate(item.membershipExpiresAt)}` : ''}
        </Text>
      </View>
      <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text>
    </Pressable>
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <AppHeader title={t.admin.users} />
      <View style={[styles.searchWrap, { borderColor: theme.border }]}>
        <TextInput
          style={[styles.search, { color: theme.textPrimary }]}
          value={q}
          onChangeText={onSearchChange}
          placeholder={t.admin.searchPlaceholder}
          placeholderTextColor={theme.textSecondary}
        />
      </View>
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
          ListFooterComponent={
            items.length < total ? (
              <Button
                title={loadingMore ? t.admin.loading : t.admin.loadMore}
                variant="secondary"
                onPress={loadMore}
                disabled={loadingMore}
                loading={loadingMore}
                block
              />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  searchWrap: { padding: spacing.md, borderBottomWidth: 1 },
  search: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, minHeight: touchMinHeight },
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
  chevron: { fontSize: 22, marginLeft: spacing.sm },
});
