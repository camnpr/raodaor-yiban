import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design/theme';
import { fontSize, spacing } from '../../design/tokens';
import { useT } from '../../i18n';
import { AppHeader } from '../../components/ui/app-header';

/**
 * 平台运营中心首页（owner 专属）：owner 工具清单。
 * 未来新增 owner 功能 = 在此追加一行 + 新建对应子页；入口统一收敛，个人页不再堆卡片。
 */
export default function OwnerHubScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();

  const tools = [
    { key: 'grant', label: t.admin.grantItem, onPress: () => router.push('/owner/grant') },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <AppHeader title={t.admin.centerTitle} />
      <View style={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        {tools.map((tool) => (
          <Pressable
            key={tool.key}
            onPress={tool.onPress}
            style={({ pressed }) => [
              styles.row,
              { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.rowText, { color: theme.textPrimary }]}>{tool.label}</Text>
            <Text style={[styles.rowChevron, { color: theme.textSecondary }]}>›</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
  },
  rowText: { fontSize: fontSize.body, fontWeight: '600' },
  rowChevron: { fontSize: 22 },
});
