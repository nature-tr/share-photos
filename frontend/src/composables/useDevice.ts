import { ref, onMounted, onUnmounted, computed } from 'vue';

/**
 * 设备类型与能力检测。
 * - isMobile：通过 pointer:coarse 媒体查询判断（覆盖触屏笔记本最准确的方式）
 * - canShareFiles：是否支持 Web Share API 分享文件
 */
export function useDevice() {
  const isCoarsePointer = ref(false);
  const isNarrow = ref(false);

  function update() {
    isCoarsePointer.value = window.matchMedia('(pointer: coarse)').matches;
    isNarrow.value = window.matchMedia('(max-width: 768px)').matches;
  }

  onMounted(() => {
    update();
    window.addEventListener('resize', update);
  });
  onUnmounted(() => {
    window.removeEventListener('resize', update);
  });

  const isMobile = computed(() => isCoarsePointer.value || isNarrow.value);

  return {
    isMobile,
    isCoarsePointer,
    isNarrow,
  };
}

/** 当前设备是否支持 Web Share API 分享文件 */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare !== 'function') return false;
  try {
    // 用一个 1 字节的占位文件检测
    const probe = new File([new Uint8Array([0])], 'probe.txt', { type: 'text/plain' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** 是否在微信内置浏览器（X5/WKWebView） */
export function isWeChatBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /micromessenger/i.test(navigator.userAgent);
}

/** 是否在常见 App 内置 WebView（微信/企业微信/QQ/钉钉/飞书）。
 *  这些环境下 navigator.share / 多文件下载几乎都被劫持，需要强引导用户在系统浏览器打开 */
export function isInAppWebView(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /micromessenger|wxwork|qq\/|qqbrowser\/mqq|dingtalk|lark|feishu/i.test(navigator.userAgent);
}
