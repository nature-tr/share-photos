<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { MessagePlugin, NotifyPlugin } from 'tdesign-vue-next';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import type PhotoSwipe from 'photoswipe';
import 'photoswipe/style.css';
import { shareApi, photoApi } from '@/api/share.api';
import { ApiException } from '@/api/client';
import { formatRemaining, formatBytes } from '@photo/shared';
import type { ViewerAlbum } from '@photo/shared';
import { useDevice, canShareFiles, isInAppWebView, isWeChatBrowser } from '@/composables/useDevice';
import {
  saveImage,
  saveImagesViaShare,
  saveImagesSequentially,
  saveImagesToDirectory,
  splitIntoBatches,
  canPickDirectory,
  type BatchProgress,
} from '@/utils/download';
import { copyText } from '@/utils/clipboard';

const props = defineProps<{ code: string }>();
const router = useRouter();
const { isMobile } = useDevice();

const album = ref<ViewerAlbum | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const tick = ref(0);
let timer: number | null = null;
let lightbox: PhotoSwipeLightbox | null = null;

const downloadDialogVisible = ref(false);
const batchSaving = ref(false);
const batchProgress = ref<BatchProgress | null>(null);
const abortController = ref<AbortController | null>(null);

const supportsShare = canShareFiles();
const supportsPickDir = canPickDirectory();
const inWeChat = isWeChatBrowser();
const inAppWebView = isInAppWebView();
const wechatTipDismissed = ref(false);

const remaining = computed(() => {
  void tick.value;
  if (!album.value) return '';
  return formatRemaining(album.value.expiresAt - Date.now());
});

/** 总字节数 */
const totalBytes = computed(() => {
  if (!album.value) return 0;
  return album.value.photos.reduce((s, p) => s + p.sizeBytes, 0);
});

/** 估算需要分多少批 share */
const batchInfo = computed(() => {
  if (!album.value) return { batches: 0, totalBytes: 0 };
  const batches = splitIntoBatches(
    album.value.photos.map((p) => ({
      url: '',
      filename: p.originalName,
      sizeBytes: p.sizeBytes,
    })),
  );
  return { batches: batches.length, totalBytes: totalBytes.value };
});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    album.value = await shareApi.getByCode(props.code);
  } catch (err) {
    if (err instanceof ApiException) error.value = err.message;
    else error.value = '加载失败';
  } finally {
    loading.value = false;
  }
}

function attachSavePhotoButton(pswp: PhotoSwipe) {
  pswp.ui!.registerElement({
    name: 'save-button',
    order: 8,
    isButton: true,
    tagName: 'button',
    title: supportsShare ? '保存到相册' : '下载图片',
    html: {
      isCustomSVG: true,
      inner:
        '<path d="M16 4.5a.75.75 0 0 1 .75.75V18.94l3.97-3.97a.75.75 0 1 1 1.06 1.06l-5.25 5.25a.75.75 0 0 1-1.06 0l-5.25-5.25a.75.75 0 1 1 1.06-1.06l3.97 3.97V5.25A.75.75 0 0 1 16 4.5Z M7 24.5h18a.75.75 0 0 1 0 1.5H7a.75.75 0 0 1 0-1.5Z" id="pswp__icn-save"/>',
      outlineID: 'pswp__icn-save',
    },
    onClick: async () => {
      if (!album.value) return;
      const idx = pswp.currIndex;
      const photo = album.value.photos[idx];
      if (!photo) return;
      try {
        const result = await saveImage(photoApi.originalUrl(props.code, photo.id, true), {
          filename: photo.originalName,
          preferShare: isMobile.value && supportsShare,
          title: photo.originalName,
        });
        if (result === 'shared') MessagePlugin.success('请在系统面板选「存储图像」保存到相册');
        else if (result === 'downloaded') MessagePlugin.success('图片已下载');
      } catch (err) {
        MessagePlugin.error((err as Error).message ?? '保存失败');
      }
    },
  });
}

