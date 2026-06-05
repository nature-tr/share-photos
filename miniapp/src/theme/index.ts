/**
 * 格子橱窗 设计 token — 与 Expo App 完全对齐
 * 小程序用 rpx：1dp ≈ 2rpx
 */
export const colors = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primarySoft: '#eff6ff',
  primarySofter: '#f8faff',
  success: '#10b981',
  successSoft: '#ecfdf5',
  warning: '#f59e0b',
  warningSoft: '#fffbeb',
  danger: '#ef4444',
  dangerSoft: '#fef2f2',
  text1: '#0f172a',
  text2: '#475569',
  text3: '#94a3b8',
  text4: '#cbd5e1',
  surface: '#ffffff',
  surfaceSoft: '#f8fafc',
  surfaceHover: '#f1f5f9',
  surfaceMuted: '#eef2f7',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
} as const;

export const font = {
  display: { fontSize: '56rpx', fontWeight: '700' },
  h1: { fontSize: '44rpx', fontWeight: '700' },
  h2: { fontSize: '36rpx', fontWeight: '600' },
  h3: { fontSize: '32rpx', fontWeight: '600' },
  body: { fontSize: '30rpx', fontWeight: '400' },
  bodyStrong: { fontSize: '30rpx', fontWeight: '600' },
  small: { fontSize: '26rpx', fontWeight: '400' },
  smallStrong: { fontSize: '26rpx', fontWeight: '600' },
  caption: { fontSize: '24rpx', fontWeight: '400' },
  captionStrong: { fontSize: '24rpx', fontWeight: '600' },
  eyebrow: { fontSize: '22rpx', fontWeight: '600', letterSpacing: '1.6rpx' },
} as const;

export const space = {
  xs: '8rpx',
  sm: '16rpx',
  md: '24rpx',
  lg: '32rpx',
  xl: '48rpx',
  xxl: '64rpx',
} as const;

export const radius = {
  sm: '12rpx',
  md: '20rpx',
  lg: '28rpx',
  xl: '36rpx',
  xxl: '48rpx',
  full: '9999rpx',
} as const;
