import { Redirect } from 'expo-router';

/**
 * 根路由 `/` 落地页：
 * (tabs) 组内只有 home/care/me 三个 tab，没有 index 会导致 `/` 命中 Expo Router 的
 * “Page could not be found” 404。这里把 `/` 重定向到首个 tab（home 天气首页），
 * 既保证根路径可用，又让 tab 栏的选中态正确高亮。
 */
export default function TabIndex() {
  return <Redirect href="/home" />;
}
