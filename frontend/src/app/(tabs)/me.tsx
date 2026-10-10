import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, type Theme } from '../../design/theme';
import { fontSize, radius, spacing, touchMinHeight } from '../../design/tokens';
import { useT } from '../../i18n';
import type { Dict } from '../../i18n/locales/zh-CN';
import { useAuthStore } from '../../stores/auth-store';
import { Button } from '../../components/ui/button';
import { grantMembership, checkGrant, type GrantCheckResult } from '../../lib/admin-api';
import { ApiError } from '../../lib/api';

/** 我的（M1 骨架：展示登录态 + 登出；会员/设置后续里程碑补齐） */
export default function MeScreen() {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>{t.me.title}</Text>

      {session ? (
        <>
          <Text style={[styles.name, { color: theme.textPrimary }]}>{session.user.displayName}</Text>
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            {t.me.membership} · {t.me.settings} · {t.me.fontSize}
          </Text>
          <Pressable
            onPress={() => router.push('/care')}
            style={({ pressed }) => [
              styles.row,
              { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.rowText, { color: theme.textPrimary }]}>{t.care.title}</Text>
            <Text style={[styles.rowChevron, { color: theme.textSecondary }]}>›</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/membership')}
            style={({ pressed }) => [
              styles.row,
              { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.rowText, { color: theme.textPrimary }]}>{t.membership.title}</Text>
            <View style={styles.rowRight}>
              <Text
                style={[
                  styles.badge,
                  {
                    color: session.membership?.isActive ? theme.brand : theme.textSecondary,
                    borderColor: session.membership?.isActive ? theme.brand : theme.border,
                  },
                ]}
              >
                {session.membership?.isActive ? t.membership.statusActive : t.membership.statusFree}
              </Text>
              <Text style={[styles.rowChevron, { color: theme.textSecondary }]}>›</Text>
            </View>
          </Pressable>

          {session.capabilities.owner && <OwnerGrantCard />}

          <Button title={t.me.logout} variant="secondary" onPress={logout} block />
        </>
      ) : (
        <>
          <Text style={[styles.hint, { color: theme.textSecondary }]}>{t.me.guest}</Text>
          <Button title={t.me.login} onPress={() => router.push('/login')} block />
        </>
      )}
    </View>
  );
}

/** 运营补单卡片（仅 owner 角色可见；服务端二次鉴权 + 核销码已核销/不可重复校验） */
function OwnerGrantCard() {
  const theme = useTheme();
  const t = useT();
  const [userId, setUserId] = useState('');
  const [tierCode, setTierCode] = useState<'standard' | 'premium'>('standard');
  const [months, setMonths] = useState('1');
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 核销码状态查询（提交前展示，只读；最终仍以服务端 grant 为准）
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<GrantCheckResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  const monthsNum = Number(months);
  const codeCheckedIneligible = check != null && !check.eligible;
  const canSubmit =
    !!userId.trim() &&
    !!code.trim() &&
    Number.isInteger(monthsNum) &&
    monthsNum >= 1 &&
    monthsNum <= 36 &&
    !submitting &&
    !codeCheckedIneligible;

  const doCheck = async () => {
    const codeVal = code.trim();
    if (!codeVal) return;
    setChecking(true);
    setCheck(null);
    setCheckError(null);
    try {
      setCheck(await checkGrant(codeVal));
    } catch (e) {
      setCheckError(e instanceof ApiError ? e.message : t.admin.failed);
    } finally {
      setChecking(false);
    }
  };

  const doGrant = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await grantMembership({
        userId: userId.trim(),
        tierCode,
        months: monthsNum,
        externalOrderId: code.trim(),
        note: note.trim() || undefined,
      });
      Alert.alert(
        t.admin.success,
        `${res.userId} · ${res.tierCode} · ${new Date(res.expiresAt).toLocaleString()}`,
      );
      setCode('');
      setNote('');
      setCheck(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.admin.failed);
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = () => {
    Alert.alert(t.admin.confirmTitle, t.admin.confirmText, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.confirm, onPress: doGrant },
    ]);
  };

  return (
    <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{t.admin.sectionTitle}</Text>
      <Text style={[styles.cardHint, { color: theme.textSecondary }]}>{t.admin.sectionHint}</Text>

      <Text style={[styles.label, { color: theme.textPrimary }]}>{t.admin.userIdLabel}</Text>
      <TextInput
        style={[styles.input, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.background }]}
        value={userId}
        onChangeText={setUserId}
        placeholder={t.admin.userIdPlaceholder}
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={[styles.label, { color: theme.textPrimary }]}>{t.admin.tierLabel}</Text>
      <View style={styles.segmented}>
        <Pressable
          onPress={() => setTierCode('standard')}
          style={({ pressed }) => [
            styles.segment,
            {
              borderColor: theme.border,
              backgroundColor: tierCode === 'standard' ? theme.brand : theme.background,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={{ color: tierCode === 'standard' ? theme.brandOn : theme.textPrimary, fontWeight: '600' }}>
            {t.admin.standard}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTierCode('premium')}
          style={({ pressed }) => [
            styles.segment,
            {
              borderColor: theme.border,
              backgroundColor: tierCode === 'premium' ? theme.brand : theme.background,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={{ color: tierCode === 'premium' ? theme.brandOn : theme.textPrimary, fontWeight: '600' }}>
            {t.admin.premium}
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.label, { color: theme.textPrimary }]}>{t.admin.monthsLabel}</Text>
      <TextInput
        style={[styles.input, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.background }]}
        value={months}
        onChangeText={setMonths}
        placeholder={t.admin.monthsPlaceholder}
        placeholderTextColor={theme.textSecondary}
        keyboardType="number-pad"
      />

      <Text style={[styles.label, { color: theme.textPrimary }]}>{t.admin.codeLabel}</Text>
      <TextInput
        style={[styles.input, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.background }]}
        value={code}
        onChangeText={(v) => {
          setCode(v);
          setCheck(null);
          setCheckError(null);
        }}
        placeholder={t.admin.codePlaceholder}
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Button
        title={checking ? t.admin.checking : t.admin.checkButton}
        variant="secondary"
        onPress={doCheck}
        disabled={!code.trim() || checking}
        loading={checking}
        block
      />

      {checkError ? <Text style={[styles.error, { color: theme.danger }]}>{checkError}</Text> : null}
      {check && <GrantStatusView check={check} theme={theme} t={t} />}

      <Text style={[styles.label, { color: theme.textPrimary }]}>{t.admin.noteLabel}</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.background }]}
        value={note}
        onChangeText={setNote}
        placeholder={t.admin.notePlaceholder}
        placeholderTextColor={theme.textSecondary}
        multiline
      />

      {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

      <Button
        title={submitting ? t.admin.submitting : t.admin.submit}
        onPress={onSubmit}
        disabled={!canSubmit}
        loading={submitting}
        block
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, gap: spacing.md, justifyContent: 'center' },
  title: { fontSize: fontSize.title, fontWeight: '700', textAlign: 'center' },
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
  badge: { fontSize: fontSize.caption, borderWidth: 1, borderRadius: 999, paddingVertical: 2, paddingHorizontal: spacing.sm },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: fontSize.heading, fontWeight: '700' },
  cardHint: { fontSize: fontSize.caption, marginBottom: spacing.xs },
  label: { fontSize: fontSize.body, fontWeight: '600', marginTop: spacing.xs },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.body,
    minHeight: touchMinHeight,
  },
  inputMultiline: { minHeight: touchMinHeight * 2, textAlignVertical: 'top' },
  segmented: { flexDirection: 'row', gap: spacing.sm },
  segment: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchMinHeight,
  },
  error: { fontSize: fontSize.caption, marginTop: spacing.xs },
  checkBox: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  checkText: { fontSize: fontSize.body, fontWeight: '600' },
});