function initLightbox() {
  if (lightbox) {
    lightbox.destroy();
    lightbox = null;
  }
  lightbox = new PhotoSwipeLightbox({
    gallery: '#viewer-gallery',
    children: 'a.gallery-item',
    pswpModule: () => import('photoswipe'),
    bgOpacity: 0.95,
    showHideAnimationType: 'fade',
    pinchToClose: true,
    closeOnVerticalDrag: true,
  });
  lightbox.on('uiRegister', () => {
    if (lightbox?.pswp) attachSavePhotoButton(lightbox.pswp);
  });
  lightbox.init();
}

onMounted(async () => {
  await load();
  if (album.value && album.value.photos.length > 0) {
    setTimeout(initLightbox, 0);
  }
  timer = window.setInterval(() => {
    tick.value++;
  }, 1000);
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
  if (lightbox) lightbox.destroy();
  abortController.value?.abort();
});

function buildBatchItems() {
  if (!album.value) return [];
  return album.value.photos.map((p) => ({
    url: photoApi.originalUrl(props.code, p.id, true),
    filename: p.originalName,
    sizeBytes: p.sizeBytes,
  }));
}

async function saveOne(photoId: string, name: string) {
  try {
    const result = await saveImage(photoApi.originalUrl(props.code, photoId, true), {
      filename: name,
      preferShare: isMobile.value && supportsShare,
      title: name,
    });
    if (result === 'shared') MessagePlugin.success('请在系统面板选「存储图像」保存到相册');
    else if (result === 'downloaded') MessagePlugin.success('图片已下载');
  } catch (err) {
    MessagePlugin.error((err as Error).message ?? '保存失败');
  }
}

async function withBatchTracking<T>(fn: () => Promise<T>): Promise<T | null> {
  abortController.value = new AbortController();
  batchSaving.value = true;
  batchProgress.value = null;
  try {
    return await fn();
  } catch (err) {
    MessagePlugin.error((err as Error).message ?? '保存失败');
    return null;
  } finally {
    batchSaving.value = false;
    batchProgress.value = null;
    abortController.value = null;
  }
}

/** 移动端首选：一次性 share 全部到相册 */
async function handleSaveAllToAlbum() {
  if (!album.value) return;
  downloadDialogVisible.value = false;

  if (batchInfo.value.batches > 1) {
    NotifyPlugin.info({
      title: `图片较多，将分 ${batchInfo.value.batches} 批保存`,
      content: '每批弹出系统面板，请依次选「存储图像」',
      duration: 4500,
    });
  }

  const result = await withBatchTracking(() =>
    saveImagesViaShare(buildBatchItems(), {
      title: album.value!.title ?? '相册',
      signal: abortController.value!.signal,
      onProgress: (p) => {
        batchProgress.value = p;
      },
    }),
  );

  if (!result) return;
  if (result.cancelled) MessagePlugin.warning(`已取消，已保存 ${result.done}/${result.total}`);
  else if (result.failed > 0) MessagePlugin.warning(`完成 ${result.done}/${result.total}，失败 ${result.failed}`);
  else MessagePlugin.success(`已唤起系统面板，请选「存储图像」保存到相册（${result.total} 张）`);
}

/** 逐张{保存到相册 | 下载} */
async function handleSaveAllSequentially() {
  if (!album.value) return;
  downloadDialogVisible.value = false;

  const result = await withBatchTracking(() =>
    saveImagesSequentially(buildBatchItems(), {
      preferShare: sequentialPreferShare.value,
      title: album.value!.title ?? '相册',
      signal: abortController.value!.signal,
      onProgress: (p) => {
        batchProgress.value = p;
      },
    }),
  );

  if (!result) return;
  if (result.cancelled) MessagePlugin.warning(`已取消，已保存 ${result.done}/${result.total}`);
  else MessagePlugin.success(`完成 ${result.done}/${result.total}`);
}

