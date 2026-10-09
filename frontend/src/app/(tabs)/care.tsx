import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../../design/theme';
import { fontSize, spacing } from '../../design/tokens';
import { useT } from '../../i18n';
import { useAuthStore } from '../../stores/auth-store';
import { useCareStore } from '../../stores/care-store';
import { Button } from '../../components/ui/button';
import { ElderCard } from '../../components/care/elder-card';

/** 亲情守护（M3 核心）：守护中心（子女端）+ 家人视图（长辈端） */
export default function CareScreen() {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);

  const loading = useCareStore((s) => s.loading);
  const error = useCareStore((s) => s.error);
  const relationships = useCareStore((s) => s.relationships);
  const elders = useCareStore((s) => s.elders);
  const loadRelationships = useCareStore((s) => s.loadRelationships);
  const loadElders = useCareStore((s) => s.loadElders);
  const removeRelationship = useCareStore((s) => s.removeRelationship);

  const guardians = useMemo(
    () => relationships.filter((r) => r.role === 'elder'),
    [relationships],
  );
  const hasContent = elders.length > 0 || guardians.length > 0;

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      void loadRelationships();
      void loadElders();
    }, [session, loadRelationships, loadElders]),
  );

  const onUnbind = useCallback(
    (id: string, name: string) => {
      Alert.alert(t.care.unbind, t.care.unbindConfirm, [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.care.unbind,
          style: 'destructive',
          onPress: () => {
            void removeRelationship(id);
          },
        },
      ]);
    },
    [t, removeRelationship],
  );

  if (!session) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>{t.care.title}</Text>
        <Text style={[styles.empty, { color: theme.textSecondary }]}>{t.care.empty}</Text>
        <Button title={t.me.login} onPress={() => router.push('/login')} block />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>{t.care.title}</Text>
        <Pressable onPress={() => router.push('/care/invite')} hitSlop={12}>
          <Text style={[styles.add, { color: theme.brand }]}>＋ {t.care.invite}</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.brand} />
        </View>
      ) : error ? (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>{error}</Text>
      ) : !hasContent ? (
        <View style={styles.center}>
          <Text style={[styles.empty, { color: theme.textSecondary }]}>{t.care.empty}</Text>
          <Button title={t.care.invite} onPress={() => router.push('/care/invite')} block />
        </View>
      ) : (
        <>
          {/* 守护中心：我守护的长辈 */}
          <Text style={[styles.section, { color: theme.textPrimary }]}>{t.care.guardianSection}</Text>
          {elders.length === 0 ? (
            <Text style={[styles.muted, { color: theme.textSecondary }]}>{t.care.noElders}</Text>
          ) : (
            elders.map((elder) => (
              <ElderCard
                key={elder.elderId}
                elder={elder}
                onPress={() =>
                  router.push({ pathname: '/guard/[elderId]', params: { elderId: elder.elderId } })
                }
              />
            ))
          )}

          {/* 家人视图：守护我的家人 */}
          <Text style={[styles.section, { color: theme.textPrimary }]}>{t.care.elderSection}</Text>
          {guardians.length === 0 ? (
            <Text style={[styles.muted, { color: theme.textSecondary }]}>{t.care.noGuardians}</Text>
          ) : (
            guardians.map((g) => (
              <View
                key={g.id}
                style={[styles.guardianRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <Text style={[styles.guardianName, { color: theme.textPrimary }]} numberOfLines={1}>
                  {g.counterpartName}
                </Text>
                <Pressable onPress={() => onUnbind(g.id, g.counterpartName)} hitSlop={12}>
                  <Text style={[styles.unbind, { color: theme.danger }]}>{t.care.unbind}</Text>
                </Pressable>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: fontSize.title, fontWeight: '700' },
  add: { fontSize: fontSize.heading, fontWeight: '700' },
  section: { fontSize: fontSize.heading, fontWeight: '700', marginTop: spacing.sm },
  center: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  empty: { fontSize: fontSize.body, textAlign: 'center' },
  muted: { fontSize: fontSize.body },
  guardianRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  guardianName: { fontSize: fontSize.body, fontWeight: '600', flexShrink: 1 },
  unbind: { fontSize: fontSize.body, fontWeight: '600' },
});
