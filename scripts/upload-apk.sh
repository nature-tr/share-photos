#!/usr/bin/env bash
#
# 把本地构建好的 Android APK 上传到 www.dolmo.top，对外提供下载。
#
# 用法：
#   bash scripts/upload-apk.sh                     # 上传 app/dolmo-photo-v*.apk 中最新的一个
#   bash scripts/upload-apk.sh path/to/xxx.apk     # 指定 apk 文件
#
# 上传后两个 URL 都可用：
#   https://www.dolmo.top/dolmo-photo-v<版本>.apk   ← 永久链接，建议发给朋友
#   https://www.dolmo.top/dolmo-photo.apk          ← latest 软链
#
# ⚠️ 注意：scripts/deploy.sh frontend 用 rsync --delete 同步，会把远端 apk 删掉。
#         每次部署完前端后，需要再跑一次本脚本。
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${PHOTO_DEPLOY_HOST:-root@www.dolmo.top}"
REMOTE_DIR="${PHOTO_DEPLOY_PATH:-/root/dolmo_projects/share_photos/dist-release}/frontend/dist"

if [ $# -ge 1 ]; then
  APK="$1"
else
  APK="$(ls -t "$REPO_ROOT"/app/dolmo-photo-v*.apk 2>/dev/null | head -1 || true)"
fi

if [ -z "${APK:-}" ] || [ ! -f "$APK" ]; then
  echo "❌ 找不到 apk 文件。请先构建：" >&2
  echo "   cd app && npx eas-cli build --platform android --profile preview --local" >&2
  exit 1
fi

NAME="$(basename "$APK")"
SIZE="$(ls -lh "$APK" | awk '{print $5}')"

echo "▶ 准备上传:"
echo "   $APK  ($SIZE)"
echo "   → $HOST:$REMOTE_DIR/$NAME"
echo ""

scp -o StrictHostKeyChecking=no "$APK" "$HOST:$REMOTE_DIR/$NAME"

ssh -o StrictHostKeyChecking=no "$HOST" "cd '$REMOTE_DIR' && ln -sfn '$NAME' dolmo-photo.apk && ls -lh dolmo-photo*.apk"

echo ""
echo "✅ 上传完成。下载链接："
echo "   https://www.dolmo.top/$NAME           （永久链接）"
echo "   https://www.dolmo.top/dolmo-photo.apk  （latest）"
