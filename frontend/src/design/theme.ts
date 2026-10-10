import { useColorScheme } from 'react-native';
import { darkTheme, eyeCareTheme, lightTheme, type Theme } from './tokens';
import { useSettingsStore } from '../stores/settings-store';

export type { Theme } from './tokens';

/** 主题钩子：跟随系统深色模式；护眼模式（FR-V4）启用时返回暖色护眼主题 */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  const eyeCare = useSettingsStore((s) => s.eyeCare);
  if (eyeCare) return eyeCareTheme;
  return scheme === 'dark' ? darkTheme : lightTheme;
}