/** 核销码状态展示（只读查询结果；最终校验仍以服务端补单为准） */
function GrantStatusView({ check, theme, t }: { check: GrantCheckResult; theme: Theme; t: Dict }) {
  let text: string;
  let tone: 'success' | 'danger' | 'warning';
  if (!check.exists) {
    text = t.admin.notFound;
    tone = 'danger';
  } else if (check.granted) {
    text = t.admin.alreadyGranted;
    tone = 'warning';
  } else if (check.status !== 'VERIFIED') {
    const label =
      check.status === 'PENDING'
        ? t.admin.statusPending
        : check.status === 'FAILED'
          ? t.admin.statusFailed
          : String(check.status);
    text = `${label} · ${t.admin.notVerified}`;
    tone = 'danger';
  } else {
    text = `${t.admin.eligible} · ${t.admin.ownerLabel} ${check.subjectUserId ?? '-'} · ${t.admin.planLabel} ${check.targetPlan ?? '-'}`;
    tone = 'success';
  }
  const color = tone === 'success' ? theme.success : tone === 'warning' ? theme.warning : theme.danger;
  return (
    <View style={[styles.checkBox, { borderColor: color, backgroundColor: theme.surfaceMuted }]}>
      <Text style={[styles.checkText, { color }]}>{text}</Text>
    </View>
  );
}
