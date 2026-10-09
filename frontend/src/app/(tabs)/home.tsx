import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../design/theme';
import { fontSize, spacing } from '../../design/tokens';
import { useI18nStore, useT } from '../../i18n';
import { useAuthStore } from '../../stores/auth-store';
import { useWeatherStore } from '../../stores/weather-store';
import { getLocatedCity } from '../../lib/location';
import { speakText, stopSpeaking } from '../../lib/speech';
import {
  fetchAirQuality,
  fetchAlerts,
  fetchDaily,
  fetchHourly,
  fetchWeatherNow,
  type AirQuality,
  type DailyItem,
  type HourlyItem,
  type WeatherAlert,
  type WeatherNow,
} from '../../lib/weather-api';
import { AlertBanner } from '../../components/weather/alert-banner';
import { WeatherNowCard } from '../../components/weather/weather-now-card';
import { HourlyStrip } from '../../components/weather/hourly-strip';
import { DailyList } from '../../components/weather/daily-list';

interface WeatherBundle {
  now: WeatherNow;
  hourly: HourlyItem[];
  daily: DailyItem[];
  alerts: WeatherAlert[];
  aqi: AirQuality | null;
}

/** 天气首页（M2 核心）：大字实时 + 预警 + 逐小时 + 15 天 + 语音播报 */
export default function HomeScreen() {
  const theme = useTheme();
  const t = useT();
  const locale = useI18nStore((s) => s.locale);
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const currentCity = useWeatherStore((s) => s.currentCity);
  const loadCities = useWeatherStore((s) => s.loadCities);
  const setCurrentCity = useWeatherStore((s) => s.setCurrentCity);

  const [bundle, setBundle] = useState<WeatherBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // 初始化当前城市：登录优先收藏默认城市，无则定位；游客走定位
  useEffect(() => {
    void (async () => {
      if (useWeatherStore.getState().currentCity) return;
      if (session) {
        await loadCities();
        if (!useWeatherStore.getState().currentCity) {
          const located = await getLocatedCity();
          if (located) setCurrentCity(located);
        }
      } else {
        const located = await getLocatedCity();
        if (located) setCurrentCity(located);
      }
    })();
  }, [session, loadCities, setCurrentCity]);

  // 拉取天气（当前城市或重试变化时）
  useEffect(() => {
    if (!currentCity) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [now, hourly, daily, alerts, aqi] = await Promise.all([
          fetchWeatherNow(currentCity.lon, currentCity.lat),
          fetchHourly(currentCity.lon, currentCity.lat),
          fetchDaily(currentCity.lon, currentCity.lat),
          fetchAlerts(currentCity.lon, currentCity.lat),
          fetchAirQuality(currentCity.lon, currentCity.lat),
        ]);
        if (!cancelled) setBundle({ now, hourly, daily, alerts, aqi });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t.home.loadFailed);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentCity, refreshKey, t.home.loadFailed]);

  const onSpeak = useCallback(() => {
    if (!bundle || !currentCity) return;
    stopSpeaking();
    setSpeaking(true);
    const alertText = bundle.alerts.length
      ? `，有${bundle.alerts.length}条天气预警，请注意防范`
      : '';
    const text =
      `${currentCity.name}，当前${bundle.now.text}，气温${bundle.now.temp}度，` +
      `体感${bundle.now.feelsLike}度，湿度百分之${bundle.now.humidity}，` +
      `${bundle.now.windDir}${bundle.now.windScale}级${alertText}。`;
    speakText(text, locale);
    setTimeout(() => setSpeaking(false), 1500);
  }, [bundle, currentCity, locale]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={[styles.cityName, { color: theme.textPrimary }]}>
          {currentCity?.name ?? t.weather.noCity}
        </Text>
        <Pressable onPress={() => router.push('/cities')} hitSlop={12}>
          <Text style={[styles.changeCity, { color: theme.brand }]}>
            {currentCity ? t.weather.changeCity : t.weather.selectCity}
          </Text>
        </Pressable>
      </View>

      {!currentCity ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.brand} />
          <Text style={[styles.centerText, { color: theme.textSecondary }]}>
            {t.weather.obtainingLocation}
          </Text>
          <Pressable onPress={() => router.push('/cities')} hitSlop={12}>
            <Text style={[styles.link, { color: theme.brand }]}>{t.weather.selectCity}</Text>
          </Pressable>
        </View>
      ) : loading && !bundle ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.brand} />
          <Text style={[styles.centerText, { color: theme.textSecondary }]}>{t.common.loading}</Text>
        </View>
      ) : error && !bundle ? (
        <View style={styles.center}>
          <Text style={[styles.centerText, { color: theme.textSecondary }]}>{error}</Text>
          <Pressable onPress={() => setRefreshKey((k) => k + 1)} hitSlop={12}>
            <Text style={[styles.link, { color: theme.brand }]}>{t.common.retry}</Text>
          </Pressable>
        </View>
      ) : bundle ? (
        <>
          <AlertBanner alerts={bundle.alerts} />
          <WeatherNowCard
            cityName={currentCity?.name ?? ''}
            now={bundle.now}
            aqi={bundle.aqi}
            onSpeak={onSpeak}
            speaking={speaking}
          />
          <HourlyStrip hourly={bundle.hourly} />
          <DailyList daily={bundle.daily} />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cityName: { fontSize: fontSize.title, fontWeight: '700' },
  changeCity: { fontSize: fontSize.body, fontWeight: '600' },
  center: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  centerText: { fontSize: fontSize.body },
  link: { fontSize: fontSize.body, fontWeight: '700' },
});
