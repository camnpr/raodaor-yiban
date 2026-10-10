import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { fontSize, spacing, touchMinHeight } from '../../design/tokens';

export interface AppHeaderProps {
  title: string;
  subtitle?: string;
  /** 是否显示返回按钮（默认 true）。登录等根页可置 false */
  showBack?: boolean;
  /** 自定义返回行为；缺省为 router.back()，无历史时回退到标签栏首页 */
  onBack?: () => void;
  /** 右侧操作区（如图标按钮、文字按钮） */
  right?: ReactNode;
}

/**
 * 统一顶部导航栏（适老：大触控目标、清晰返回、安全区避让）。
 * 用于所有页面（含二级/三级页），提供一致的返回与标题体验。
 */
export function AppHeader({ title, subtitle, showBack = true, onBack, right }: AppHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  return (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top, backgroundColor: theme.surface, borderBottomColor: theme.border },
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.side, styles.sideLeft]}>
          {showBack ? (
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="返回"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => [styles.back, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="chevron-back" size={26} color={theme.brand} />
              <Text style={[styles.backText, { color: theme.brand }]}>返回</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={[styles.side, styles.sideRight]}>{right ?? null}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { width: '100%', borderBottomWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: touchMinHeight, paddingHorizontal: spacing.md },
  side: { justifyContent: 'center', flexShrink: 0 },
  sideLeft: { alignItems: 'flex-start' },
  sideRight: { alignItems: 'flex-end' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: spacing.xs, paddingRight: spacing.sm },
  backText: { fontSize: fontSize.body, fontWeight: '700' },
  titleWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSize.heading, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: fontSize.caption, textAlign: 'center', marginTop: 2 },
});
