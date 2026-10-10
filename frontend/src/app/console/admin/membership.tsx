import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../design/theme';
import { fontSize, radius, spacing, touchMinHeight } from '../../../design/tokens';
import { useT } from '../../../i18n';
import { ApiError } from '../../../lib/api';
import {
  listOrders,
  getBenefits,
  updateBenefit,
  type CheckoutOrder,
  type MembershipPlan,
  type UpdateBenefitInput,
} from '../../../lib/admin-api';
import { AppHeader } from '../../../components/ui/app-header';
import { Button } from '../../../components/ui/button';

const ORDER_STATUS_LABEL: Record<CheckoutOrder['status'], string> = {
  PENDING: '未核销',
  VERIFIED: '已核销',
  FAILED: '已失败',
};

const TIER_LABEL: Record<string, string> = { free: 'Free', standard: 'Standard', premium: 'Premium' };

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString() : '—';
}

/** 可编辑字段草稿（数字以字符串承载，空串 = null / 不修改） */
interface BenefitDraft {
  cityLimit: string;
  careLimit: string;
  emergencyContactLimit: string;
  aiCompanionQuota: string;
  timedBroadcast: boolean;
  advancedWidget: boolean;
  dailyBrief: boolean;
  healthReport: boolean;
  saving: boolean;
  saved: boolean;
}

function toDraft(p: MembershipPlan): BenefitDraft {
  return {
    cityLimit: p.cityLimit == null ? '' : String(p.cityLimit),
    careLimit: String(p.careLimit),
    emergencyContactLimit: String(p.emergencyContactLimit),
    aiCompanionQuota: String(p.aiCompanionQuota),
    timedBroadcast: p.timedBroadcast,
    advancedWidget: p.advancedWidget,
    dailyBrief: p.dailyBrief,
    healthReport: p.healthReport,
    saving: false,
    saved: false,
  };
}

function numOrNull(s: string): number | undefined {
  if (s.trim() === '') return undefined;
  const n = Number(s);
  return Number.isNaN(n) ? undefined : n;
}

