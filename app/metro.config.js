// metro.config.js
// pnpm monorepo 配置：
// 1) watchFolders 把仓库根 + shared 也加入，让 metro 监听 shared 改动
// 2) nodeModulesPaths 同时查 app/node_modules 和根 node_modules
// 3) disableHierarchicalLookup=true：避免 metro 误进 backend/frontend 的 node_modules
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// 让 metro 同时识别 .ts/.tsx
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];

module.exports = config;
