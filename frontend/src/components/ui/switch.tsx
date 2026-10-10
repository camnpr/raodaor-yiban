import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../design/theme';

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

/** 适老开关（大触控目标；跟随主题色） */
export function Switch({ value, onValueChange, disabled }: SwitchProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => !disabled && onValueChange(!value)}
      style={({ pressed }) => [
        styles.track,
        {
          backgroundColor: value ? theme.brand : theme.border,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.thumb, { transform: [{ translateX: value ? 20 : 0 }] }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 52,
    height: 32,
    borderRadius: 16,
    padding: 2,
    justifyContent: 'center',
  },
  thumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
