/**
 * 绕道儿颐伴设计令牌（PRD §6.2：不引入第三方 UI 库，RN 核心组件 + 设计令牌）
 * 适老设计：暖色品牌、大字号、高对比、大触控目标。
 * 色板 / 字号 / 间距 / 圆角在此唯一定义，组件一律通过 useTheme() 消费。
 */

import { useSettingsStore, type FontScaleLevel } from '../stores/settings-store';

// ---------- 色板（原始色值，不直接使用） ----------

export const palette = {
  brand: {
    /** 品牌暖橙（夕阳暖调，贴合适老暖心定位） */
    500: '#E8890C',
    400: '#F09B2E',
    600: '#C97508',
    700: '#A35F06',
  },
  neutral: {
    0: '#FFFFFF',
    50: '#FAF7F2',
    100: '#F2ECE3',
    200: '#E4DACB',
    300: '#C9BCA6',
    500: '#6B6254',
    700: '#3F3A31',
    900: '#201D18',
    1000: '#14120F',
  },
  semantic: {
    success: '#1E8E5A',
    warning: '#E8890C',
    danger: '#C73A3A',
    info: '#2F7BD9',
  },
  // 预警四级色（红/橙/黄/蓝）
  alert: {
    red: '#D64545',
    orange: '#F2992E',
    yellow: '#E8C33A',
    blue: '#4A90D9',
  },
} as const;

// ---------- 间距 / 圆角 / 字号 ----------

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, full: 999 } as const;

// ---------- 适老大字号（三档缩放，运行时按设置生效） ----------

const FONT_BASE = { caption: 14, body: 17, heading: 20, title: 28, display: 48 } as const;
const FONT_SCALE: Record<FontScaleLevel, number> = { normal: 1, large: 1.18, xlarge: 1.4 };

function fontFactor(): number {
  return FONT_SCALE[useSettingsStore.getState().fontScale] ?? 1;
}

/**
 * 字号令牌：随「字体大小」设置实时缩放。
 * 内联使用即为响应式；StyleSheet.create 静态项需改为内联方能生效（主标签屏已处理）。
 */
export const fontSize = {
  get caption() {
    return Math.round(FONT_BASE.caption * fontFactor());
  },
  get body() {
    return Math.round(FONT_BASE.body * fontFactor());
  },
  get heading() {
    return Math.round(FONT_BASE.heading * fontFactor());
  },
  get title() {
    return Math.round(FONT_BASE.title * fontFactor());
  },
  get display() {
    return Math.round(FONT_BASE.display * fontFactor());
  },
};

/** 最小触控目标（适老规范：≥ 48dp，本项目取 56dp 更稳妥） */
export const touchMinHeight = 56;

// ---------- 主题（亮 / 暗） ----------

export interface Theme {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  brand: string;
  brandOn: string;
  brandSoft: string;
  success: string;
  warning: string;
  danger: string;
}

export const lightTheme: Theme = {
  background: palette.neutral[50],
  surface: palette.neutral[0],
  surfaceMuted: palette.neutral[100],
  border: palette.neutral[200],
  textPrimary: palette.neutral[900],
  textSecondary: palette.neutral[500],
  brand: palette.brand[500],
  brandOn: palette.neutral[0],
  brandSoft: '#FBE9D2',
  success: palette.semantic.success,
  warning: palette.semantic.warning,
  danger: palette.semantic.danger,
};

export const darkTheme: Theme = {
  background: palette.neutral[1000],
  surface: palette.neutral[900],
  surfaceMuted: palette.neutral[700],
  border: palette.neutral[700],
  textPrimary: palette.neutral[50],
  textSecondary: palette.neutral[300],
  brand: palette.brand[400],
  brandOn: palette.neutral[1000],
  brandSoft: '#3A2A12',
  success: '#3FC68F',
  warning: '#F2A64B',
  danger: '#EF6A6A',
};

/**
 * 护眼模式主题（FR-V4）：暖色护眼底色，降低蓝光与眩光，同时保留高可读性深褐文字。
 * 相比「纯白背景 + 黑色线条」的高对比方案，暖米色背景减少强光刺激，更适合长时间阅读与中老年用户；
 * 文字仍保持深色高对比，兼顾可读性需求。
 */
export const eyeCareTheme: Theme = {
  background: '#F4ECDB',
  surface: '#FBF6EA',
  surfaceMuted: '#E9DCC0',
  border: '#D8C7A3',
  textPrimary: '#2A2418',
  textSecondary: '#6B5E45',
  brand: palette.brand[600],
  brandOn: '#FBF6EA',
  brandSoft: '#EAD9B8',
  success: '#1E8E5A',
  warning: '#9A6208',
  danger: '#C73A3A',
};
