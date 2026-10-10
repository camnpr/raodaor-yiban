import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../design/theme';
import { fontSize, spacing } from '../design/tokens';
import { useT } from '../i18n';
import { AppHeader } from '../components/ui/app-header';

/** 隐私政策（FR-G6 / FR-G7）：双语全文展示 */
export default function PrivacyScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const paragraphs = t.privacy.body.split('\n\n');

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <AppHeader title={t.privacy.title} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      >
        {paragraphs.map((p, i) => (
          <Text key={i} style={[styles.paragraph, { color: theme.textPrimary }]}>
            {p}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.lg },
  paragraph: { fontSize: fontSize.body, lineHeight: fontSize.body * 1.6 },
});
