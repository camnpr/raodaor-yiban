import { create } from 'zustand';
import { platformStorage } from './storage';

/** 字体大小三档（FR-V3 适老大字号） */
export type FontScaleLevel = 'normal' | 'large' | 'xlarge';

interface SettingsState {
  /** 字体大小档位（默认标准） */
  fontScale: FontScaleLevel;
  /** 护眼 / 高对比模式（FR-V4） */
  eyeCare: boolean;
  setFontScale: (level: FontScaleLevel) => void;
  setEyeCare: (value: boolean) => void;
}

/** 适老与显示偏好（本地持久化；语言偏好另由 i18n store 管理并同步后端） */
export const useSettingsStore = create<SettingsState>((set) => ({
  fontScale: 'normal',
  eyeCare: false,
  setFontScale: (fontScale) => set({ fontScale }),
  setEyeCare: (eyeCare) => set({ eyeCare }),
}));

const STORAGE_KEY = 'raodaor-yiban-settings';
let hydrated = false;

platformStorage
  .getItem(STORAGE_KEY)
  .then((raw) => {
    hydrated = true;
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<Pick<SettingsState, 'fontScale' | 'eyeCare'>>;
      if (parsed.fontScale) useSettingsStore.setState({ fontScale: parsed.fontScale });
      if (typeof parsed.eyeCare === 'boolean') useSettingsStore.setState({ eyeCare: parsed.eyeCare });
    } catch {
      /* 忽略损坏的本地数据 */
    }
  })
  .catch(() => {
    hydrated = true;
  });

useSettingsStore.subscribe((state) => {
  if (!hydrated) return;
  void platformStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ fontScale: state.fontScale, eyeCare: state.eyeCare }),
  );
});