function BenefitCard({
  plan,
  draft,
  onChange,
  onSave,
  theme,
  t,
}: {
  plan: MembershipPlan;
  draft: BenefitDraft;
  onChange: (patch: Partial<BenefitDraft>) => void;
  onSave: () => void;
  theme: ReturnType<typeof useTheme>;
  t: ReturnType<typeof useT>;
}) {
  const numField = (label: string, key: 'cityLimit' | 'careLimit' | 'emergencyContactLimit' | 'aiCompanionQuota') => (
    <View style={styles.fieldRow}>
      <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>{label}</Text>
      <TextInput
        style={[styles.numInput, { borderColor: theme.border, color: theme.textPrimary }]}
        value={draft[key]}
        onChangeText={(v) => onChange({ [key]: v } as Partial<BenefitDraft>)}
        keyboardType="number-pad"
        placeholder="—"
        placeholderTextColor={theme.textSecondary}
      />
    </View>
  );

  const toggle = (label: string, key: 'timedBroadcast' | 'advancedWidget' | 'dailyBrief' | 'healthReport') => (
    <Pressable
      onPress={() => onChange({ [key]: !draft[key] } as Partial<BenefitDraft>)}
      style={({ pressed }) => [styles.toggleRow, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>{label}</Text>
      <View style={[styles.toggle, { backgroundColor: draft[key] ? theme.success : theme.surfaceMuted, borderColor: theme.border }]}>
        <Text style={{ color: draft[key] ? theme.brandOn : theme.textSecondary, fontSize: fontSize.caption }}>
          {draft[key] ? '✓' : '✕'}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.planCard, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <View style={styles.planHead}>
        <Text style={[styles.planTitle, { color: theme.textPrimary }]}>
          {TIER_LABEL[plan.tierCode] ?? plan.tierCode}
        </Text>
        <Text style={[styles.planPrice, { color: theme.textSecondary }]}>
          ¥{plan.priceMonthly} / 月
        </Text>
      </View>

      {numField('城市上限', 'cityLimit')}
      {numField('亲情上限', 'careLimit')}
      {numField('紧急联系人', 'emergencyContactLimit')}
      {numField('AI 陪伴额度', 'aiCompanionQuota')}
      {toggle('定时播报', 'timedBroadcast')}
      {toggle('高级组件', 'advancedWidget')}
      {toggle('每日简报', 'dailyBrief')}
      {toggle('健康周报', 'healthReport')}

      <Text style={[styles.priceNote, { color: theme.textSecondary }]}>{t.admin.benefitPriceNote}</Text>

      <Button
        title={draft.saving ? t.admin.benefitSaving : draft.saved ? t.admin.benefitSaved : t.admin.benefitSave}
        variant="primary"
        onPress={onSave}
        disabled={draft.saving || draft.saved}
        loading={draft.saving}
        block
      />
    </View>
  );
}

export default function AdminMembershipScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();

  const [orders, setOrders] = useState<CheckoutOrder[]>([]);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersLoadingMore, setOrdersLoadingMore] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [drafts, setDrafts] = useState<Record<string, BenefitDraft>>({});
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setOrdersLoading(true);
    setPlansLoading(true);
    Promise.all([
      listOrders({ page: 1, pageSize: 20 }),
      getBenefits(),
    ])
      .then(([orderRes, planList]) => {
        if (!active) return;
        setOrders(orderRes.items);
        setOrdersTotal(orderRes.total);
        setOrdersPage(orderRes.page);
        setPlans(planList);
        setDrafts(Object.fromEntries(planList.map((p) => [p.tierCode, toDraft(p)])));
      })
      .catch((e) => {
        if (!active) return;
        const msg = e instanceof ApiError ? e.message : '加载失败';
        setOrdersError(msg);
        setPlansError(msg);
      })
      .finally(() => {
        if (!active) return;
        setOrdersLoading(false);
        setPlansLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const loadMoreOrders = () => {
    if (ordersLoadingMore || orders.length >= ordersTotal) return;
    setOrdersLoadingMore(true);
    listOrders({ page: ordersPage + 1, pageSize: 20 })
      .then((res) => {
        setOrders((prev) => [...prev, ...res.items]);
        setOrdersTotal(res.total);
        setOrdersPage(res.page);
      })
      .catch((e) => setOrdersError(e instanceof ApiError ? e.message : '加载失败'))
      .finally(() => setOrdersLoadingMore(false));
  };

  const patchDraft = (tierCode: string, patch: Partial<BenefitDraft>) =>
    setDrafts((prev) => ({ ...prev, [tierCode]: { ...prev[tierCode], ...patch, saved: false } }));

  const saveBenefit = (plan: MembershipPlan) => {
    const d = drafts[plan.tierCode];
    if (!d) return;
    const patch: UpdateBenefitInput = {};
    // cityLimit：空串 = 不限（null）
    const cityRaw = d.cityLimit.trim();
    if (cityRaw === '') {
      if (plan.cityLimit !== null) patch.cityLimit = null;
    } else {
      const cn = Number(cityRaw);
      if (!Number.isNaN(cn) && cn !== plan.cityLimit) patch.cityLimit = cn;
    }
    const careLimit = numOrNull(d.careLimit);
    if (careLimit !== undefined && careLimit !== plan.careLimit) patch.careLimit = careLimit;
    const emergency = numOrNull(d.emergencyContactLimit);
    if (emergency !== undefined && emergency !== plan.emergencyContactLimit) patch.emergencyContactLimit = emergency;
    const ai = numOrNull(d.aiCompanionQuota);
    if (ai !== undefined && ai !== plan.aiCompanionQuota) patch.aiCompanionQuota = ai;
    if (d.timedBroadcast !== plan.timedBroadcast) patch.timedBroadcast = d.timedBroadcast;
    if (d.advancedWidget !== plan.advancedWidget) patch.advancedWidget = d.advancedWidget;
    if (d.dailyBrief !== plan.dailyBrief) patch.dailyBrief = d.dailyBrief;
    if (d.healthReport !== plan.healthReport) patch.healthReport = d.healthReport;

    if (Object.keys(patch).length === 0) {
      setDrafts((prev) => ({ ...prev, [plan.tierCode]: { ...prev[plan.tierCode], saved: true } }));
      return;
    }

    setDrafts((prev) => ({ ...prev, [plan.tierCode]: { ...prev[plan.tierCode], saving: true } }));
    updateBenefit(plan.tierCode, patch)
      .then((updated) => {
        setPlans((prev) => prev.map((p) => (p.tierCode === updated.tierCode ? updated : p)));
        setDrafts((prev) => ({ ...prev, [updated.tierCode]: { ...toDraft(updated), saved: true } }));
      })
      .catch((e) => {
        setDrafts((prev) => ({ ...prev, [plan.tierCode]: { ...prev[plan.tierCode], saving: false } }));
        setPlansError(e instanceof ApiError ? e.message : '保存失败');
      });
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <AppHeader title={t.admin.membership} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      >
        {/* 运营补单入口 */}
        <Pressable
          onPress={() => router.push('/console/admin/grant' as never)}
          style={({ pressed }) => [styles.grantRow, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={[styles.grantText, { color: theme.textPrimary }]}>{t.admin.grantItem}</Text>
          <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text>
        </Pressable>

        {/* 订阅订单 */}
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t.admin.orders}</Text>
        {ordersLoading ? (
          <ActivityIndicator color={theme.brand} />
        ) : ordersError ? (
          <Text style={[styles.error, { color: theme.danger }]}>{ordersError}</Text>
        ) : orders.length === 0 ? (
          <Text style={[styles.empty, { color: theme.textSecondary }]}>{t.admin.emptyData}</Text>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(o) => o.id}
            scrollEnabled={false}
            contentContainerStyle={styles.orderList}
            renderItem={({ item }) => (
              <View style={[styles.orderRow, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                <View style={styles.orderMain}>
                  <Text style={[styles.orderPlan, { color: theme.textPrimary }]}>
                    {TIER_LABEL[item.targetPlan] ?? item.targetPlan}
                  </Text>
                  <Text style={[styles.orderSub, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.subjectType}:{item.subjectId}
                    {item.externalOrderId ? ` · ${item.externalOrderId}` : ''}
                  </Text>
                </View>
                <View style={styles.orderRight}>
                  <Text style={[styles.orderAmount, { color: theme.textPrimary }]}>
                    {item.currency} {item.amount}
                  </Text>
                  <Text
                    style={[
                      styles.orderStatus,
                      { color: item.status === 'VERIFIED' ? theme.success : item.status === 'FAILED' ? theme.danger : theme.warning },
                    ]}
                  >
                    {ORDER_STATUS_LABEL[item.status] ?? item.status}
                  </Text>
                  <Text style={[styles.orderGranted, { color: theme.textSecondary }]}>
                    {item.grantedAt ? fmtDate(item.grantedAt) : '—'}
                  </Text>
                </View>
              </View>
            )}
            ListFooterComponent={
              orders.length < ordersTotal ? (
                <Button
                  title={ordersLoadingMore ? t.admin.loading : t.admin.loadMore}
                  variant="secondary"
                  onPress={loadMoreOrders}
                  disabled={ordersLoadingMore}
                  loading={ordersLoadingMore}
                  block
                />
              ) : null
            }
          />
        )}

        {/* 权益映射 */}
        <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginTop: spacing.lg }]}>
          {t.admin.benefits}
        </Text>
        {plansLoading ? (
          <ActivityIndicator color={theme.brand} />
        ) : plansError ? (
          <Text style={[styles.error, { color: theme.danger }]}>{plansError}</Text>
        ) : (
          plans.map((plan) => (
            <BenefitCard
              key={plan.tierCode}
              plan={plan}
              draft={drafts[plan.tierCode]}
              onChange={(patch) => patchDraft(plan.tierCode, patch)}
              onSave={() => saveBenefit(plan)}
              theme={theme}
              t={t}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.md },
  grantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
  },
  grantText: { fontSize: fontSize.body, fontWeight: '600' },
  chevron: { fontSize: 22 },
  sectionTitle: { fontSize: fontSize.heading, fontWeight: '700' },
  error: { fontSize: fontSize.body },
  empty: { fontSize: fontSize.body, textAlign: 'center' },
  orderList: { gap: spacing.sm },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
  },
  orderMain: { flex: 1, gap: 2 },
  orderPlan: { fontSize: fontSize.body, fontWeight: '600' },
  orderSub: { fontSize: fontSize.caption },
  orderRight: { alignItems: 'flex-end', gap: 2 },
  orderAmount: { fontSize: fontSize.body, fontWeight: '600' },
  orderStatus: { fontSize: fontSize.caption },
  orderGranted: { fontSize: fontSize.caption },
  planCard: { borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: spacing.sm },
  planHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planTitle: { fontSize: fontSize.heading, fontWeight: '700' },
  planPrice: { fontSize: fontSize.caption },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { fontSize: fontSize.body },
  numInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: touchMinHeight,
    width: 120,
    textAlign: 'right',
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggle: { width: 44, height: 28, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  priceNote: { fontSize: fontSize.caption, fontStyle: 'italic' },
});
