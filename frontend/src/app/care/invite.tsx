import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../design/theme';
import { fontSize, radius, spacing } from '../../design/tokens';
import { useT } from '../../i18n';
import { useAuthStore } from '../../stores/auth-store';
import { useCareStore } from '../../stores/care-store';
import { Button } from '../../components/ui/button';
import { QrCode } from '../../components/ui/qr-code';
import { SITE_URL } from '../../config';
import type { CareInvite } from '../../lib/care-api';

type Mode = 'guardian' | 'elder';

/** 亲情绑定（FR-C1）：守护人生成邀请码 / 长辈输入邀请码确认 */
export default function InviteScreen() {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; code?: string }>();
  const session = useAuthStore((s) => s.session);

  const createInvite = useCareStore((s) => s.createInvite);
  const acceptInvite = useCareStore((s) => s.acceptInvite);

  const [mode, setMode] = useState<Mode>(params.mode === 'elder' ? 'elder' : 'guardian');
  const [invite, setInvite] = useState<CareInvite | null>(null);
  const [code, setCode] = useState(params.code ? String(params.code).toUpperCase() : '');

  /** 分享链接：长辈扫码后直达绑定页并自动带入邀请码（Web 用当前源，便于本地调试；生产回退站点域） */
  const shareUrl = invite
    ? `${typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : SITE_URL
      }/care/invite?mode=elder&code=${encodeURIComponent(invite.code)}`
    : '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const onGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInvite(await createInvite());
    } catch (e) {
      setError(e instanceof Error ? e.message : t.care.invalidCode);
    } finally {
      setLoading(false);
    }
  }, [createInvite, t.care.invalidCode]);

  const onAccept = useCallback(async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError(t.care.codePlaceholder);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await acceptInvite(trimmed);
      setMessage(t.care.bindingSuccess);
      setTimeout(() => router.replace('/'), 1200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('已与该家人')) setError(t.care.alreadyBound);
      else setError(t.care.invalidCode);
    } finally {
      setLoading(false);
    }
  }, [code, acceptInvite, router, t]);

  const onCopy = useCallback(() => {
    if (!invite) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(invite.code).catch(() => undefined);
    }
    setMessage(t.care.codeCopied);
  }, [invite, t.care.codeCopied]);

  if (!session) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>{t.care.invite}</Text>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>{t.care.empty}</Text>
        <Button title={t.me.login} onPress={() => router.push('/login')} block />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: theme.textPrimary }]}>{t.care.invite}</Text>

      {/* 身份切换 */}
      <View style={[styles.segment, { borderColor: theme.border }]}>
        <Pressable
          onPress={() => setMode('guardian')}
          style={({ pressed }) => [
            styles.segmentBtn,
            { backgroundColor: mode === 'guardian' ? theme.brand : 'transparent', opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={[styles.segmentText, { color: mode === 'guardian' ? theme.brandOn : theme.textPrimary }]}>
            {t.care.generateCode}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('elder')}
          style={({ pressed }) => [
            styles.segmentBtn,
            { backgroundColor: mode === 'elder' ? theme.brand : 'transparent', opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={[styles.segmentText, { color: mode === 'elder' ? theme.brandOn : theme.textPrimary }]}>
            {t.care.enterCode}
          </Text>
        </Pressable>
      </View>

      {mode === 'guardian' ? (
        <View style={styles.block}>
          <Text style={[styles.hint, { color: theme.textSecondary }]}>{t.care.inviteHintGuardian}</Text>
          {invite ? (
            <>
              <View style={[styles.codeBox, { borderColor: theme.brand }]}>
                <Text style={[styles.code, { color: theme.brand }]}>{invite.code}</Text>
                <Pressable onPress={onCopy} hitSlop={12}>
                  <Text style={[styles.copy, { color: theme.brand }]}>{t.common.copy}</Text>
                </Pressable>
              </View>
              <QrCode value={shareUrl} size={220} />
              <Text style={[styles.qrTitle, { color: theme.textPrimary }]}>{t.care.qrTitle}</Text>
              <Text style={[styles.hint, { color: theme.textSecondary }]}>{t.care.qrHint}</Text>
            </>
          ) : null}
          {!invite && !loading ? (
            <Button title={t.care.generateCode} onPress={onGenerate} block />
          ) : null}
          {loading ? <ActivityIndicator color={theme.brand} /> : null}
        </View>
      ) : (
        <View style={styles.block}>
          <Text style={[styles.hint, { color: theme.textSecondary }]}>{t.care.inviteHintElder}</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.surface }]}
            placeholder={t.care.codePlaceholder}
            placeholderTextColor={theme.textSecondary}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            maxLength={24}
          />
          <Button title={t.care.accept} onPress={onAccept} block disabled={loading} loading={loading} />
        </View>
      )}

      {error ? (
        <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
      ) : null}
      {message ? (
        <Text style={[styles.message, { color: theme.success }]}>{message}</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  title: { fontSize: fontSize.title, fontWeight: '700', textAlign: 'center' },
  hint: { fontSize: fontSize.body, textAlign: 'center' },
  segment: { flexDirection: 'row', borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  segmentBtn: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  segmentText: { fontSize: fontSize.body, fontWeight: '700' },
  block: { gap: spacing.md, marginTop: spacing.sm },
  qrTitle: { fontSize: fontSize.heading, fontWeight: '700', textAlign: 'center', marginTop: spacing.sm },
  codeBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderRadius: radius.md, padding: spacing.lg },
  code: { fontSize: fontSize.title, fontWeight: '700', letterSpacing: 2 },
  copy: { fontSize: fontSize.body, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: fontSize.heading, letterSpacing: 2, textAlign: 'center' },
  error: { fontSize: fontSize.body, textAlign: 'center' },
  message: { fontSize: fontSize.body, textAlign: 'center' },
});
