/**
 * 跨环境复制文本工具。
 *
 * 兼容场景：
 * 1. HTTPS / localhost：用现代 `navigator.clipboard.writeText`
 * 2. HTTP 或非安全上下文（`navigator.clipboard` 为 undefined）：
 *    回退到隐藏 textarea + `document.execCommand('copy')`
 * 3. 极端环境（iframe 限制、用户拒绝权限等）：抛异常，调用方捕获后给出"长按选中复制"的兜底提示
 */
export async function copyText(text: string): Promise<void> {
  // 1) 现代 API（要求 secure context：https / localhost / 127.0.0.1）
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // 部分浏览器在 iframe 或权限被拒时会抛错，继续走兜底
    }
  }

  // 2) 兜底：textarea + execCommand
  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    // 移到屏幕外，避免影响布局；不能 display:none 否则 select 失败
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '1px';
    textarea.style.height = '1px';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    textarea.style.opacity = '0';
    textarea.setAttribute('readonly', '');
    document.body.appendChild(textarea);

    try {
      textarea.focus();
      textarea.select();
      // iOS 需要这两行才能选中
      textarea.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      if (!ok) throw new Error('execCommand copy returned false');
      return;
    } finally {
      document.body.removeChild(textarea);
    }
  }

  throw new Error('当前环境不支持复制');
}
