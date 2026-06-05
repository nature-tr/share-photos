/**
 * 格子橱窗 设计系统 token
 * 设计语言：克制、轻量、克莱因蓝主色 + 充足留白；与 web 端保持视觉一致。
 */
import { Platform } from 'react-native';

export const colors = {
  /** 主色：克莱因蓝偏冷 */
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  /** 主色淡背景（按钮 hover / 选中态背板） */
  primarySoft: '#eff6ff',
  primarySofter: '#f8faff',

  accent: '#8b5cf6',
  success: '#10b981',
  successSoft: '#ecfdf5',
  warning: '#f59e0b',
  warningSoft: '#fffbeb',
  danger: '#ef4444',
  dangerSoft: '#fef2f2',

  /** 文字 */
  text1: '#0f172a', // 标题
  text2: '#475569', // 正文
  text3: '#94a3b8', // 辅助
  text4: '#cbd5e1', // 占位

  /** 背景 */
  bg: '#ffffff',
  surface: '#ffffff',
  surfaceSoft: '#f8fafc',
  surfaceHover: '#f1f5f9',
  surfaceMuted: '#eef2f7',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  borderStrong: '#cbd5e1',
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 24,
  full: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const font = {
  /** 大标题：页面 h1 */
  display: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  /** 章节标题：卡片标题 */
  h1: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  h2: { fontSize: 18, fontWeight: '600' as const, letterSpacing: -0.2 },
  h3: { fontSize: 16, fontWeight: '600' as const },
  /** 正文 */
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const },
  /** 小字 */
  small: { fontSize: 13, fontWeight: '400' as const },
  smallStrong: { fontSize: 13, fontWeight: '600' as const },
  /** 辅助：图例、metadata */
  caption: { fontSize: 12, fontWeight: '400' as const },
  captionStrong: { fontSize: 12, fontWeight: '600' as const },
  /** Eyebrow / label */
  eyebrow: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.8,
  },
} as const;

/** 阴影：iOS / Android 兼容 */
export const shadow = {
  /** 轻：卡片漂浮感 */
  sm: Platform.select({
    ios: {
      shadowColor: '#0f172a',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    android: { elevation: 1 },
  }),
  /** 中：浮窗、弹层 */
  md: Platform.select({
    ios: {
      shadowColor: '#0f172a',
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 4 },
  }),
  /** 强：FAB / Modal */
  lg: Platform.select({
    ios: {
      shadowColor: '#0f172a',
      shadowOpacity: 0.16,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 8 },
  }),
} as const;
