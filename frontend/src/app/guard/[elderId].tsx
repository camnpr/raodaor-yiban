import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../design/theme';
import { fontSize, spacing } from '../../design/tokens';
import { useI18nStore, useT } from '../../i18n';
import { stopSpeaking, speakText } from '../../lib/speech';
import { getElderWeather, type ElderWeather } from '../../lib/care-api';
import { useCareStore } from '../../stores/care-store';
import { AlertBanner } from '../../components/weather/alert-banner';
import { WeatherNowCard } from '../../components/weather/weather-now-card';
import { HourlyStrip } from '../../components/weather/hourly-strip';
import { DailyList } from '../../components/weather/daily-list';
import { Button } from '../../components/ui/button';

/** 长辈详情（子女端，FR-C3）：长辈城市实时天气 + 逐小时 + 15 天 + 预警 */
export default function GuardElderScreen() {
  const theme = useTheme();
  const t = useT();
  const locale = useI18nStore((s) => s.locale);
  const router = useRouter();
  const { elderId } = useLocalSearchParams<{ elderId: string }>();

  const removeRelationship = useCareStore((s) => s.removeRelationship);
  const [data, setData] = useState<ElderWeather | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!elderId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getElderWeather(elderId);
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t.guard.loading);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [elderId, t.guard.loading]);

  const onSpeak = useCallback(() => {
    if (!data?.now || !data.city) return;
    stopSpeaking();
    setSpeaking(true);
    const alertText = data.alerts.length
      ? `，有${data.alerts.length}条天气预警，请注意防范`
      : '';
    const text =
      `${data.elder.displayName}，${data.city.name}，当前${data.now.text}，气温${data.now.temp}度，` +
      `体感${data.now.feelsLike}度，湿度百分之${data.now.humidity}，` +
      `${data.now.windDir}${data.now.windScale}级${alertText}。`;
    speakText(text, locale);
    setTimeout(() => setSpeaking(false), 1500);
  }, [data, locale]);

  const onUnbind = useCallback(() => {
    Alert.alert(t.care.unbind, t.guard.unbindConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.care.unbind,
        style: 'destructive',
        onPress: () => {
          void removeRelationship(data!.elder.id);
          router.back();
        },
      },
    ]);
  }, [t, data, removeRelationship, router]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.back, { color: theme.brand }]}>‹ {t.common.back}</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          {data?.elder.displayName ?? t.guard.title}
        </Text>
        <View style={{ width: 56 }} />
      </View>

      {loading && !data ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.brand} />
          <Text style={[styles.hint, { color: theme.textSecondary }]}>{t.guard.loading}</Text>
        </View>
      ) : error && !data ? (
        <Text style={[styles.hint, { color: theme.danger }]}>{error}</Text>
      ) : data && !data.city ? (
        <View style={styles.center}>
          <Text style={[styles.hint, { color: theme.textSecondary }]}>{t.guard.noCity}</Text>
        </View>
      ) : data ? (
        <>
          {data.alerts.length ? <AlertBanner alerts={data.alerts} /> : null}
          {data.now && data.city ? (
            <WeatherNowCard
              cityName={data.city.name}
              now={data.now}
              aqi={data.aqi}
              onSpeak={onSpeak}
              speaking={speaking}
            />
          ) : null}
          <HourlyStrip hourly={data.hourly} />
          <DailyList daily={data.daily} />
          <Button title={t.care.unbind} variant="secondary" onPress={onUnbind} block />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: fontSize.heading, fontWeight: '700' },
  title: { fontSize: fontSize.heading, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
  center: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  hint: { fontSize: fontSize.body, textAlign: 'center' },
});