/** 桌面：选择文件夹一次性写入 */
async function handleSaveAllToDirectory() {
  if (!album.value) return;
  downloadDialogVisible.value = false;

  const result = await withBatchTracking(() =>
    saveImagesToDirectory(buildBatchItems(), {
      signal: abortController.value!.signal,
      onProgress: (p) => {
        batchProgress.value = p;
      },
    }),
  );

  if (!result) return;
  if (result.cancelled) MessagePlugin.info(`已取消，已保存 ${result.done}/${result.total}`);
  else if (result.failed > 0) MessagePlugin.warning(`完成 ${result.done}/${result.total}，失败 ${result.failed}`);
  else MessagePlugin.success(`已保存 ${result.total} 张到所选文件夹`);
}

function downloadZip() {
  if (!album.value) return;
  downloadDialogVisible.value = false;
  MessagePlugin.info('开始打包下载（首次较大可能较慢）');
  window.location.href = photoApi.zipDownloadUrl(props.code);
}

function cancelBatch() {
  abortController.value?.abort();
}

function onMainDownloadClick() {
  if (!album.value || album.value.photos.length === 0) return;
  downloadDialogVisible.value = true;
}

async function copyLinkInDialog() {
  try {
    await copyText(window.location.href);
    MessagePlugin.success('链接已复制，请粘贴到浏览器');
  } catch {
    MessagePlugin.warning('复制失败，请长按地址栏手动复制');
  }
}

/** 浏览器外打开的提示文案 */
const externalOpenHint = computed(() => {
  if (inWeChat) return '请点击右上角「⋯」选择「在浏览器打开」';
  return '请用系统自带浏览器（Safari / Chrome）打开本页面再下载';
});

/** 是否显示「保存到相册」相关方案（仅移动端真机浏览器，且 share files 可用） */
const showAlbumSave = computed(() => isMobile.value && supportsShare && !inAppWebView);

/** 是否显示「桌面选文件夹」 */
const showPickDir = computed(() => !isMobile.value && supportsPickDir);

/** 「逐张保存」是否走 share（仅移动端真机），否则走下载 */
const sequentialPreferShare = computed(() => isMobile.value && supportsShare);

function gotoHome() {
  router.push({ name: 'home' });
}

async function copyShareLink() {
  const url = window.location.href;
  try {
    await copyText(url);
    MessagePlugin.success('链接已复制');
  } catch {
    MessagePlugin.warning('复制失败，请长按选中手动复制');
  }
}

const progressText = computed(() => {
  if (!batchProgress.value) return '';
  const p = batchProgress.value;
  const phaseText = p.phase === 'downloading' ? '准备图片' : p.phase === 'sharing' ? '等待系统面板' : '保存中';
  const batchText = p.totalBatches && p.totalBatches > 1 ? ` · 第 ${p.batch}/${p.totalBatches} 批` : '';
  return `${phaseText}（${p.done}/${p.total}）${batchText}`;
});
</script>

