#!/usr/bin/env bash
# ============================================
# 一键配置 Expo / RN Android 本地构建环境（macOS）
# ============================================
# 总耗时预估：20-30 分钟（取决于网速，主要是 cmdline-tools 和 sdk 下载）
#
# 用法（复制粘贴整段到终端）：
#   bash /Users/chengtianran/CodeBuddy/photo/scripts/setup-android-build.sh
#
# 脚本中途会要求输 Mac 密码（brew 安装时）和确认 license（自动 yes）。

set -e

echo "▶ 1/6 安装 Homebrew（如已装则跳过）"
if ! command -v brew >/dev/null 2>&1; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Apple Silicon 上 brew 默认装到 /opt/homebrew
  if [ -d /opt/homebrew/bin ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
    grep -q 'brew shellenv' ~/.zprofile 2>/dev/null || \
      echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
  fi
fi
echo "  brew $(brew --version | head -1)"

echo ""
echo "▶ 2/6 安装 JDK 17（Eclipse Temurin）"
if ! /usr/libexec/java_home -v 17 >/dev/null 2>&1; then
  brew install --cask temurin@17
fi
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
echo "  JAVA_HOME=$JAVA_HOME"

echo ""
echo "▶ 3/6 安装 Android command-line tools"
if ! brew list --cask android-commandlinetools >/dev/null 2>&1; then
  brew install --cask android-commandlinetools
fi

# brew cask 装的位置：
#   Apple Silicon: /opt/homebrew/share/android-commandlinetools
#   Intel:         /usr/local/share/android-commandlinetools
if [ -d /opt/homebrew/share/android-commandlinetools ]; then
  ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
else
  ANDROID_HOME=/usr/local/share/android-commandlinetools
fi
export ANDROID_HOME
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
echo "  ANDROID_HOME=$ANDROID_HOME"

echo ""
echo "▶ 4/6 接受 Android SDK license（自动 yes）"
yes | sdkmanager --licenses >/dev/null 2>&1 || true

echo ""
echo "▶ 5/6 安装 Android SDK 核心包（约 1.5 GB，最久的一步）"
sdkmanager \
  "platform-tools" \
  "platforms;android-35" \
  "build-tools;35.0.0" \
  "ndk;27.1.12297006" 2>&1 | tail -5

echo ""
echo "▶ 6/6 写入环境变量到 ~/.zshrc"
ZSHRC="$HOME/.zshrc"
add_line() {
  local line="$1"
  grep -qF "$line" "$ZSHRC" 2>/dev/null || echo "$line" >> "$ZSHRC"
}
add_line ''
add_line '# ===== Android / JDK for Expo build ====='
add_line 'export JAVA_HOME=$(/usr/libexec/java_home -v 17)'
add_line "export ANDROID_HOME=$ANDROID_HOME"
add_line 'export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/35.0.0:$PATH'

echo ""
echo "═══════════════════════════════════════════"
echo "✅ 环境配置完成"
echo ""
echo "JAVA_HOME=$JAVA_HOME"
echo "ANDROID_HOME=$ANDROID_HOME"
echo ""
echo "下一步（在新终端，或先 source ~/.zshrc）："
echo "  cd /Users/chengtianran/CodeBuddy/photo/app"
echo "  npx eas-cli@latest build --platform android --profile preview --local"
echo "═══════════════════════════════════════════"
