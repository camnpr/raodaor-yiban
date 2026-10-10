import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../design/theme';
import { fontSize, radius, spacing } from '../design/tokens';
import { useT } from '../i18n';
import { IDSTACK_BASE_URL } from '../config';
import { useAuthStore } from '../stores/auth-store';
import { Button } from '../components/ui/button';
import {
  createCheckout,
  getMembershipPlans,
  getMyMembership,
  getBroadcastSettings,
  updateBroadcastSettings,
  updateTimezone,
  type BroadcastSettings,
  type MembershipBenefit,
  type MyMembership,
} from '../lib/membership-api';

const TIER_LABELS: Record<string, string> = {
  free: '免费版',
  standard: '标准会员',
  premium: '颐伴尊享',
};

/** 适老友好的预设播报时段（避免复杂时间选择器） */
const PRESET_TIMES = ['06:00', '07:00', '08:00', '09:00', '18:00', '20:00'];

/** 常用时区（IANA），按用户时区换算播报；覆盖主要华人/海外聚居地 */
const TIMEZONES = [
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Singapore',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Australia/Sydney',
];
const TZ_LABELS: Record<string, string> = {
  'Asia/Shanghai': '北京/上海',
  'Asia/Hong_Kong': '香港',
  'Asia/Tokyo': '东京',
  'Asia/Singapore': '新加坡',
  'America/New_York': '纽约',
  'America/Los_Angeles': '洛杉矶',
  'Europe/London': '伦敦',
  'Australia/Sydney': '悉尼',
};

function tierLabel(code: string | null): string {
  if (!code) return TIER_LABELS.free;
  return TIER_LABELS[code] ?? code;
}

function PerkRow({ ok, label, onPress }: { ok: boolean; label: string; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.perkRow}>
      <Text style={[styles.perkMark, { color: ok ? theme.brand : theme.textSecondary }]}>
        {ok ? '✓' : '—'}
      </Text>
      <Text style={[styles.perkLabel, { color: ok ? theme.textPrimary : theme.textSecondary }]}>
        {label}
      </Text>
      {onPress ? <Text style={[styles.perkArrow, { color: theme.textSecondary }]}>›</Text> : null}
    </Pressable>
  );
}

