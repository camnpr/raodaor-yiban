import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../design/theme';
import { fontSize, spacing } from '../design/tokens';
import { useT, useI18nStore, locales } from '../i18n';
import { useSettingsStore, type FontScaleLevel } from '../stores/settings-store';
import { useAuthStore } from '../stores/auth-store';
import { updateLocale, deactivateAccount } from '../lib/account-api';
import { AppHeader } from '../components/ui/app-header';
import { SettingRow } from '../components/ui/setting-row';
import { Switch } from '../components/ui/switch';
import { Button } from '../components/ui/button';

const FONT_OPTIONS: { level: FontScaleLevel; labelKey: 'fontSizeNormal' | 'fontSizeLarge' | 'fontSizeXLarge' }[] = [
  { level: 'normal', labelKey: 'fontSizeNormal' },
  { level: 'large', labelKey: 'fontSizeLarge' },
  { level: 'xlarge', labelKey: 'fontSizeXLarge' },
];

/** 设置（FR-V3 字体大小 / FR-V4 护眼模式 / FR-I1 语言 / FR-G9 注销） */
export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);

  const fontScale = useSettingsStore((s) => s.fontScale);
  const setFontScale = useSettingsStore((s) => s.setFontScale);
  const eyeCare = useSettingsStore((s) => s.eyeCare);
  const setEyeCare = useSettingsStore((s) => s.setEyeCare);

  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);

  const onSelectLocale = async (next: typeof locale) => {
    setLocale(next);
    if (!session) return;
    try {
      await updateLocale(next);
    } catch {
      // 本地语言已生效；后端同步失败不影响体验
    }
  };

  const onDeactivate = () => {
    Alert.alert(t.settings.deactivateConfirmTitle, t.settings.deactivateConfirmText, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.settings.deactivate,
        style: 'destructive',
        onPress: async () => {
          try {
            await deactivateAccount();
          } catch (e) {
            Alert.alert(t.settings.title, e instanceof Error ? e.message : String(e));
            return;
          }
          logout();
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <AppHeader title={t.settings.title} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      >
        <Text style={[styles.group, { color: theme.textSecondary, fontSize: fontSize.caption }]}>
          {t.settings.appearance}
        </Text>

        {/* 字体大小（FR-V3） */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardLabel, { color: theme.textPrimary, fontSize: fontSize.body }]}>
            {t.settings.fontSize}
          </Text>
          <View style={styles.segment}>
            {FONT_OPTIONS.map((opt) => {
              const active = fontScale === opt.level;
              return (
                <Pressable
                  key={opt.level}
                  onPress={() => setFontScale(opt.level)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.segmentBtn,
                    {
                      backgroundColor: active ? theme.brand : 'transparent',
                      borderColor: theme.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: active ? theme.brandOn : theme.textPrimary, fontSize: fontSize.body },
                    ]}
                  >
                    {t.settings[opt.labelKey]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 护眼模式（FR-V4） */}
        <SettingRow
          label={t.settings.eyeCare}
          description={t.settings.eyeCareHint}
          control={<Switch value={eyeCare} onValueChange={setEyeCare} />}
        />

        {/* 语言（FR-I1） */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardLabel, { color: theme.textPrimary, fontSize: fontSize.body }]}>
            {t.settings.language}
          </Text>
          <View style={styles.segment}>
            {locales.map((opt) => {
              const active = locale === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => onSelectLocale(opt.value)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.segmentBtn,
                    {
                      backgroundColor: active ? theme.brand : 'transparent',
                      borderColor: theme.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: active ? theme.brandOn : theme.textPrimary, fontSize: fontSize.body },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 隐私政策（FR-G6） */}
        <SettingRow label={t.settings.privacy} showChevron onPress={() => router.push('/privacy')} />

        <View style={styles.dangerWrap}>
          <Button title={t.settings.deactivate} variant="secondary" onPress={onDeactivate} block />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.md },
  group: { fontSize: fontSize.caption, fontWeight: '700', marginTop: spacing.sm },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardLabel: { fontSize: fontSize.body, fontWeight: '600' },
  segment: { flexDirection: 'row', gap: spacing.sm },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: spacing.md,
  },
  segmentText: { fontSize: fontSize.body, fontWeight: '600' },
  dangerWrap: { marginTop: spacing.lg },
});
