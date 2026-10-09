import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../design/theme';
import { fontSize, radius, spacing } from '../../design/tokens';
import { useT } from '../../i18n';
import { hourOf, weatherEmoji } from '../../lib/weather-format';
import type { HourlyItem } from '../../lib/weather-api';

/** 逐小时预报（FR-W2：24 小时横向滑动） */
export function HourlyStrip({ hourly }: { hourly: HourlyItem[] }) {
  const theme = useTheme();
  const t = useT();
  if (!hourly.length) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>{t.weather.hourly}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {hourly.map((h) => (
          <View key={h.fxTime} style={styles.item}>
            <Text style={[styles.time, { color: theme.textSecondary }]}>{hourOf(h.fxTime)}</Text>
            <Text style={styles.icon}>{weatherEmoji(h.icon)}</Text>
            <Text style={[styles.temp, { color: theme.textPrimary }]}>{h.temp}°</Text>
            {h.pop && h.pop !== '0' ? (
              <Text style={[styles.pop, { color: '#4A90D9' }]}>{h.pop}%</Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: fontSize.heading, fontWeight: '700' },
  row: { gap: spacing.lg },
  item: { alignItems: 'center', gap: 2, minWidth: 48 },
  time: { fontSize: fontSize.caption },
  icon: { fontSize: 24 },
  temp: { fontSize: fontSize.body, fontWeight: '700' },
  pop: { fontSize: fontSize.caption },
});
