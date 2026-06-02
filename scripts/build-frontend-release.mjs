#!/usr/bin/env node
/**
 * build 前端并把产物复制到 dist-release/frontend/dist/
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const frontendDir = path.join(repoRoot, 'frontend');
const srcDist = path.join(frontendDir, 'dist');
const outDir = path.join(repoRoot, 'dist-release', 'frontend');
const outDist = path.join(outDir, 'dist');

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`))));
    child.on('error', reject);
  });
}

async function main() {
  console.log('[release] vite build frontend ...');
  await run('pnpm', ['-F', '@photo/frontend', 'build'], repoRoot);

  console.log('[release] copying dist -> dist-release/frontend/dist');
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  await fs.cp(srcDist, outDist, { recursive: true });

  const readme = `# Photo Frontend - Release Bundle

把整个 \`dist/\` 上传到服务器，nginx \`root\` 指向它即可。

参考 nginx 配置见 \`../backend/README.md\`。
`;
  await fs.writeFile(path.join(outDir, 'README.md'), readme, 'utf8');

  console.log('[release] frontend done:', outDist);
}

main().catch((err) => {
  console.error('[release] FAILED:', err);
  process.exit(1);
});
