import { getLocales } from 'expo-localization';
import { create } from 'zustand';
import { DEFAULT_LOCALE } from '../config';
import { platformStorage } from '../stores/storage';
import zhCN, { type Dict } from './locales/zh-CN';
import zhTW from './locales/zh-TW';

export type Locale = 'zh-CN' | 'zh-TW';

export const locales: { value: Locale; label: string }[] = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
];

const dictionaries: Record<Locale, Dict> = { 'zh-CN': zhCN, 'zh-TW': zhTW };

/** 依据系统语言推导初始语言（zh-Hant 系归入 zh-TW，其余归入 zh-CN） */
function detectLocale(): Locale {
  const tag = getLocales()[0]?.languageTag ?? DEFAULT_LOCALE;
  if (/^(zh-TW|zh-HK|zh-MO|zh-Hant)/i.test(tag)) return 'zh-TW';
  return 'zh-CN';
}

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useI18nStore = create<I18nState>((set) => ({
  locale: detectLocale(),
  setLocale: (locale) => set({ locale }),
}));

/** 语言偏好持久化 */
const STORAGE_KEY = 'raodaor-yiban-i18n';
let hydrated = false;

function isLocale(value: unknown): value is Locale {
  return value === 'zh-CN' || value === 'zh-TW';
}

platformStorage
  .getItem(STORAGE_KEY)
  .then((raw) => {
    hydrated = true;
    if (!raw) return;
    const parsed = JSON.parse(raw) as { locale?: unknown };
    if (isLocale(parsed.locale)) useI18nStore.setState({ locale: parsed.locale });
  })
  .catch(() => {
    hydrated = true;
  });

useI18nStore.subscribe((state) => {
  if (!hydrated) return;
  void platformStorage.setItem(STORAGE_KEY, JSON.stringify({ locale: state.locale }));
});

/** 取当前语言字典（静态类型 = Dict，双语 key 缺失会在编译期报错） */
export function useT(): Dict {
  return useI18nStore((state) => dictionaries[state.locale]);
}
