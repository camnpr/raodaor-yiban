import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../../design/theme';
import { fontSize, spacing } from '../../../../design/tokens';
import { useT } from '../../../../i18n';
import { ApiError } from '../../../../lib/api';
import { getUser, type UserDetail } from '../../../../lib/admin-api';
import { AppHeader } from '../../../../components/ui/app-header';

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString() : '—';
}
function fmtDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : '—';
}

function Field({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={[styles.field, { borderBottomColor: theme.border }]}>
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.fieldValue, { color: theme.textPrimary }]}>{value}</Text>
    </View>
  );
}

export default function AdminUserDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getUser(id)
      .then(setUser)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <AppHeader title={t.admin.users} />
      {loading ? (
        <ActivityIndicator style={styles.load} color={theme.brand} />
      ) : error ? (
        <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
      ) : user ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        >
          <Field label={t.admin.userTier} value={user.membershipTier ?? t.admin.noTier} theme={theme} />
          <Field label={t.admin.userExpiry} value={fmtDate(user.membershipExpiresAt)} theme={theme} />
          <Field label={t.admin.userLocale} value={user.locale} theme={theme} />
          <Field label="Timezone" value={user.timezone} theme={theme} />
          <Field label="ID" value={user.id} theme={theme} />
          <Field label={t.admin.userCreated} value={fmtDateTime(user.createdAt)} theme={theme} />
          <Field label={t.admin.careElder} value={String(user.careCount)} theme={theme} />
          <Field label="收藏城市" value={String(user.cityCount)} theme={theme} />
          {user.elderProfile ? (
            <>
              <Field label="长辈档案 · 出生年" value={user.elderProfile.birthYear != null ? String(user.elderProfile.birthYear) : '—'} theme={theme} />
              <Field label="长辈档案 · 城市" value={user.elderProfile.cityName ?? '—'} theme={theme} />
              <Field label="长辈档案 · 备注" value={user.elderProfile.note ?? '—'} theme={theme} />
            </>
          ) : null}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.xs },
  load: { marginVertical: spacing.xxl },
  error: { fontSize: fontSize.body, margin: spacing.lg },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  fieldLabel: { fontSize: fontSize.body },
  fieldValue: { fontSize: fontSize.body, fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: spacing.md },
});
