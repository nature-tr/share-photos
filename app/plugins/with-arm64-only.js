/**
 * 限制 Android 只编 arm64-v8a 一个 ABI。
 * - apk 从 ~107MB 降到 ~40MB（减一半 native .so）
 * - 显著降低 CMake 编译期内存占用，避免 OOM
 * - 2017 年后所有安卓手机都是 arm64-v8a，覆盖 99%+ 设备
 */
const { withGradleProperties } = require('expo/config-plugins');

module.exports = function withArm64Only(config) {
  return withGradleProperties(config, (cfg) => {
    const existing = cfg.modResults.find(
      (it) => it.type === 'property' && it.key === 'reactNativeArchitectures',
    );
    if (existing) {
      existing.value = 'arm64-v8a';
    } else {
      cfg.modResults.push({
        type: 'property',
        key: 'reactNativeArchitectures',
        value: 'arm64-v8a',
      });
    }
    return cfg;
  });
};
