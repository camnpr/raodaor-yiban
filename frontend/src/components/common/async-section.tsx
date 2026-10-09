import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../design/theme';
import { fontSize, radius, spacing } from '../../design/tokens';
import { useT } from '../../i18n';
import type { ResourceState } from '../../hooks/use-resource';

interface Props<T> {
  resource: ResourceState<T>;
  /** 数据就绪后的渲染；data 可能为 null（当 emptyIsData 时代表“空数据”）。以函数式 children 传入 */
  children: (data: T) => ReactNode;
  /**
   * 占位最小高度。
   * - 设为 0 可用于“无数据时本就不该占空间”的区块（如预警：无预警时整块消失）。
   */
  minHeight?: number;
  /**
   * 当数据源合法返回 null（如“该地区无空气质量数据”）也视为已加载完成，
   * 交给 render 自行决定渲染（通常返回 null 不占空间）。
   */
  emptyIsData?: boolean;
}

/**
 * 独立区块容器：
 * - 加载中且无数据 → 骨架（居中 spinner）；
 * - 出错且无数据 → 内联错误文案 + 重试按钮（仅影响本区块）；
 * - 数据就绪 → 渲染内容。
 * 任一区块失败都不会影响页面其它区块展示。
 */
export function AsyncSection<T>({ resource, children, minHeight = 80, emptyIsData = false }: Props<T>) {
  const theme = useTheme();
  const t = useT();
  const { data, loading, error, reload } = resource;

  if (error) {
    return (
      <View style={[styles.box, { backgroundColor: theme.surface, minHeight }]}>
        <Text style={[styles.msg, { color: theme.textSecondary }]} numberOfLines={2}>
          {error}
        </Text>
        <Pressable
          onPress={reload}
          hitSlop={12}
          style={({ pressed }) => [styles.retry, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.retryText, { color: theme.brand }]}>{t.common.retry}</Text>
        </Pressable>
      </View>
    );
  }

  if (data === null && !emptyIsData) {
    return (
      <View style={[styles.box, { backgroundColor: theme.surface, minHeight }]}>
        <ActivityIndicator size="small" color={theme.brand} />
      </View>
    );
  }

  return <>{children(data as T)}</>;
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  msg: { fontSize: fontSize.body, textAlign: 'center' },
  retry: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  retryText: { fontSize: fontSize.body, fontWeight: '700' },
});
