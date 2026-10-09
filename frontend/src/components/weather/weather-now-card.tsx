import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../design/theme';
import { fontSize, radius, spacing } from '../../design/tokens';
import { useT } from '../../i18n';
import { weatherEmoji } from '../../lib/weather-format';
import type { AirQuality, WeatherNow } from '../../lib/weather-api';
import { Button } from '../ui/button';

interface Props {
  cityName: string;
  now: WeatherNow;
  aqi: AirQuality | null;
  onSpeak: () => void;
  speaking: boolean;
}

/** 大字实时天气卡（FR-W1：温度大字、口语化、语音播报） */
export function WeatherNowCard({ cityName, now, aqi, onSpeak, speaking }: Props) {
  const theme = useTheme();
  const t = useT();

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <Text style={[styles.city, { color: theme.textPrimary }]}>{cityName}</Text>

      <View style={styles.mainRow}>
        <Text style={styles.emoji}>{weatherEmoji(now.icon)}</Text>
        <Text style={[styles.temp, { color: theme.textPrimary }]}>{now.temp}°</Text>
      </View>
      <Text style={[styles.text, { color: theme.textPrimary }]}>
        {now.text} · {t.weather.feelsLike} {now.feelsLike}°
      </Text>

      {aqi ? (
        <Text style={[styles.aqi, { color: theme.textSecondary }]}>
          {t.weather.aqi} {aqi.category}（AQI {aqi.aqi}）
        </Text>
      ) : null}

      <View style={styles.details}>
        <Text style={[styles.detail, { color: theme.textSecondary }]}>
          {t.weather.humidity} {now.humidity}%
        </Text>
        <Text style={[styles.detail, { color: theme.textSecondary }]}>
          {t.weather.wind} {now.windDir} {now.windScale}级
        </Text>
        <Text style={[styles.detail, { color: theme.textSecondary }]}>
          {t.weather.precip} {now.precip}mm
        </Text>
      </View>

      <Button title={t.weather.voice} onPress={onSpeak} disabled={speaking} block />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm },
  city: { fontSize: fontSize.heading, fontWeight: '700', textAlign: 'center' },
  mainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emoji: { fontSize: 64 },
  temp: { fontSize: 72, fontWeight: '700' },
  text: { fontSize: fontSize.heading, textAlign: 'center' },
  aqi: { fontSize: fontSize.body, textAlign: 'center' },
  details: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.xs },
  detail: { fontSize: fontSize.body },
});
