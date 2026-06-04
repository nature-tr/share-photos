import path from 'node:path';

const config = {
  projectName: 'dolmo-photo-miniapp',
  date: '2026-6-5',
  designWidth: 375,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    375: 2,
    828: 1.81 / 2,
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [
    '@tarojs/plugin-platform-weapp',
    '@tarojs/plugin-framework-react',
  ],
  defineConstants: {},
  copy: {
    patterns: [],
    options: {},
  },
  framework: 'react',
  compiler: 'webpack5',
  cache: { enable: false },
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {},
      },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]',
        },
      },
    },
    // 别名：让 Taro 找到 workspace 共享包
    webpackChain(chain) {
      const monorepoRoot = path.resolve(__dirname, '../..');
      chain.resolve.alias
        .set('@', path.resolve(__dirname, '..', 'src'))
        .set('@photo/shared', path.resolve(monorepoRoot, 'shared/dist'));
      // shared 子路径如 @photo/shared/dto → dist/dto/index.js
      chain.resolve.modules
        .prepend(path.resolve(monorepoRoot, 'node_modules'))
        .prepend(path.resolve(__dirname, '..', 'node_modules'));
    },
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    postcss: {
      autoprefixer: {
        enable: true,
        config: {},
      },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]',
        },
      },
    },
  },
};

export default function (merge) {
  if (process.env.NODE_ENV === 'development') {
    return merge({}, config, require('./dev'));
  }
  return merge({}, config, require('./prod'));
}
