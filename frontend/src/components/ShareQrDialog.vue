<script setup lang="ts">
/**
 * 分享二维码弹窗
 * - PC：居中圆角对话框
 * - 移动端：贴底 sheet（圆角顶部 + handle），与 app 端 ShareQrSheet 视觉一致
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
    :width="380"
    class="qr-dialog"
    @update:visible="(v: boolean) => emit('update:visible', v)"
    @close="close"
  >
    <template #header>
      <div class="qr-header">
        <div class="qr-header-title">{{ props.title || '分享相册' }}</div>
        <div class="qr-header-sub">对方扫码即可访问，无需手动输入</div>
      </div>
    </template>

    <div class="qr-body">
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

      <div class="qr-code-text">{{ props.code }}</div>

      <div class="qr-url">{{ url }}</div>

      <div class="qr-actions">
        <t-button theme="primary" block size="large" @click="onDownload" :disabled="!dataUrl">
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
.qr-header {
  text-align: center;
  padding: 4px 0;
}
.qr-header-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-1);
  letter-spacing: -0.2px;
}
.qr-header-sub {
  font-size: 13px;
  color: var(--text-3);
  margin-top: 4px;
  font-weight: 400;
}

.qr-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 6px 0 4px;
}

.qr-frame {
  width: 220px;
  height: 220px;
  background: #fff;
  border-radius: 16px;
  padding: 12px;
  box-sizing: border-box;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
  border: 1px solid var(--border-light);
}

.qr-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
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

.qr-code-text {
  font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace;
  font-size: 28px;
  letter-spacing: 6px;
  font-weight: 800;
  color: var(--primary);
  background: linear-gradient(135deg, var(--primary), var(--accent));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-top: 4px;
}

.qr-url {
  font-size: 12px;
  color: var(--text-3);
  word-break: break-all;
  text-align: center;
  padding: 8px 14px;
  line-height: 1.5;
  background: var(--surface-soft);
  border-radius: var(--radius-md);
  user-select: all;
  -webkit-user-select: all;
  max-width: 100%;
  font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace;
}

.qr-actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 6px;
}

.qr-actions-row {
  display: flex;
  gap: 8px;
}

.qr-actions-row .t-button {
  flex: 1;
}

/* 移动端：global.css 已经把 t-dialog 做成贴底 sheet（圆角顶 + transform:none），
   这里只调内部内容尺寸，不要再覆盖 dialog 容器的 transform / position，
   否则会与 global 样式冲突导致弹窗飘到屏外。 */
@media (max-width: 640px) {
  .qr-frame {
    width: 200px;
    height: 200px;
    padding: 10px;
  }
  .qr-code-text {
    font-size: 24px;
    letter-spacing: 5px;
  }
}
</style>
