import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, type Theme } from '../../../design/theme';
import { fontSize, radius, spacing, touchMinHeight } from '../../../design/tokens';
import { useT } from '../../../i18n';
import type { Dict } from '../../../i18n/locales/zh-CN';
import { Button } from '../../../components/ui/button';
import { AppHeader } from '../../../components/ui/app-header';
import { grantMembership, checkGrant, type GrantCheckResult } from '../../../lib/admin-api';
import { ApiError } from '../../../lib/api';

/** 运营补单（运营后台专属；服务端二次鉴权 + 核销码已核销/不可重复校验） */
export default function AdminGrantScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <AppHeader title={t.admin.sectionTitle} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      >
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.sm, paddingBottom: spacing.xxl },
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
