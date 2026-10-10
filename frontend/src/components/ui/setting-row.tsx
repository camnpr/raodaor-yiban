import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../design/theme';
import { fontSize, spacing } from '../../design/tokens';

interface SettingRowProps {
  label: string;
  description?: string;
  /** 右侧控件（如 Switch）；与 showChevron 互斥使用 */
  control?: ReactNode;
  /** 可点击跳转时显示右箭头 */
  showChevron?: boolean;
  onPress?: () => void;
}

/** 设置项行（适老：大触控目标、清晰标签与说明） */
export function SettingRow({ label, description, control, showChevron, onPress }: SettingRowProps) {
  const theme = useTheme();
  const interactive = Boolean(onPress);

  const inner = (
    <View style={[styles.row, { borderColor: theme.border }]}>
      <View style={styles.textWrap}>
        <Text style={[styles.label, { color: theme.textPrimary }]}>{label}</Text>
        {description ? (
          <Text style={[styles.desc, { color: theme.textSecondary }]}>{description}</Text>
        ) : null}
      </View>
      <View style={styles.right}>
        {control}
        {showChevron ? (
          <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text>
        ) : null}
      </View>
    </View>
  );

  if (!interactive) return inner;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.pressable, { opacity: pressed ? 0.7 : 1 }]}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { borderRadius: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.md,
  },
  textWrap: { flex: 1 },
  label: { fontSize: fontSize.body, fontWeight: '600' },
  desc: { fontSize: fontSize.caption, marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chevron: { fontSize: 22 },
});
