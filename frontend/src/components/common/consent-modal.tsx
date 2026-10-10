import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../design/theme';
import { fontSize, radius, spacing } from '../../design/tokens';
import { useT } from '../../i18n';
import { useConsentStore } from '../../stores/consent-store';
import { Button } from '../ui/button';

/**
 * 首启隐私政策同意弹窗（FR-G6）：
 * - 同意 → 开放绑定/会员等需登录功能
 * - 暂不同意 → 关闭弹窗但保留限制（仅可浏览天气）
 */
export function ConsentModal() {
  const theme = useTheme();
  const t = useT();
  const agreed = useConsentStore((s) => s.agreed);
  const dismissed = useConsentStore((s) => s.dismissed);
  const setAgreed = useConsentStore((s) => s.setAgreed);
  const setDismissed = useConsentStore((s) => s.setDismissed);

  const visible = !agreed && !dismissed;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setDismissed(true)}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>{t.privacy.consentTitle}</Text>
          <ScrollView style={styles.body}>
            <Text style={[styles.text, { color: theme.textSecondary }]}>{t.privacy.consentText}</Text>
          </ScrollView>
          <View style={styles.actions}>
            <Button title={t.privacy.agree} onPress={() => setAgreed(true)} block />
            <Pressable
              onPress={() => setDismissed(true)}
              accessibilityRole="button"
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: spacing.md })}
            >
              <Text style={[styles.disagree, { color: theme.textSecondary }]}>{t.privacy.disagree}</Text>
              <Text style={[styles.hint, { color: theme.textSecondary }]}>{t.privacy.disagreeHint}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  card: {
    maxHeight: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  title: { fontSize: fontSize.title, fontWeight: '700', textAlign: 'center' },
  body: { maxHeight: 240 },
  text: { fontSize: fontSize.body, lineHeight: fontSize.body * 1.6 },
  actions: { gap: spacing.sm },
  disagree: { fontSize: fontSize.body, fontWeight: '600', textAlign: 'center' },
  hint: { fontSize: fontSize.caption, textAlign: 'center', marginTop: 2 },
});