/** 会员中心（M4）：权益阶梯展示 + 开通跳转绕道儿支付（FR-M1/M3/M4） */
export default function MembershipScreen() {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);

  const [plans, setPlans] = useState<MembershipBenefit[]>([]);
  const [mine, setMine] = useState<MyMembership | null>(null);
  const [loading, setLoading] = useState(false);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [broadcast, setBroadcast] = useState<BroadcastSettings | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [p, m, b] = await Promise.all([getMembershipPlans(), getMyMembership(), getBroadcastSettings()]);
      setPlans(p);
      setMine(m);
      setBroadcast(b);
    } catch (e) {
      // 网络/服务端异常：保留空态，下次进入再加载
      void e;
    } finally {
      setLoading(false);
    }
  }, [session]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const onUpgrade = useCallback(
    async (tierCode: string) => {
      if (!session) {
        router.push('/login');
        return;
      }
      setUpgrading(tierCode);
      try {
        const intent = await createCheckout(tierCode);
        const url =
          `${IDSTACK_BASE_URL}/payment/create` +
          `?businessType=membership` +
          `&businessId=${encodeURIComponent(intent.tierCode)}` +
          `&amount=${encodeURIComponent(intent.amount)}` +
          `&currency=${encodeURIComponent(intent.currency)}` +
          `&externalOrderId=${encodeURIComponent(intent.externalOrderId)}` +
          `&locked=true`;
        if (Platform.OS === 'web') {
          window.open(url, '_blank');
        } else {
          await WebBrowser.openBrowserAsync(url);
        }
        // 付款由运营在 IDStack 核销后触发 webhook 落地；这里提示用户回来刷新
        Alert.alert(t.membership.title, t.membership.refreshHint);
        await load();
      } catch (e) {
        Alert.alert(t.membership.title, e instanceof Error ? e.message : String(e));
      } finally {
        setUpgrading(null);
      }
    },
    [session, router, t, load],
  );

  const onToggleBroadcast = useCallback(
    async (value: boolean) => {
      if (!broadcast) return;
      try {
        const updated = await updateBroadcastSettings({
          enabled: value,
          time: value ? broadcast.time ?? PRESET_TIMES[2] : undefined,
        });
        setBroadcast(updated);
      } catch (e) {
        Alert.alert(t.membership.title, e instanceof Error ? e.message : String(e));
      }
    },
    [broadcast, t],
  );

  const onPickTime = useCallback(
    async (t0: string) => {
      try {
        const updated = await updateBroadcastSettings({ enabled: true, time: t0 });
        setBroadcast(updated);
      } catch (e) {
        Alert.alert(t.membership.title, e instanceof Error ? e.message : String(e));
      }
    },
    [t],
  );

  const onPickTimezone = useCallback(
    async (tz: string) => {
      try {
        const res = await updateTimezone(tz);
        setMine((prev) => (prev ? { ...prev, timezone: res.timezone } : prev));
      } catch (e) {
        Alert.alert(t.membership.title, e instanceof Error ? e.message : String(e));
      }
    },
    [t],
  );

  if (!session) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>{t.membership.title}</Text>
        <Text style={[styles.empty, { color: theme.textSecondary }]}>{t.me.login}</Text>
        <Button title={t.me.login} onPress={() => router.push('/login')} block />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: theme.textPrimary }]}>{t.membership.title}</Text>

      <View style={[styles.statusCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>{t.membership.current}</Text>
        <Text style={[styles.statusValue, { color: theme.textPrimary }]}>
          {mine?.isActive ? tierLabel(mine.tier) : t.membership.statusFree}
        </Text>
        {mine?.isActive && mine.expiresAt ? (
          <Text style={[styles.statusExp, { color: theme.textSecondary }]}>
            {new Date(mine.expiresAt).toLocaleDateString()}
          </Text>
        ) : null}
      </View>

      {/* 每日定时播报（FR-M4）：会员权益，开关 + 时段 */}
      <View style={[styles.planCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.planHead}>
          <Text style={[styles.planName, { color: theme.textPrimary }]}>{t.membership.timedBroadcast}</Text>
          {broadcast?.entitled ? (
            <Switch
              value={broadcast.enabled}
              onValueChange={onToggleBroadcast}
              thumbColor={broadcast.enabled ? theme.brand : undefined}
            />
          ) : null}
        </View>
        {!broadcast?.entitled ? (
          <Text style={[styles.hint, { color: theme.textSecondary }]}>开通标准或尊享会员后，可设置每日定时天气播报</Text>
        ) : (
          <>
            {broadcast.enabled ? (
              <View style={styles.timeRow}>
                {PRESET_TIMES.map((t0) => {
                  const active = broadcast.time === t0;
                  return (
                    <Pressable
                      key={t0}
                      onPress={() => onPickTime(t0)}
                      style={[
                        styles.timeChip,
                        { borderColor: theme.border },
                        active && { backgroundColor: theme.brand, borderColor: theme.brand },
                      ]}
                    >
                      <Text style={[styles.timeChipText, { color: active ? theme.surface : theme.textPrimary }]}>{t0}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={[styles.hint, { color: theme.textSecondary }]}>开启后选择播报时段</Text>
            )}
            <Text style={[styles.section2, { color: theme.textSecondary }]}>播报时区</Text>
            <View style={styles.timeRow}>
              {TIMEZONES.map((tz) => {
                const active = (mine?.timezone ?? 'Asia/Shanghai') === tz;
                return (
                  <Pressable
                    key={tz}
                    onPress={() => onPickTimezone(tz)}
                    style={[
                      styles.timeChip,
                      { borderColor: theme.border },
                      active && { backgroundColor: theme.brand, borderColor: theme.brand },
                    ]}
                  >
                    <Text style={[styles.timeChipText, { color: active ? theme.surface : theme.textPrimary }]}>{TZ_LABELS[tz]}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </View>

      <Text style={[styles.section, { color: theme.textPrimary }]}>{t.membership.plans}</Text>

      {loading && plans.length === 0 ? (
        <ActivityIndicator size="large" color={theme.brand} />
      ) : (
        plans.map((plan) => {
          const active = mine?.isActive && mine.tier === plan.tierCode;
          return (
            <View
              key={plan.tierCode}
              style={[styles.planCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <View style={styles.planHead}>
                <Text style={[styles.planName, { color: theme.textPrimary }]}>{tierLabel(plan.tierCode)}</Text>
                {active ? (
                  <Text style={[styles.planActive, { color: theme.brand }]}>{t.membership.statusActive}</Text>
                ) : null}
              </View>

              <Text style={[styles.price, { color: theme.brand }]}>
                {plan.priceMonthly === '0.00' ? '免费' : `¥${plan.priceMonthly} / 月`}
              </Text>

              <Text style={[styles.section2, { color: theme.textSecondary }]}>{t.membership.perks}</Text>
              <PerkRow ok={plan.timedBroadcast} label={t.membership.timedBroadcast} />
              <PerkRow ok={plan.advancedWidget} label={t.membership.advancedWidget} onPress={() => router.push('/widgets')} />
              <PerkRow ok={plan.dailyBrief} label={t.membership.dailyBrief} />
              <PerkRow ok={plan.healthReport} label={t.membership.healthReport} />
              <PerkRow
                ok={plan.cityLimit == null}
                label={`${t.membership.cityLimit}：${plan.cityLimit == null ? t.membership.unlimited : plan.cityLimit}`}
              />
              <PerkRow
                ok={plan.careLimit > 1}
                label={`${t.membership.careLimit}：${plan.careLimit}`}
              />
              <PerkRow
                ok={plan.emergencyContactLimit > 1}
                label={`${t.membership.emergencyContact}：${plan.emergencyContactLimit}`}
              />
              <PerkRow
                ok={plan.aiCompanionQuota > 0}
                label={`${t.membership.aiCompanion}：${plan.aiCompanionQuota > 0 ? plan.aiCompanionQuota : t.membership.unlimited}`}
              />

              {active ? (
                <Button title={t.membership.statusActive} variant="secondary" disabled onPress={() => undefined} block />
              ) : plan.tierCode === 'free' ? (
                <Button title="免费" variant="secondary" disabled onPress={() => undefined} block />
              ) : (
                <Button
                  title={upgrading === plan.tierCode ? t.membership.upgrading : t.membership.upgrade}
                  onPress={() => onUpgrade(plan.tierCode)}
                  disabled={upgrading !== null}
                  block
                />
              )}
            </View>
          );
        })
      )}

      <Text style={[styles.hint, { color: theme.textSecondary }]}>{t.membership.upgradeHint}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  title: { fontSize: fontSize.title, fontWeight: '700' },
  empty: { fontSize: fontSize.body, textAlign: 'center' },
  statusCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.lg, alignItems: 'center', gap: spacing.xs },
  statusLabel: { fontSize: fontSize.body },
  statusValue: { fontSize: fontSize.heading, fontWeight: '700' },
  statusExp: { fontSize: fontSize.caption },
  section: { fontSize: fontSize.heading, fontWeight: '700', marginTop: spacing.sm },
  section2: { fontSize: fontSize.body, marginTop: spacing.sm },
  planCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  planHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planName: { fontSize: fontSize.heading, fontWeight: '700' },
  planActive: { fontSize: fontSize.body, fontWeight: '600' },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  timeChip: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  timeChipText: { fontSize: fontSize.body },
  price: { fontSize: fontSize.heading, fontWeight: '700', marginVertical: spacing.xs },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  perkArrow: { fontSize: fontSize.body, marginLeft: 'auto' },
  perkMark: { fontSize: fontSize.body, width: 16 },
  perkLabel: { fontSize: fontSize.body },
  hint: { fontSize: fontSize.caption, textAlign: 'center', marginTop: spacing.sm },
});
