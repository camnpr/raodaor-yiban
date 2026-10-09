import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../design/theme';
import { fontSize, radius, spacing } from '../../design/tokens';
import { useT } from '../../i18n';
import type { ElderSummary } from '../../lib/care-api';

/** 守护中心长辈卡：昵称 + 城市 + 当前天气 + 预警角标（FR-C2） */
export function ElderCard({ elder, onPress }: { elder: ElderSummary; onPress: () => void }) {
  const theme = useTheme();
  const t = useT();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.top}>
        <Text style={[styles.name, { color: theme.textPrimary }]} numberOfLines={1}>
          {elder.displayName}
        </Text>
        {elder.alertCount > 0 ? (
          <View style={[styles.badge, { backgroundColor: theme.danger }]}>
            <Text style={styles.badgeText}>
              {t.care.alertBadge} {elder.alertCount}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.city, { color: theme.textSecondary }]} numberOfLines={1}>
        {elder.cityName ?? t.care.noCity}
      </Text>

      {elder.now ? (
        <View style={styles.weather}>
          <Text style={[styles.temp, { color: theme.brand }]}>{elder.now.temp}°</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>{elder.now.text}</Text>
        </View>
      ) : (
        <Text style={[styles.muted, { color: theme.textSecondary }]}>{t.care.noCity}</Text>
      )}

      <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { fontSize: fontSize.heading, fontWeight: '700', flexShrink: 1 },
  badge: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { color: '#FFFFFF', fontSize: fontSize.caption, fontWeight: '700' },
  city: { fontSize: fontSize.body, marginTop: spacing.xs },
  weather: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.sm },
  temp: { fontSize: fontSize.title, fontWeight: '700' },
  text: { fontSize: fontSize.body },
  muted: { fontSize: fontSize.caption, marginTop: spacing.sm },
  chevron: { position: 'absolute', right: spacing.md, top: spacing.md, fontSize: 22 },
});
