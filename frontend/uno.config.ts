import { defineConfig, presetUno, presetIcons, presetAttributify } from 'unocss';

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      collections: {
        // 动态加载 tdesign 图标集；类型断言避免严格类型校验
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tdesign: () => import('@iconify-json/tdesign/icons.json').then((i: any) => i.default),
      },
    }),
  ],
  theme: {
    colors: {
      primary: '#0052d9',
    },
  },
  shortcuts: {
    'flex-center': 'flex items-center justify-center',
    'flex-between': 'flex items-center justify-between',
  },
});

