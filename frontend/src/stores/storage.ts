import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * 跨端键值存储适配器：
 * Native → expo-secure-store（令牌类数据加密存储）；Web → localStorage。
 * 返回 Promise，供手动持久化（auth / i18n）使用。
 *
 * ⚠️ SSR / 静态导出兜底（`expo export --platform web` 在 Node 进程里用 react-native-web 渲染）：
 * 此时 `Platform.OS === 'web'` 为 true 但 `window` 不存在。此环境必须降级为空实现，
 * 否则模块顶层的会话/语言水合会抛 `ReferenceError: window is not defined` 导致导出进程崩溃。
 */
function webLocalStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

export const platformStorage = {
  async getItem(name: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return webLocalStorage()?.getItem(name) ?? null;
    }
    return SecureStore.getItemAsync(name);
  },
  async setItem(name: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      webLocalStorage()?.setItem(name, value);
      return;
    }
    return SecureStore.setItemAsync(name, value);
  },
  async removeItem(name: string): Promise<void> {
    if (Platform.OS === 'web') {
      webLocalStorage()?.removeItem(name);
      return;
    }
    return SecureStore.deleteItemAsync(name);
  },
};
