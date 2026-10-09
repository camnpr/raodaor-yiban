import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../design/theme';
import { fontSize, radius, spacing } from '../../design/tokens';
import { useT } from '../../i18n';
import type { AirQuality } from '../../lib/weather-api';

/** AQI 等级配色（参考国标 HJ 633） */
const AQI_COLOR: Record<string, string> = {
  优: '#56C271',
  良: '#F2C94C',
  轻度污染: '#F2992E',
  中度污染: '#EB5757',
  重度污染: '#9B51E0',
  严重污染: '#7A2828',
};

/** 空气质量卡（独立模块：数据源不可用时由父级 AsyncSection 单独降级，不阻塞其它天气区块） */
export function AqiCard({ aqi }: { aqi: AirQuality }) {
  const theme = useTheme();
  const t = useT();
  const color = AQI_COLOR[aqi.category] ?? theme.textSecondary;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <Text style={[styles.title, { color: theme.textSecondary }]}>{t.weather.aqi}</Text>
      <View style={styles.row}>
        <Text style={[styles.value, { color }]}>{aqi.aqi}</Text>
        <Text style={[styles.category, { color }]}>{aqi.category}</Text>
      </View>
      {aqi.primary ? (
        <Text style={[styles.primary, { color: theme.textSecondary }]}>
          {aqi.primary}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs },
  title: { fontSize: fontSize.body, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  value: { fontSize: 40, fontWeight: '700' },
  category: { fontSize: fontSize.heading, fontWeight: '700' },
  primary: { fontSize: fontSize.body },
});
