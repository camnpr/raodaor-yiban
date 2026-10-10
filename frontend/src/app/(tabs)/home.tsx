import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { AqiCard } from '../../components/weather/aqi-card';
import { HourlyStrip } from '../../components/weather/hourly-strip';
import { DailyList } from '../../components/weather/daily-list';
import { AsyncSection } from '../../components/common/async-section';
import { AppHeader } from '../../components/ui/app-header';
import { useResource } from '../../hooks/use-resource';

/** 天气首页（M2 核心）：各子模块独立加载/错误/重试，单模块失败不阻塞整页 */
export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const hydrated = useAuthStore((s) => s.hydrated);
  const t = useT();
  const locale = useI18nStore((s) => s.locale);
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const currentCity = useWeatherStore((s) => s.currentCity);
  const loadCities = useWeatherStore((s) => s.loadCities);
  const setCurrentCity = useWeatherStore((s) => s.setCurrentCity);

  const [speaking, setSpeaking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  const lon = currentCity?.lon;
  const lat = currentCity?.lat;
  const ready = lon != null && lat != null;

  // 每个子模块独立的数据源（互相隔离；单个失败仅该模块显示错误 + 重试）
  const now = useResource<WeatherNow>(() => fetchWeatherNow(lon!, lat!), [lon, lat], ready);
  const alerts = useResource<WeatherAlert[]>(() => fetchAlerts(lon!, lat!), [lon, lat], ready);
  const aqi = useResource<AirQuality | null>(() => fetchAirQuality(lon!, lat!), [lon, lat], ready);
  const hourly = useResource<HourlyItem[]>(() => fetchHourly(lon!, lat!), [lon, lat], ready);
  const daily = useResource<DailyItem[]>(() => fetchDaily(lon!, lat!), [lon, lat], ready);

  const resources = useMemo(() => [now, alerts, aqi, hourly, daily], [now, alerts, aqi, hourly, daily]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    resources.forEach((r) => r.reload());
  }, [resources]);

  // 所有模块都结束加载后，收起下拉刷新指示器
  useEffect(() => {
    if (refreshing && !resources.some((r) => r.loading)) setRefreshing(false);
  }, [refreshing, resources]);

  const onSpeak = useCallback(() => {
    if (!now.data || !currentCity) return;
    stopSpeaking();
    setSpeaking(true);
    const alertText = now.data && alerts.data?.length
      ? `，有${alerts.data.length}条天气预警，请注意防范`
      : '';
    const text =
      `${currentCity.name}，当前${now.data.text}，气温${now.data.temp}度，` +
      `体感${now.data.feelsLike}度，湿度百分之${now.data.humidity}，` +
      `${now.data.windDir}${now.data.windScale}级${alertText}。`;
    speakText(text, locale);
    setTimeout(() => setSpeaking(false), 1500);
  }, [now.data, alerts.data, currentCity, locale]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <AppHeader
        title={currentCity?.name ?? t.weather.noCity}
        showBack={false}
        right={
          <Pressable onPress={() => router.push('/cities')} hitSlop={12} accessibilityRole="button">
            <Text style={[styles.changeCity, { color: theme.brand }]}>
              {currentCity ? t.weather.changeCity : t.weather.selectCity}
            </Text>
          </Pressable>
        }
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.brand}
            colors={[theme.brand]}
          />
        }
      >
      {!hydrated ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.brand} />
        </View>
      ) : !currentCity ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.brand} />
          <Text style={[styles.centerText, { color: theme.textSecondary }]}>
            {t.weather.obtainingLocation}
          </Text>
          <Pressable onPress={() => router.push('/cities')} hitSlop={12}>
            <Text style={[styles.link, { color: theme.brand }]}>{t.weather.selectCity}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* 预警：无预警时整块消失（minHeight=0），失败时仅本块显示重试 */}
          <AsyncSection resource={alerts} minHeight={0}>
            {(list) => <AlertBanner alerts={list} />}
          </AsyncSection>

          <AsyncSection resource={now}>
            {(d) => (
              <WeatherNowCard
                cityName={currentCity.name}
                now={d}
                onSpeak={onSpeak}
                speaking={speaking}
              />
            )}
          </AsyncSection>

          {/* 空气质量：数据源合法返回 null（该地区无 AQI）也视为“已加载”，交给渲染决定 */}
          <AsyncSection resource={aqi} minHeight={0} emptyIsData>
            {(d) => (d ? <AqiCard aqi={d} /> : null)}
          </AsyncSection>

          <AsyncSection resource={hourly} minHeight={120}>
            {(list) => <HourlyStrip hourly={list} />}
          </AsyncSection>

          <AsyncSection resource={daily} minHeight={200}>
            {(list) => <DailyList daily={list} />}
          </AsyncSection>
        </>
      )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  changeCity: { fontSize: fontSize.body, fontWeight: '600' },
  center: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  centerText: { fontSize: fontSize.body },
  link: { fontSize: fontSize.body, fontWeight: '700' },
});
