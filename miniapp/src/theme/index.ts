export const colors = {
  primary: '#2563eb',
  primarySoft: '#dbeafe',
  primarySofter: '#eff6ff',
  text1: '#1f2937',
  text2: '#4b5563',
  text3: '#9ca3af',
  text4: '#d1d5db',
  surface: '#ffffff',
  surfaceSoft: '#f5f7fa',
  surfaceMuted: '#f3f4f6',
  border: '#e5e7eb',
  success: '#10b981',
  successSoft: '#d1fae5',
  error: '#ef4444',
  warning: '#f59e0b',
} as const;

export const font = {
  display: { fontSize: '44rpx', fontWeight: '800', lineHeight: 1.3 },
  title: { fontSize: '36rpx', fontWeight: '700', lineHeight: 1.4 },
  bodyStrong: { fontSize: '28rpx', fontWeight: '600', lineHeight: 1.5 },
  body: { fontSize: '28rpx', fontWeight: '400', lineHeight: 1.5 },
  smallStrong: { fontSize: '24rpx', fontWeight: '600', lineHeight: 1.4 },
  small: { fontSize: '24rpx', fontWeight: '400', lineHeight: 1.4 },
  caption: { fontSize: '20rpx', fontWeight: '400', lineHeight: 1.4 },
  eyebrow: { fontSize: '22rpx', fontWeight: '700', letterSpacing: '0.1em' },
} as const;

export const space = {
  xs: '8rpx',
  sm: '12rpx',
  md: '16rpx',
  lg: '24rpx',
  xl: '32rpx',
  xxl: '48rpx',
} as const;

export const radius = {
  sm: '8rpx',
  md: '12rpx',
  lg: '16rpx',
  xl: '20rpx',
  full: '9999rpx',
} as const;
