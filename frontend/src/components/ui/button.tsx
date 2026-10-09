import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { useTheme } from '../../design/theme';
import { fontSize, radius, spacing, touchMinHeight } from '../../design/tokens';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

/** 基础按钮（适老大触控目标 ≥56dp；primary 品牌暖橙实底，secondary 描边） */
export function Button({ title, onPress, variant = 'primary', block, disabled, loading, style }: ButtonProps) {
  const theme = useTheme();
  const isPrimary = variant === 'primary';
  const bg = isPrimary ? theme.brand : 'transparent';
  const borderColor = isPrimary ? theme.brand : theme.border;
  const textColor = isPrimary ? theme.brandOn : theme.textPrimary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, borderColor, opacity: pressed || disabled ? 0.65 : 1 },
        block && styles.block,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.text, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchMinHeight,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  block: { width: '100%' },
  text: { fontSize: fontSize.heading, fontWeight: '700' },
});