<template>
  <div class="viewer">
    <header class="viewer-header">
      <div class="container header-bar">
        <button class="icon-btn" @click="gotoHome" aria-label="返回首页">
          <span class="i-tdesign:chevron-left text-22px"></span>
        </button>
        <div class="title-block">
          <div class="title">{{ album?.title || '相册' }}</div>
          <div class="sub" v-if="album">
            <code>{{ props.code }}</code>
            <span class="dot">·</span>
            <span>{{ album.photos.length }} 张</span>
            <span class="dot hide-sm">·</span>
            <span class="hide-sm">{{ formatBytes(totalBytes) }}</span>
            <span class="dot">·</span>
            <span class="remaining-text">剩余 {{ remaining }}</span>
          </div>
        </div>
        <div class="header-actions">
          <button class="icon-btn" @click="copyShareLink" aria-label="复制链接">
            <span class="i-tdesign:share text-20px"></span>
          </button>
          <t-button
            v-if="album && album.photos.length > 0"
            theme="primary"
            size="small"
            class="download-main"
            :loading="batchSaving"
            @click="onMainDownloadClick"
          >
            <template #icon><span class="i-tdesign:download"></span></template>
            <span class="download-text">下载</span>
          </t-button>
        </div>
      </div>
    </header>

    <!-- 微信/App 内置浏览器引导横幅 -->
    <div v-if="inAppWebView && !wechatTipDismissed" class="webview-banner">
      <div class="container webview-banner-inner">
        <span class="i-tdesign:browser webview-icon"></span>
        <div class="webview-text">
          <div class="webview-title">想保存图片到相册？</div>
          <div class="webview-desc">{{ externalOpenHint }}，否则系统不允许网页保存到相册。</div>
        </div>
        <button class="webview-close" @click="wechatTipDismissed = true" aria-label="收起提示">
          <span class="i-tdesign:close text-16px"></span>
        </button>
      </div>
    </div>

    <main class="viewer-main">
      <t-loading :loading="loading">
        <div v-if="error" class="error-state">
          <span class="i-tdesign:close-circle text-64px text-danger"></span>
          <h3>{{ error }}</h3>
          <p class="muted">请确认分享码是否正确，或该分享是否已过期</p>
          <t-button theme="primary" @click="gotoHome">返回首页</t-button>
        </div>

        <div v-else-if="album && album.photos.length === 0" class="empty-state">
          <span class="i-tdesign:image-1 text-64px op-30"></span>
          <p class="muted">该分享尚未上传图片</p>
        </div>

        <div v-else-if="album" id="viewer-gallery" class="gallery">
          <a
            v-for="p in album.photos"
            :key="p.id"
            :href="photoApi.originalUrl(props.code, p.id)"
            :data-pswp-src="photoApi.originalUrl(props.code, p.id)"
            :data-pswp-width="p.width"
            :data-pswp-height="p.height"
            target="_blank"
            class="gallery-item"
            @click.prevent
          >
            <img
              :src="photoApi.thumbUrl(props.code, p.id)"
              :alt="p.originalName"
              loading="lazy"
            />
            <button
              class="quick-save"
              :title="supportsShare ? '保存到相册' : '下载'"
              @click.prevent.stop="saveOne(p.id, p.originalName)"
            >
              <span class="i-tdesign:download text-16px"></span>
            </button>
          </a>
        </div>
      </t-loading>
    </main>

    <!-- 下载方式选择 -->
    <t-dialog
      v-model:visible="downloadDialogVisible"
      :footer="false"
      :close-btn="true"
      placement="center"
      width="92%"
      class="download-dialog"
    >
      <template #header>批量下载方式</template>

      <!-- App 内置浏览器：直接显示引导，禁用其他选项 -->
      <div v-if="inAppWebView" class="webview-tip-block">
        <span class="webview-tip-icon i-tdesign:browser"></span>
        <h3>当前在 {{ inWeChat ? '微信' : 'App' }} 内置浏览器</h3>
        <p class="webview-tip-msg">{{ externalOpenHint }}</p>
        <p class="muted webview-tip-sub">
          这是系统限制：网页保存图片到相册需要原生浏览器（Safari / Chrome）权限。
        </p>
        <div class="webview-actions">
          <t-button theme="primary" block @click="copyLinkInDialog">
            <template #icon><span class="i-tdesign:link"></span></template>
            复制链接
          </t-button>
          <t-button variant="outline" block @click="downloadDialogVisible = false">
            知道了
          </t-button>
        </div>
      </div>

      <!-- 普通浏览器：显示按平台过滤的下载选项 -->
      <template v-else>
        <div class="dl-info" v-if="album">
          共 {{ album.photos.length }} 张 · {{ formatBytes(totalBytes) }}
        </div>
        <div class="dl-options">
          <!-- 移动端首选：一次性 share 全部进相册 -->
          <button
            v-if="showAlbumSave"
            class="dl-card primary"
            :disabled="batchSaving"
            @click="handleSaveAllToAlbum"
          >
            <span class="dl-icon i-tdesign:image-1"></span>
            <div class="dl-text">
              <div class="dl-title">
                一次性保存到相册
                <span class="badge recommend">推荐</span>
              </div>
              <div class="dl-desc">
                <template v-if="batchInfo.batches <= 1">
                  系统弹出一次面板，点「存储图像」即可全部保存到相册
                </template>
                <template v-else>
                  图片较多，将分 {{ batchInfo.batches }} 批，每批点一次「存储图像」
                </template>
              </div>
            </div>
          </button>

          <!-- 桌面：选文件夹批量写入 -->
          <button
            v-if="showPickDir"
            class="dl-card primary"
            :disabled="batchSaving"
            @click="handleSaveAllToDirectory"
          >
            <span class="dl-icon i-tdesign:folder-open"></span>
            <div class="dl-text">
              <div class="dl-title">
                保存到本地文件夹
                <span class="badge recommend">推荐</span>
              </div>
              <div class="dl-desc">选一个文件夹，浏览器一次性写入所有原图</div>
            </div>
          </button>

          <!-- 通用：zip 打包（手机上不再推荐） -->
          <button v-if="!isMobile || !showAlbumSave" class="dl-card" :disabled="batchSaving" @click="downloadZip">
            <span class="dl-icon i-tdesign:zip"></span>
            <div class="dl-text">
              <div class="dl-title">打包 zip 下载</div>
              <div class="dl-desc">{{ isMobile ? '手机需在文件 App 内解压后再保存' : '电脑直接解压使用' }}</div>
            </div>
          </button>

          <!-- 兜底：逐张 -->
          <button
            v-if="album && album.photos.length > 1"
            class="dl-card secondary"
            :disabled="batchSaving"
            @click="handleSaveAllSequentially"
          >
            <span class="dl-icon i-tdesign:image-search"></span>
            <div class="dl-text">
              <div class="dl-title">
                逐张{{ sequentialPreferShare ? '保存到相册' : '下载到本地' }}
              </div>
              <div class="dl-desc">
                <template v-if="sequentialPreferShare">
                  每张单独唤起系统面板（兼容性最好）
                </template>
                <template v-else>
                  自动间隔 700ms 触发下载，避免被浏览器拦截
                </template>
              </div>
            </div>
          </button>

          <!-- iOS Safari 老版本提示 -->
          <div class="dl-tip" v-if="isMobile && !supportsShare">
            <span class="i-tdesign:info-circle text-14px"></span>
            <span>
              当前浏览器不支持「直接存到相册」。建议升级到 iOS 16.4+ Safari，
              或在大图查看时<b>长按图片 → 添加到照片</b>。
            </span>
          </div>
          <!-- 桌面提示：长链接限制说明 -->
          <div class="dl-tip" v-if="!isMobile && !showPickDir">
            <span class="i-tdesign:info-circle text-14px"></span>
            <span>建议用 Chrome / Edge 桌面版，可直接「保存到本地文件夹」体验更佳。</span>
          </div>
        </div>
      </template>
    </t-dialog>

    <!-- 底部进度条（批量下载中） -->
    <div v-if="batchSaving && batchProgress" class="batch-progress">
      <div class="bp-content">
        <div class="bp-text">{{ progressText }}</div>
        <t-progress
          :percentage="batchProgress.total ? Math.round((batchProgress.done / batchProgress.total) * 100) : 0"
          :stroke-width="6"
        />
      </div>
      <t-button size="small" variant="text" @click="cancelBatch">取消</t-button>
    </div>
  </div>
