#!/usr/bin/env bash
#
# 把本地 dist-release/ 同步到服务器。
#
# 默认服务器：www.dolmo.top:/root/dolmo_projects/share_photos/dist-release
# 可以通过环境变量覆盖：
#   PHOTO_DEPLOY_HOST   服务器（默认 root@www.dolmo.top）
#   PHOTO_DEPLOY_PATH   远端路径（默认 /root/dolmo_projects/share_photos/dist-release）
#
# 用法：
#   bash scripts/deploy.sh              # 同步前端 + 后端代码（不含 .env / data / storage / node_modules）
#   bash scripts/deploy.sh frontend     # 仅前端
#   bash scripts/deploy.sh backend      # 仅后端代码（不动 node_modules / .env / data / storage）
#
# 后端代码更新后，提示用户在服务器手动执行 `pm2 reload photo-backend`。
#
set -euo pipefail

HOST="${PHOTO_DEPLOY_HOST:-root@www.dolmo.top}"
REMOTE_PATH="${PHOTO_DEPLOY_PATH:-/root/dolmo_projects/share_photos/dist-release}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DIST="${REPO_ROOT}/dist-release"

if [ ! -d "$LOCAL_DIST" ]; then
  echo "❌ 未找到 $LOCAL_DIST，请先打包：" >&2
  echo "   pnpm -F @photo/backend run build:release" >&2
  echo "   node scripts/build-frontend-release.mjs" >&2
  exit 1
fi

WHAT="${1:-all}"

sync_frontend() {
  echo "▶ 同步前端：$LOCAL_DIST/frontend/  →  $HOST:$REMOTE_PATH/frontend/"
  rsync -avz --delete -e ssh \
    "$LOCAL_DIST/frontend/" \
    "$HOST:$REMOTE_PATH/frontend/"
}

sync_backend() {
  echo "▶ 同步后端代码（保留远端 node_modules / data / storage / .env）"
  rsync -avz \
    --exclude 'node_modules' \
    --exclude 'data' \
    --exclude 'storage' \
    --exclude '.env' \
    --exclude '.npm-cache' \
    -e ssh \
    "$LOCAL_DIST/backend/" \
    "$HOST:$REMOTE_PATH/backend/"
  echo ""
  echo "ℹ 后端代码已更新。如需生效，请在服务器执行："
  echo "   ssh $HOST 'cd $REMOTE_PATH/backend && npm install --omit=dev && pm2 reload photo-backend'"
}

case "$WHAT" in
  frontend) sync_frontend ;;
  backend)  sync_backend ;;
  all)
    sync_frontend
    sync_backend
    ;;
  *)
    echo "未知参数：$WHAT（支持：frontend / backend / all）" >&2
    exit 1
    ;;
esac

echo ""
echo "✅ 部署完成"
