import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../design/theme';
import { fontSize, radius, spacing } from '../../design/tokens';
import { useT } from '../../i18n';
import { weatherEmoji, weekday } from '../../lib/weather-format';
import type { DailyItem } from '../../lib/weather-api';

/** 逐天预报（FR-W3：15 天列表） */
export function DailyList({ daily }: { daily: DailyItem[] }) {
  const theme = useTheme();
  const t = useT();
  if (!daily.length) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>{t.weather.daily}</Text>
      {daily.map((d) => (
        <View key={d.fxDate} style={styles.row}>
          <Text style={[styles.weekday, { color: theme.textPrimary }]}>{weekday(d.fxDate)}</Text>
          <Text style={styles.icon}>{weatherEmoji(d.iconDay)}</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]} numberOfLines={1}>
            {d.textDay}
          </Text>
          <Text style={[styles.temp, { color: theme.textPrimary }]}>
            {d.tempMin}° / {d.tempMax}°
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: fontSize.heading, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  weekday: { fontSize: fontSize.body, width: 48, fontWeight: '700' },
  icon: { fontSize: 22 },
  text: { fontSize: fontSize.body, flex: 1 },
  temp: { fontSize: fontSize.body, fontWeight: '700' },
});