</template>

<style scoped>
.viewer {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.viewer-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: var(--blur-bg);
  -webkit-backdrop-filter: var(--blur-bg);
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  padding-top: var(--safe-top);
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  padding: 0 20px;
}

.header-bar {
  height: 60px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-2);
  flex-shrink: 0;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.icon-btn:active,
.icon-btn:hover {
  background: var(--surface-hover);
  color: var(--text-1);
}

.title-block {
  flex: 1;
  min-width: 0;
}

.title {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.2px;
  color: var(--text-1);
}

.sub {
  font-size: 12px;
  color: var(--text-3);
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.sub code {
  font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace;
  letter-spacing: 1.5px;
  color: var(--primary);
  font-weight: 600;
}

.dot {
  opacity: 0.4;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.download-main {
  height: 40px;
  padding: 0 14px;
}

.viewer-main {
  flex: 1;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px 12px 80px;
}

.error-state,
.empty-state {
  text-align: center;
  padding: 100px 16px;
}

.error-state h3 {
  margin: 16px 0 8px;
  font-size: 18px;
  font-weight: 600;
}

/* —— 网格 —— */
.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.gallery-item {
  position: relative;
  aspect-ratio: 1 / 1;
  background: var(--surface-hover);
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: zoom-in;
  display: block;
  -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
  transition: transform var(--transition);
}

.gallery-item:hover {
  transform: scale(1.015);
  z-index: 1;
}

.gallery-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-slow);
}

