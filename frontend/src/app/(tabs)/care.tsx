import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../design/theme';
import { fontSize, spacing } from '../../design/tokens';
import { useT } from '../../i18n';

/** 亲情守护（M1 骨架；绑定关系 M3 落地） */
export default function CareScreen() {
  const theme = useTheme();
  const t = useT();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>{t.care.title}</Text>
      <Text style={[styles.empty, { color: theme.textSecondary }]}>{t.care.empty}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, gap: spacing.md, justifyContent: 'center' },
  title: { fontSize: fontSize.title, fontWeight: '700', textAlign: 'center' },
  empty: { fontSize: fontSize.body, textAlign: 'center' },
});
