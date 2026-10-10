import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useTheme } from '../design/theme';
import { useT, useI18nStore, locales } from '../i18n';
import { spacing, radius, fontSize } from '../design/tokens';

/**
 * 门户首页（Web 营销落地页，FR-Wx）。
 * 采用独立路径 /portal；应用主入口仍占 /（(tabs)）。
 * 内容：产品介绍、核心功能、适老化说明、下载引导、双语切换、页脚导航。
 * 设计遵循适老规范：暖色品牌、大字号、高对比、大触控目标、响应式（宽屏多列 / 窄屏单列）。
 */
export default function PortalScreen() {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);

  const features = [
    { icon: '🌤️', title: t.portal.fWeatherTitle, desc: t.portal.fWeatherDesc },
    { icon: '💞', title: t.portal.fGuardTitle, desc: t.portal.fGuardDesc },
    { icon: '📋', title: t.portal.fIndexTitle, desc: t.portal.fIndexDesc },
    { icon: '⭐', title: t.portal.fMemberTitle, desc: t.portal.fMemberDesc },
  ];
  const aging = [
    { icon: '🔠', text: t.portal.agingLarge },
    { icon: '👁️', text: t.portal.agingContrast },
    { icon: '🔊', text: t.portal.agingVoice },
    { icon: '✨', text: t.portal.agingSimple },
  ];

  const scrollToDownload = () => {
    if (typeof document !== 'undefined') {
      document.getElementById('download')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.container}>
          {/* 顶栏：品牌名 + 双语切换 */}
          <View style={styles.topbar}>
            <Text style={[styles.brand, { color: theme.brand }]}>{t.portal.productName}</Text>
            <View style={[styles.seg, { borderColor: theme.border }]}>
              {locales.map((opt) => {
                const active = locale === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setLocale(opt.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [
                      styles.segBtn,
                      { backgroundColor: active ? theme.brand : 'transparent', opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Text style={[styles.segText, { color: active ? theme.brandOn : theme.textSecondary }]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Hero */}
          <View style={[styles.hero, { backgroundColor: theme.surface }]}>
            <Text style={[styles.tagline, { color: theme.brand }]}>{t.portal.heroTagline}</Text>
            <Text style={[styles.heroTitle, { color: theme.textPrimary }]}>{t.portal.productName}</Text>
            <Text style={[styles.heroDesc, { color: theme.textSecondary }]}>{t.portal.heroDesc}</Text>
            <View style={styles.ctaRow}>
              <Pressable
                onPress={() => router.replace('/')}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.ctaPrimary,
                  { backgroundColor: theme.brand, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.ctaText, { color: theme.brandOn }]}>{t.portal.enterApp}</Text>
              </Pressable>
              <Pressable
                onPress={scrollToDownload}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.ctaSecondary,
                  { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.ctaText, { color: theme.textPrimary }]}>{t.portal.downloadApp}</Text>
              </Pressable>
            </View>
          </View>

          {/* 核心功能 */}
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t.portal.featuresTitle}</Text>
          <View style={styles.grid}>
            {features.map((f) => (
              <View key={f.title} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={styles.cardIcon}>{f.icon}</Text>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{f.title}</Text>
                <Text style={[styles.cardDesc, { color: theme.textSecondary }]}>{f.desc}</Text>
              </View>
            ))}
          </View>

          {/* 适老化设计 */}
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t.portal.agingTitle}</Text>
          <View style={styles.grid}>
            {aging.map((a) => (
              <View key={a.text} style={[styles.ageItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={styles.cardIcon}>{a.icon}</Text>
                <Text style={[styles.ageText, { color: theme.textPrimary }]}>{a.text}</Text>
              </View>
            ))}
          </View>

          {/* 下载引导 */}
          <View nativeID="download" style={[styles.download, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginBottom: spacing.sm }]}>
              {t.portal.downloadTitle}
            </Text>
            <Text style={[styles.cardDesc, { color: theme.textSecondary, marginBottom: spacing.lg }]}>
              {t.portal.downloadDesc}
            </Text>
            <View style={styles.qrBox}>
              <Text style={styles.qrEmoji}>📱</Text>
              <Text style={[styles.qrText, { color: theme.textSecondary }]}>{t.portal.downloadApp}</Text>
            </View>
          </View>

          {/* 页脚导航 */}
          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <View style={styles.footerLinks}>
              <Link href="/" style={[styles.footerLink, { color: theme.textSecondary }]}>
                {t.portal.enterApp}
              </Link>
              <Link href="/membership" style={[styles.footerLink, { color: theme.textSecondary }]}>
                {t.portal.footerMember}
              </Link>
              <Link href="/privacy" style={[styles.footerLink, { color: theme.textSecondary }]}>
                {t.portal.footerPrivacy}
              </Link>
            </View>
            <Text style={[styles.copy, { color: theme.textSecondary }]}>{t.portal.footerCopy}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingBottom: spacing.xxl },
  container: { maxWidth: 960, width: '100%', alignSelf: 'center', paddingHorizontal: spacing.lg },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.lg },
  brand: { fontSize: fontSize.heading, fontWeight: '800' },
  seg: { flexDirection: 'row', borderRadius: radius.full, borderWidth: 1, overflow: 'hidden' },
  segBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  segText: { fontSize: fontSize.body, fontWeight: '700' },
  hero: { borderRadius: radius.lg, padding: spacing.xxl, alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  tagline: { fontSize: fontSize.body, fontWeight: '700' },
  heroTitle: { fontSize: fontSize.display, fontWeight: '900', textAlign: 'center' },
  heroDesc: { fontSize: fontSize.body, textAlign: 'center', lineHeight: fontSize.body * 1.5, maxWidth: 560 },
  ctaRow: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap', justifyContent: 'center', marginTop: spacing.sm },
  ctaPrimary: { minHeight: 56, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  ctaSecondary: { minHeight: 56, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: fontSize.heading, fontWeight: '700' },
  sectionTitle: { fontSize: fontSize.title, fontWeight: '800', marginBottom: spacing.lg, marginTop: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  card: { flex: 1, minWidth: 240, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, gap: spacing.sm },
  cardIcon: { fontSize: 34, lineHeight: 40 },
  cardTitle: { fontSize: fontSize.heading, fontWeight: '800' },
  cardDesc: { fontSize: fontSize.body, lineHeight: fontSize.body * 1.5 },
  ageItem: { flex: 1, minWidth: 200, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1 },
  ageText: { fontSize: fontSize.body, fontWeight: '700' },
  download: { borderRadius: radius.lg, padding: spacing.xxl, borderWidth: 1, alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl },
  qrBox: { width: 160, height: 160, borderRadius: radius.md, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  qrEmoji: { fontSize: 48 },
  qrText: { fontSize: fontSize.body, fontWeight: '700' },
  footer: { marginTop: spacing.xxl, paddingTop: spacing.lg, borderTopWidth: 1, gap: spacing.md, alignItems: 'center' },
  footerLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl, justifyContent: 'center' },
  footerLink: { fontSize: fontSize.body },
  copy: { fontSize: fontSize.caption, textAlign: 'center' },
});
