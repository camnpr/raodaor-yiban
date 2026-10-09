import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { useT } from '../../i18n';

export default function TabLayout() {
  const theme = useTheme();
  const t = useT();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.brand,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.surface },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t.tabs.home,
          tabBarIcon: ({ color, size }) => <Ionicons name="partly-sunny" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="care"
        options={{
          title: t.tabs.care,
          tabBarIcon: ({ color, size }) => <Ionicons name="heart" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: t.tabs.me,
          tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
        }}
      />
      {/* `/` 重定向垫片：保留路由（避免 404）但从 tab 栏隐藏，否则会显示成 “Index” */}
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}
