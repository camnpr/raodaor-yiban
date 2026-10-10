import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../design/theme';
import { fontSize, radius, spacing } from '../../design/tokens';
import { useT } from '../../i18n';
import type { LifeIndex } from '../../lib/weather-api';

/** 指数类型 → emoji（适老友好，无需额外图标依赖） */
const INDEX_ICON: Record<string, string> = {
  '1': '🏃', // 运动
  '2': '🚗', // 洗车
  '3': '👕', // 穿衣
  '5': '🌞', // 紫外线
  '8': '😊', // 舒适度
  '9': '🤧', // 感冒
};
const INDEX_ICON_FALLBACK = '📋';

/**
 * 生活指数卡（FR-W5）：穿衣 / 洗车 / 运动 / 紫外线 / 舒适度 / 感冒等。
 * 适老化：大字号、每项名称 + 等级高对比、建议文案完整展示（不截断），竖向列表避免网格错位。
 * 数据源返回的名称 / 等级 / 文案已为中文，按 type 仅补一个装饰 emoji。
 */
export function LifeIndexCard({ indices }: { indices: LifeIndex[] }) {
  const theme = useTheme();
  const t = useT();

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <Text style={[styles.title, { color: theme.textSecondary }]}>{t.weather.lifeIndex}</Text>
      {indices.map((item, idx) => (
        <View
          key={item.type}
          style={[
            styles.row,
            idx > 0 && { borderTopColor: theme.border, borderTopWidth: 1 },
          ]}
        >
          <Text style={styles.icon}>{INDEX_ICON[item.type] ?? INDEX_ICON_FALLBACK}</Text>
          <View style={styles.body}>
            <View style={styles.head}>
              <Text style={[styles.name, { color: theme.textPrimary }]}>{item.name}</Text>
              <Text style={[styles.category, { color: theme.brand }]}>{item.category}</Text>
            </View>
            <Text style={[styles.text, { color: theme.textSecondary }]}>{item.text}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: fontSize.body, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.md },
  icon: { fontSize: 26, lineHeight: 32 },
  body: { flex: 1, gap: spacing.xs },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  name: { fontSize: fontSize.heading, fontWeight: '700' },
  category: { fontSize: fontSize.body, fontWeight: '700' },
  text: { fontSize: fontSize.body, lineHeight: fontSize.body * 1.4 },
});
