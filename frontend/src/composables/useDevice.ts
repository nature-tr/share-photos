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

/** 是否触屏设备（pointer:coarse），同步版（用于一次性判断） */
export function isCoarsePointerSync(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

/** 是否在微信内置浏览器（X5/WKWebView） */
export function isWeChatBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /micromessenger/i.test(navigator.userAgent);
}

/** 是否在常见 App 内置 WebView（微信/企业微信/QQ/钉钉/飞书）
 *  这些环境下 navigator.share / 多文件下载 几乎都被劫持，需要强引导用户在浏览器打开 */
export function isInAppWebView(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /micromessenger|wxwork|qq\/|qqbrowser\/mqq|dingtalk|lark|feishu/i.test(navigator.userAgent);
}

/** 是否 iOS（iPhone / iPad / iPod；含 iPadOS Safari 桌面 UA 兜底） */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS Safari 默认报 Mac UA，但有触屏
  return /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
}

/** 是否 Android */
export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}