.gallery-item:hover img {
  transform: scale(1.05);
}

.quick-save {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--transition), background var(--transition-fast);
  -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
}

.quick-save:hover {
  background: var(--primary);
}

.gallery-item:hover .quick-save {
  opacity: 1;
}

/* —— Dialog —— */
.dl-info {
  font-size: 13px;
  color: var(--text-3);
  margin: -4px 0 16px;
}

.dl-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 0;
}

.dl-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px;
  background: var(--surface-soft);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  transition: all var(--transition-fast);
  width: 100%;
  font-family: inherit;
  font-size: inherit;
  color: inherit;
}

.dl-card:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dl-card:not(:disabled):hover {
  background: var(--surface-hover);
  border-color: var(--border);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.dl-card.primary {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.06), rgba(139, 92, 246, 0.06));
  border-color: rgba(37, 99, 235, 0.18);
}

.dl-card.primary:not(:disabled):hover {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.1), rgba(139, 92, 246, 0.1));
  border-color: rgba(37, 99, 235, 0.3);
}

.dl-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
}

.dl-card.primary .dl-icon {
  background: linear-gradient(135deg, var(--primary), var(--accent));
  color: #fff;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
}

.dl-text {
  flex: 1;
  min-width: 0;
}

.dl-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-1);
}

.badge {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 8px;
  border-radius: var(--radius-full);
  background: var(--primary);
  color: #fff;
}

.dl-desc {
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.5;
}

.dl-tip {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12px;
  color: var(--text-3);
  padding: 8px 12px 0;
  line-height: 1.6;
}
.dl-tip b {
  color: var(--text-1);
  font-weight: 600;
}

