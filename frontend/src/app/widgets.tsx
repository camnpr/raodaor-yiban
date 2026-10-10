import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../design/theme';
import { fontSize, radius, spacing } from '../design/tokens';
import { useAuthStore } from '../stores/auth-store';
import { Button } from '../components/ui/button';
import { getMyMembership, type MyMembership } from '../lib/membership-api';
import {
  fetchAirQuality,
  fetchCities,
  fetchWeatherNow,
  type AirQuality,
  type FavoriteCity,
  type WeatherNow,
} from '../lib/weather-api';
import { weatherEmoji } from '../lib/weather-format';

/** 适老小组件（M2 FR-L3 / M4）：高级样式为会员权益。本页为预览 + 权益门禁。 */
export default function WidgetsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);

  const [mine, setMine] = useState<MyMembership | null>(null);
  const [loading, setLoading] = useState(false);
  const [city, setCity] = useState<FavoriteCity | null>(null);
  const [now, setNow] = useState<WeatherNow | null>(null);
  const [aqi, setAqi] = useState<AirQuality | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const m = await getMyMembership();
      setMine(m);
      const cities = await fetchCities();
      const def = cities.find((c) => c.isDefault) ?? cities[0] ?? null;
      setCity(def);
      if (def) {
        const [w, a] = await Promise.all([
          fetchWeatherNow(def.lng, def.lat),
          fetchAirQuality(def.lng, def.lat),
        ]);
        setNow(w);
        setAqi(a);
      }
    } catch {
      // 保留空态
    } finally {
      setLoading(false);
    }
  }, [session]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!session) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>适老小组件</Text>
        <Text style={[styles.empty, { color: theme.textSecondary }]}>请先登录</Text>
        <Button title="登录" onPress={() => router.push('/login')} block />
      </View>
    );
  }

  const advancedUnlocked = !!mine?.benefit.advancedWidget;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: theme.textPrimary }]}>适老小组件</Text>

      {/* 标准小组件：所有用户可用，基础样式 */}
      <Text style={[styles.section, { color: theme.textPrimary }]}>标准小组件（免费）</Text>
      <WidgetPreview kind="standard" city={city} now={now} aqi={aqi} />

      {/* 高级适老小组件：会员权益，大字 + 更多要素 */}
      <Text style={[styles.section, { color: theme.textPrimary }]}>高级适老小组件（会员）</Text>
      {advancedUnlocked ? (
        <WidgetPreview kind="advanced" city={city} now={now} aqi={aqi} />
      ) : (
        <View style={[styles.locked, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.lockTitle, { color: theme.textPrimary }]}>高级适老小组件已锁定</Text>
          <Text style={[styles.lockHint, { color: theme.textSecondary }]}>
            开通标准或尊享会员后，可使用大字天气、预警高亮等高级小组件样式
          </Text>
          <Button title="去开通会员" onPress={() => router.push('/membership')} block />
        </View>
      )}

      {loading && !now ? <ActivityIndicator size="large" color={theme.brand} /> : null}
    </ScrollView>
  );
}

function WidgetPreview({
  kind,
  city,
  now,
  aqi,
}: {
  kind: 'standard' | 'advanced';
  city: FavoriteCity | null;
  now: WeatherNow | null;
  aqi: AirQuality | null;
}) {
  const theme = useTheme();
  const advanced = kind === 'advanced';
  const big = advanced ? fontSize.display : fontSize.title;

  return (
    <View
      style={[
        styles.widget,
        { backgroundColor: theme.surface, borderColor: theme.border },
        advanced && { borderWidth: 2, borderColor: theme.brand },
      ]}
    >
      <Text style={[styles.widgetCity, { color: theme.textSecondary }]}>
        {city?.name ?? '未选择城市'}
      </Text>
      {now ? (
        <>
          <View style={styles.widgetMain}>
            <Text style={{ fontSize: advanced ? 56 : 40 }}>{weatherEmoji(now.icon)}</Text>
            <Text style={[styles.widgetTemp, { color: theme.textPrimary, fontSize: big }]}>
              {now.temp}°
            </Text>
          </View>
          <Text style={[styles.widgetText, { color: theme.textPrimary, fontSize: advanced ? fontSize.heading : fontSize.body }]}>
            {now.text}
          </Text>
          {advanced ? (
            <Text style={[styles.widgetDetail, { color: theme.textSecondary }]}>
              体感 {now.feelsLike}° · 湿度 {now.humidity}%{aqi ? ` · 空气 ${aqi.category}` : ''}
            </Text>
          ) : (
            <Text style={[styles.widgetDetail, { color: theme.textSecondary }]}>
              {aqi ? `空气 ${aqi.category}` : ''}
            </Text>
          )}
        </>
      ) : (
        <Text style={[styles.widgetDetail, { color: theme.textSecondary }]}>正在加载天气…</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  title: { fontSize: fontSize.title, fontWeight: '700' },
  empty: { fontSize: fontSize.body, textAlign: 'center' },
  section: { fontSize: fontSize.heading, fontWeight: '700', marginTop: spacing.sm },
  widget: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.xs },
  widgetCity: { fontSize: fontSize.body },
  widgetMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  widgetTemp: { fontWeight: '700' },
  widgetText: { fontWeight: '600' },
  widgetDetail: { fontSize: fontSize.caption },
  locked: { borderRadius: radius.md, borderWidth: 1, padding: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  lockTitle: { fontSize: fontSize.heading, fontWeight: '700' },
  lockHint: { fontSize: fontSize.body, textAlign: 'center' },
});
