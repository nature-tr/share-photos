#!/usr/bin/env node
/**
 * 修复 native 模块在切换 Node 版本后的 ABI 不匹配问题。
 *
 * 直接在每个 native 包目录里执行它声明的 install 脚本，强制按当前 Node 版本拉 prebuild。
 *
 * 用法：pnpm fix:native
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

/** 要修复的 native 包名 */
const NATIVE_PKGS = ['better-sqlite3', 'sharp', 'argon2'];

const pnpmDir = path.join(projectRoot, 'node_modules', '.pnpm');
if (!fs.existsSync(pnpmDir)) {
  console.error('node_modules/.pnpm 不存在，请先 pnpm install');
  process.exit(1);
}

console.log(`Node version: ${process.version} (NODE_MODULE_VERSION=${process.versions.modules})`);
console.log('');

const cacheDir = path.join(projectRoot, '.npm-cache');

/** 把 native 包自己 + 全局 .pnpm 的 .bin 加进 PATH */
function buildEnv(pkgDir) {
  const pkgLocalBin = path.join(pkgDir, 'node_modules', '.bin');
  const pnpmGlobalBin = path.join(projectRoot, 'node_modules', '.pnpm', 'node_modules', '.bin');
  const sep = process.platform === 'win32' ? ';' : ':';
  const extra = [pkgLocalBin, pnpmGlobalBin].filter((p) => fs.existsSync(p));
  return {
    ...process.env,
    npm_config_cache: cacheDir,
    PATH: [...extra, process.env.PATH ?? ''].join(sep),
  };
}

function findNativePkgDirs(pkgName) {
  const dirs = [];
  for (const entry of fs.readdirSync(pnpmDir)) {
    if (!entry.startsWith(`${pkgName}@`)) continue;
    const pkgDir = path.join(pnpmDir, entry, 'node_modules', pkgName);
    if (fs.existsSync(pkgDir)) dirs.push(pkgDir);
  }
  return dirs;
}

let totalProcessed = 0;
let totalFailed = 0;

for (const pkg of NATIVE_PKGS) {
  const dirs = findNativePkgDirs(pkg);
  if (dirs.length === 0) {
    console.log(`- ${pkg}: 未安装，跳过`);
    continue;
  }
  for (const pkgDir of dirs) {
    console.log(`\n=== ${pkg} (${path.relative(projectRoot, pkgDir)}) ===`);

    // 1) 清理已编译产物
    for (const sub of ['build', 'lib/binding', 'prebuilds']) {
      const target = path.join(pkgDir, sub);
      if (fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
        console.log(`  cleared ${sub}/`);
      }
    }

    const pkgJson = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf-8'));
    const installScript = pkgJson.scripts?.install;
    if (!installScript) {
      console.log('  (无 install 脚本，跳过)');
      continue;
    }

    try {
      console.log(`  → ${installScript}`);
      execSync(installScript, {
        cwd: pkgDir,
        stdio: 'inherit',
        env: buildEnv(pkgDir),
        shell: true,
      });
      totalProcessed++;
    } catch (err) {
      console.error(`  ✗ ${pkg} 重建失败:`, err.message);
      totalFailed++;
    }
  }
}

console.log(`\n${totalFailed === 0 ? '✓' : '⚠'} 完成：成功 ${totalProcessed}，失败 ${totalFailed}`);

if (totalFailed > 0) {
  console.error('\n如果仍然失败，请尝试核选项：');
  console.error('  rm -rf node_modules backend/node_modules frontend/node_modules shared/node_modules');
  console.error('  npm_config_cache="$PWD/.npm-cache" pnpm install');
  process.exit(1);
}