/* —— 微信/App 内置浏览器引导 —— */
.webview-banner {
  background: linear-gradient(135deg, #fff7ed, #fef3c7);
  border-bottom: 1px solid rgba(180, 83, 9, 0.15);
  position: sticky;
  top: calc(60px + var(--safe-top));
  z-index: 9;
}
.webview-banner-inner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
}
.webview-icon {
  font-size: 24px;
  color: #b45309;
  flex-shrink: 0;
}
.webview-text {
  flex: 1;
  min-width: 0;
}
.webview-title {
  font-size: 13px;
  font-weight: 600;
  color: #78350f;
}
.webview-desc {
  font-size: 12px;
  color: #92400e;
  line-height: 1.5;
  margin-top: 2px;
}
.webview-close {
  background: transparent;
  border: none;
  color: #92400e;
  cursor: pointer;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.webview-close:hover {
  background: rgba(180, 83, 9, 0.1);
}

.webview-tip-block {
  text-align: center;
  padding: 8px 4px 4px;
}
.webview-tip-icon {
  display: inline-block;
  font-size: 56px;
  color: var(--primary);
  margin-bottom: 12px;
}
.webview-tip-block h3 {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-1);
  margin: 0 0 8px;
}
.webview-tip-msg {
  font-size: 14px;
  color: var(--text-2);
  margin: 0 0 12px;
  line-height: 1.6;
}
.webview-tip-sub {
  font-size: 12px;
  line-height: 1.6;
  margin: 0 0 18px;
  padding: 10px 14px;
  background: var(--surface-soft);
  border-radius: var(--radius-md);
  text-align: left;
}
.webview-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* —— 进度条 —— */
.batch-progress {
  position: fixed;
  bottom: 16px;
  left: 16px;
  right: 16px;
  max-width: 480px;
  margin: 0 auto;
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-light);
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  z-index: 100;
}

.bp-content {
  flex: 1;
  min-width: 0;
}

.bp-text {
  font-size: 13px;
  margin-bottom: 8px;
  color: var(--text-1);
  font-weight: 500;
}

.muted { color: var(--text-3); }
.text-danger { color: var(--danger); }

/* === 响应式 === */
@media (pointer: coarse) {
  .quick-save {
    opacity: 1;
  }
  .gallery-item:hover img {
    transform: none;
  }
}

@media (max-width: 768px) {
  .container {
    padding: 0 14px;
    padding-left: max(14px, var(--safe-left));
    padding-right: max(14px, var(--safe-right));
  }
  .header-bar {
    height: 54px;
    gap: 6px;
  }
  .icon-btn {
    width: 38px;
    height: 38px;
  }
  .title {
    font-size: 15px;
  }
  .sub {
    font-size: 11px;
    line-height: 1.4;
    gap: 5px;
  }
  .sub .hide-sm {
    display: none;
  }
  .gallery {
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
  }
  .gallery-item {
    border-radius: var(--radius-sm);
  }
  .download-text {
    display: none;
  }
  .download-main {
    height: 38px;
    padding: 0 12px;
    min-width: 38px;
  }
  .quick-save {
    width: 30px;
    height: 30px;
    bottom: 6px;
    right: 6px;
  }
  .viewer-main {
    padding: 12px 8px;
    padding-bottom: max(80px, calc(var(--safe-bottom) + 80px));
    padding-left: max(8px, var(--safe-left));
    padding-right: max(8px, var(--safe-right));
  }
  /* 进度条贴底，避开安全区 */
  .batch-progress {
    bottom: max(16px, calc(var(--safe-bottom) + 12px));
    left: 12px;
    right: 12px;
    padding: 12px 14px;
  }
  /* Dialog 移动端优化 */
  :deep(.t-dialog) {
    max-height: 80vh;
  }
  .dl-card {
    padding: 14px;
    border-radius: var(--radius-md);
  }
  .dl-icon {
    width: 38px;
    height: 38px;
    font-size: 20px;
  }
  .dl-title {
    font-size: 14px;
  }
  .dl-desc {
    font-size: 12px;
  }
  .webview-banner {
    top: calc(54px + var(--safe-top));
  }
  .webview-banner-inner {
    padding: 9px 14px;
    padding-left: max(14px, var(--safe-left));
    padding-right: max(14px, var(--safe-right));
    gap: 10px;
  }
  .webview-icon {
    font-size: 22px;
  }
  .webview-title {
    font-size: 12.5px;
  }
  .webview-desc {
    font-size: 11.5px;
  }
}

/* 极小屏：2 列 */
@media (max-width: 380px) {
  .gallery {
    grid-template-columns: repeat(2, 1fr);
    gap: 5px;
  }
  .sub {
    font-size: 10.5px;
  }
  .header-bar {
    gap: 4px;
  }
}
</style>
