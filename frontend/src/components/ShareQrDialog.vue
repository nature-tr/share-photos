<script setup lang="ts">
/**
 * 分享二维码弹窗
 * - PC：弹窗居中显示二维码
 * - 移动端：贴底 sheet（继承 global.css 的 t-dialog 移动端样式）
 *
 * 内嵌的二维码可：
 * - 移动端长按 → 「保存图像」直接进相册
 * - PC 右键 → 「图片另存为」
 * - 也可点「下载二维码」按钮主动保存
 */
import { computed, ref, watch, nextTick } from 'vue';
import QRCode from 'qrcode';
import { MessagePlugin } from 'tdesign-vue-next';
import { copyText } from '@/utils/clipboard';

const props = defineProps<{
  visible: boolean;
  code: string;
  title?: string;
}>();

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void;
}>();

const dataUrl = ref('');
const url = computed(() =>
  props.code ? `${window.location.origin}/v/${props.code}` : '',
);

async function generate() {
  if (!url.value) return;
  try {
    dataUrl.value = await QRCode.toDataURL(url.value, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 480,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
  } catch (err) {
    MessagePlugin.error('二维码生成失败');
    console.error(err);
  }
}

watch(
  () => [props.visible, props.code] as const,
  async ([v, code]) => {
    if (v && code) {
      // 等 DOM 就绪后生成（防止 SSR/首屏布局闪一下）
      await nextTick();
      await generate();
    } else if (!v) {
      dataUrl.value = '';
    }
  },
  { immediate: true },
);

function close() {
  emit('update:visible', false);
}

async function onCopyLink() {
  try {
    await copyText(url.value);
    MessagePlugin.success('链接已复制');
  } catch {
    MessagePlugin.warning('复制失败，请长按选中手动复制');
  }
}

async function onCopyCode() {
  try {
    await copyText(props.code);
    MessagePlugin.success('分享码已复制');
  } catch {
    MessagePlugin.warning('复制失败，请长按选中手动复制');
  }
}

function onDownload() {
  if (!dataUrl.value) return;
  const a = document.createElement('a');
  a.href = dataUrl.value;
  a.download = `share-${props.code}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  MessagePlugin.success('二维码已保存');
}
</script>

<template>
  <t-dialog
    :visible="props.visible"
    :footer="false"
    :close-btn="true"
    placement="center"
    width="92%"
    class="qr-dialog"
    @update:visible="(v: boolean) => emit('update:visible', v)"
    @close="close"
  >
    <template #header>分享二维码</template>
    <div class="qr-body">
      <div v-if="props.title" class="qr-title">{{ props.title }}</div>
      <div class="qr-frame">
        <img
          v-if="dataUrl"
          :src="dataUrl"
          :alt="`分享码 ${props.code} 的二维码`"
          class="qr-img"
        />
        <div v-else class="qr-placeholder">
          <span class="i-tdesign:loading"></span>
        </div>
      </div>

      <div class="qr-code">
        <span class="qr-code-label">分享码</span>
        <code class="qr-code-text">{{ props.code }}</code>
      </div>

      <div class="qr-url">{{ url }}</div>

      <div class="qr-tip">
        <span class="i-tdesign:tips text-14px"></span>
        <span>对方扫码即可访问，无需手动输入</span>
      </div>

      <div class="qr-actions">
        <t-button theme="primary" block @click="onDownload" :disabled="!dataUrl">
          <template #icon><span class="i-tdesign:download"></span></template>
          下载二维码图片
        </t-button>
        <div class="qr-actions-row">
          <t-button variant="outline" block @click="onCopyCode">
            <template #icon><span class="i-tdesign:copy"></span></template>
            复制分享码
          </t-button>
          <t-button variant="outline" block @click="onCopyLink">
            <template #icon><span class="i-tdesign:link"></span></template>
            复制链接
          </t-button>
        </div>
      </div>
    </div>
  </t-dialog>
</template>

<style scoped>
.qr-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 4px 0 8px;
}

.qr-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 4px;
}

.qr-frame {
  position: relative;
  width: 240px;
  height: 240px;
  background: #fff;
  border-radius: var(--radius-lg);
  padding: 12px;
  box-sizing: border-box;
  box-shadow: 0 6px 24px rgba(15, 23, 42, 0.08);
  border: 1px solid var(--border-light);
}

.qr-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  /* 提示 iOS Safari 长按可保存 */
  -webkit-touch-callout: default;
}

.qr-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: var(--text-3);
  animation: spin 1.4s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.qr-code {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.qr-code-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: var(--text-3);
  font-weight: 500;
}

.qr-code-text {
  font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace;
  font-size: 22px;
  letter-spacing: 5px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.qr-url {
  font-size: 12px;
  color: var(--text-3);
  word-break: break-all;
  text-align: center;
  padding: 0 8px;
  line-height: 1.5;
  user-select: all;
  -webkit-user-select: all;
  max-width: 100%;
}

.qr-tip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-3);
  background: var(--surface-soft);
  padding: 6px 12px;
  border-radius: var(--radius-full);
}

.qr-actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 4px;
}

.qr-actions-row {
  display: flex;
  gap: 8px;
}

.qr-actions-row .t-button {
  flex: 1;
}

@media (max-width: 768px) {
  .qr-frame {
    width: 220px;
    height: 220px;
    padding: 10px;
  }
  .qr-code-text {
    font-size: 20px;
    letter-spacing: 4px;
  }
}
</style>
