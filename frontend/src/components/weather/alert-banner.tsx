import { StyleSheet, Text, View } from 'react-native';
import type { WeatherAlert } from '../../lib/weather-api';
import { radius, spacing } from '../../design/tokens';

/** 预警四级配色（红/橙/黄/蓝），实底 + 高对比文字 */
const SEVERITY_STYLE: Record<string, { bg: string; text: string }> = {
  Red: { bg: '#D64545', text: '#FFFFFF' },
  Orange: { bg: '#F2992E', text: '#FFFFFF' },
  Yellow: { bg: '#E8C33A', text: '#3F3A31' },
  Blue: { bg: '#4A90D9', text: '#FFFFFF' },
};

function rank(color: string): number {
  return { Red: 4, Orange: 3, Yellow: 2, Blue: 1 }[color] ?? 0;
}

/** 极端天气预警横幅（FR-A1：红/橙高级别显著展示） */
export function AlertBanner({ alerts }: { alerts: WeatherAlert[] }) {
  if (!alerts.length) return null;
  const sorted = [...alerts].sort((a, b) => rank(b.severityColor) - rank(a.severityColor));

  return (
    <View style={styles.wrap}>
      {sorted.map((a) => {
        const style = SEVERITY_STYLE[a.severityColor] ?? SEVERITY_STYLE.Yellow;
        return (
          <View key={a.id} style={[styles.banner, { backgroundColor: style.bg }]}>
            <Text style={[styles.title, { color: style.text }]}>{a.title}</Text>
            {a.text ? (
              <Text style={[styles.text, { color: style.text }]} numberOfLines={2}>
                {a.text}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  banner: { borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  title: { fontSize: 17, fontWeight: '700' },
  text: { fontSize: 15, lineHeight: 21 },
});
