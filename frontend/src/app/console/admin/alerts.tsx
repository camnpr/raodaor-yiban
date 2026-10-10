import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../design/theme';
import { fontSize, spacing } from '../../../design/tokens';
import { useT } from '../../../i18n';
import { ApiError } from '../../../lib/api';
import { getAlertEmbed, type AlertEmbed } from '../../../lib/admin-api';
import { AppHeader } from '../../../components/ui/app-header';
import { Button } from '../../../components/ui/button';

/**
 * 预警事件大屏（/console/admin/alerts，PRD §6.5）。
 * 后端仅签发 DataCanvas 只读嵌入令牌（RS256 ≤600s）；未配置密钥时 signed=false。
 * 当前 App 无内嵌 WebView，以「在浏览器打开大屏」方式落地（原生 WebView 可后续接入）。
 */
export default function AdminAlertsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();

  const [embed, setEmbed] = useState<AlertEmbed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAlertEmbed()
      .then(setEmbed)
      .catch((e) => setError(e instanceof ApiError ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  }, []);

  const openDashboard = async () => {
    if (!embed?.embedUrl) return;
    try {
      await WebBrowser.openBrowserAsync(embed.embedUrl);
    } catch {
      Alert.alert(t.admin.alerts, embed.embedUrl);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <AppHeader title={t.admin.alerts} />
      <View style={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        {loading ? (
          <ActivityIndicator style={styles.load} color={theme.brand} />
        ) : error ? (
          <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
        ) : !embed?.signed ? (
          <View style={[styles.box, { borderColor: theme.border }]}>
            <Text style={[styles.note, { color: theme.textSecondary }]}>{t.admin.alertNotConfigured}</Text>
          </View>
        ) : (
          <View style={[styles.box, { borderColor: theme.border }]}>
            <Text style={[styles.note, { color: theme.textSecondary }]}>{t.admin.alerts}</Text>
            <Button title={t.admin.alertOpen} variant="primary" onPress={openDashboard} block />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.md },
  load: { marginVertical: spacing.xxl },
  error: { fontSize: fontSize.body, color: undefined },
  box: { borderWidth: 1, borderRadius: 12, padding: spacing.lg, gap: spacing.md },
  note: { fontSize: fontSize.body },
});
