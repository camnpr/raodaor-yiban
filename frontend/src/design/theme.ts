import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, type Theme } from './tokens';

/** 主题钩子：跟随系统深色模式（亮/暗两套令牌） */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}
