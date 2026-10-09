import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../design/theme';
import { fontSize, radius, spacing, touchMinHeight } from '../design/tokens';
import { useT } from '../i18n';
import { useWeatherStore } from '../stores/weather-store';
import { addCity, removeCity, searchCity, setDefaultCity, type CityResult, type FavoriteCity } from '../lib/weather-api';

/** 城市管理（FR-L1/L2）：搜索添加、收藏列表、设为默认、删除 */
export default function CitiesScreen() {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const cities = useWeatherStore((s) => s.cities);
  const loadCities = useWeatherStore((s) => s.loadCities);
  const setCurrentCity = useWeatherStore((s) => s.setCurrentCity);

  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<CityResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    void loadCities();
  }, [loadCities]);

  const onSearch = async () => {
    const kw = keyword.trim();
    if (!kw) return;
    setSearching(true);
    setSearched(true);
    try {
      setResults(await searchCity(kw));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const onAdd = async (city: CityResult) => {
    try {
      await addCity({
        cityId: city.cityId,
        name: city.name,
        adminDiv: city.adm1 ? `${city.adm1} ${city.adm2}` : city.adm2,
        lat: city.lat,
        lng: city.lon,
      });
      await loadCities();
    } catch {
      // 已存在等错误静默（列表刷新即可见）
    }
  };

  const onSelect = (city: FavoriteCity) => {
    setCurrentCity({ cityId: city.id, name: city.name, lon: city.lng, lat: city.lat });
    router.back();
  };

  const onSetDefault = async (id: string) => {
    await setDefaultCity(id);
    await loadCities();
  };

  const onRemove = async (id: string) => {
    await removeCity(id);
    await loadCities();
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: theme.textPrimary }]}>{t.cities.title}</Text>

      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]}
          placeholder={t.cities.searchPlaceholder}
          placeholderTextColor={theme.textSecondary}
          value={keyword}
          onChangeText={setKeyword}
          onSubmitEditing={onSearch}
          returnKeyType="search"
        />
        <Pressable
          style={[styles.searchBtn, { backgroundColor: theme.brand }]}
          onPress={onSearch}
          accessibilityRole="button"
        >
          <Text style={styles.searchBtnText}>{t.cities.add}</Text>
        </Pressable>
      </View>

      {searching ? (
        <ActivityIndicator color={theme.brand} style={styles.searching} />
      ) : searched && results.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>{t.cities.noResult}</Text>
      ) : (
        <View style={styles.results}>
          {results.map((city) => (
            <View key={city.cityId} style={[styles.resultRow, { borderBottomColor: theme.border }]}>
              <View style={styles.resultInfo}>
                <Text style={[styles.resultName, { color: theme.textPrimary }]}>{city.name}</Text>
                <Text style={[styles.resultMeta, { color: theme.textSecondary }]}>
                  {city.adm1} {city.adm2}
                </Text>
              </View>
              <Pressable onPress={() => onAdd(city)} hitSlop={8}>
                <Text style={[styles.action, { color: theme.brand }]}>{t.cities.add}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t.cities.title}</Text>
      {cities.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>{t.cities.empty}</Text>
      ) : (
        <View style={styles.list}>
          {cities.map((city) => (
            <View key={city.id} style={[styles.resultRow, { borderBottomColor: theme.border }]}>
              <Pressable style={styles.resultInfo} onPress={() => onSelect(city)}>
                <Text style={[styles.resultName, { color: theme.textPrimary }]}>
                  {city.name}
                  {city.isDefault ? (
                    <Text style={{ color: theme.brand }}> · {t.cities.default}</Text>
                  ) : null}
                </Text>
              </Pressable>
              {!city.isDefault ? (
                <Pressable onPress={() => onSetDefault(city.id)} hitSlop={8}>
                  <Text style={[styles.action, { color: theme.brand }]}>{t.cities.setDefault}</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => onRemove(city.id)} hitSlop={8}>
                <Text style={[styles.remove, { color: theme.danger }]}>{t.cities.remove}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  title: { fontSize: fontSize.title, fontWeight: '700' },
  sectionTitle: { fontSize: fontSize.heading, fontWeight: '700', marginTop: spacing.sm },
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: touchMinHeight,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.body,
  },
  searchBtn: {
    minHeight: touchMinHeight,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: { color: '#FFFFFF', fontSize: fontSize.body, fontWeight: '700' },
  searching: { marginVertical: spacing.md },
  results: { gap: 0 },
  list: { gap: spacing.sm },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultInfo: { flex: 1 },
  resultName: { fontSize: fontSize.body, fontWeight: '600' },
  resultMeta: { fontSize: fontSize.caption },
  action: { fontSize: fontSize.body, fontWeight: '700' },
  remove: { fontSize: fontSize.body, fontWeight: '600' },
  empty: { fontSize: fontSize.body },
});
