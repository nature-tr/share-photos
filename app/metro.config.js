// metro.config.js
// pnpm monorepo 配置：
// 1) watchFolders 把仓库根加入，让 metro 监听 shared/ 改动
// 2) nodeModulesPaths 同时查 app/node_modules 和根 node_modules
// 3) disableHierarchicalLookup=true：避免 metro 误进 backend/frontend 的 node_modules
// 4) resolveRequest：把 @photo/shared 强制重定向到 dist/（编译产物），
//    因为 shared/src/index.ts 用的是 TS NodeNext 风格的 './constants/index.js'，
//    metro 直接读 src 时找不到 .js 文件；只有 tsc 编译后的 dist 才有对应的 .js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');
const sharedDist = path.resolve(monorepoRoot, 'shared/dist');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// 让 metro 同时识别 .ts/.tsx
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];

// 强制 @photo/shared 走编译产物 dist/，避免误读 src/*.ts（NodeNext 路径不兼容）
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@photo/shared') {
    return {
      type: 'sourceFile',
      filePath: path.join(sharedDist, 'index.js'),
    };
  }
  if (moduleName.startsWith('@photo/shared/')) {
    const sub = moduleName.slice('@photo/shared/'.length);
    // 子路径：例如 @photo/shared/dto -> dist/dto/index.js
    return {
      type: 'sourceFile',
      filePath: path.join(sharedDist, sub, 'index.js'),
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
