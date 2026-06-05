<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import type PhotoSwipe from 'photoswipe';
import 'photoswipe/style.css';
import { shareApi, photoApi } from '@/api/share.api';
import { ApiException } from '@/api/client';
import { formatRemaining, formatBytes } from '@photo/shared';
import type { ViewerAlbum, ContributorInfo } from '@photo/shared';
import { useDevice, canShareFiles, isInAppWebView, isWeChatBrowser } from '@/composables/useDevice';
import { saveImage } from '@/utils/download';
import { copyText } from '@/utils/clipboard';
import { useAuthStore } from '@/stores/auth.store';

const props = defineProps<{ code: string }>();
const router = useRouter();
const { isMobile } = useDevice();
const auth = useAuthStore();

const album = ref<ViewerAlbum | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const tick = ref(0);
const loadMore = ref(false);
const page = ref(1);
const hasMore = ref(false);
const isOwner = ref(false);
const uploadingMore = ref(false);
const savedScroll = ref(0);
const PAGE = 50;
let timer: number | null = null;
let lightbox: PhotoSwipeLightbox | null = null;

const supportsShare = canShareFiles();
const inWeChat = isWeChatBrowser();
const inAppWebView = isInAppWebView();
const wechatTipDismissed = ref(false);

// 贡献者
const joinStatus = ref<'none' | 'loading' | 'pending' | 'accepted' | 'rejected'>('none');

const acceptedContributors = computed(() => {
  if (!album.value?.contributors) return [];
  return album.value.contributors.filter((c: ContributorInfo) => c.status === 'accepted');
});

const remaining = computed(() => {
  void tick.value;
  if (!album.value) return '';
  return formatRemaining(album.value.expiresAt - Date.now());
});

const totalBytes = computed(() => {
  if (!album.value) return 0;
  return album.value.photos.reduce((s, p) => s + p.sizeBytes, 0);
});

/** 浏览器外打开的提示文案 */
const externalOpenHint = computed(() => {
  if (inWeChat) return '请点右上角「⋯」选择「在浏览器打开」';
  return '请用系统浏览器（Safari / Chrome）打开本页面再下载';
});

async function load() {
  loading.value = true;
  error.value = null;
  page.value = 1;
  savedScroll.value = Number(sessionStorage.getItem(`scroll_${props.code}`) ?? 0);
  try {
    const data = await shareApi.getByCode(props.code, 1, PAGE);
    album.value = data;
    hasMore.value = (data as any).hasMore ?? false;
    isOwner.value = (data as any).isOwner ?? false;
    saveHistory();
    checkContributor(data);
    // 恢复滚动 + 自动加载到上次位置
    if (savedScroll.value > 0) restoreScrollAndPages(data);
  } catch (err) {
    if (err instanceof ApiException) error.value = err.message;
    else error.value = '加载失败';
  } finally {
    loading.value = false;
  }
}

function saveHistory() {
  const list = JSON.parse(localStorage.getItem('browse_history') || '[]').filter((h: any) => h.code !== props.code);
  list.unshift({ code: props.code, title: album.value?.title || '未命名相册', photoCount: (album.value as any)?.totalPhotos ?? album.value?.photos.length ?? 0, time: Date.now() });
  if (list.length > 20) list.length = 20;
  localStorage.setItem('browse_history', JSON.stringify(list));
}

function checkContributor(data: ViewerAlbum) {
  if (!auth.user || !data.contributors) return;
  const me = data.contributors.find((c: ContributorInfo) => c.userId === auth.user!.id);
  joinStatus.value = me ? (me.status as any) : 'none';
}

async function restoreScrollAndPages(data: ViewerAlbum) {
  const target = savedScroll.value;
  const total = (data as any).totalPhotos ?? data.photos.length;
  const need = Math.ceil(Math.max(target / 200, 1) * 3 / PAGE); // estimate pages needed
  for (let pg = 2; pg <= Math.min(need, Math.ceil(total / PAGE)); pg++) {
    const p = await shareApi.getByCode(props.code, pg, PAGE);
    if (p.photos) {
      album.value = { ...album.value!, photos: [...album.value!.photos, ...p.photos] };
      hasMore.value = (p as any).hasMore ?? false;
      page.value = pg;
    }
  }
  setTimeout(() => window.scrollTo({ top: target, behavior: 'instant' as any }), 200);
}

async function handleLoadMore() {
  if (!album.value || loadMore.value || !hasMore.value) return;
  loadMore.value = true;
  const nextPg = page.value + 1;
  const data = await shareApi.getByCode(props.code, nextPg, PAGE);
  if (data.photos) {
    album.value = { ...album.value, photos: [...album.value.photos, ...data.photos] };
    page.value = nextPg;
    hasMore.value = (data as any).hasMore ?? false;
  }
  loadMore.value = false;
}

async function handleOwnerUpload() {
  if (!isOwner.value || !album.value) return;
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = 'image/*';
  input.onchange = async () => {
    if (!input.files || input.files.length === 0) return;
    uploadingMore.value = true;
    const shareId = (album.value as any).id;
    let done = 0, failed = 0;
    for (const f of Array.from(input.files)) {
      try {
        await photoApi.upload(shareId, f, 'original');
        done++;
      } catch { failed++; }
    }
    uploadingMore.value = false;
    MessagePlugin.success(`完成 ${done}${failed ? `，失败 ${failed}` : ''}`);
    const fresh = await shareApi.getByCode(props.code, 1, PAGE);
    if (fresh) {
      album.value = fresh;
      page.value = 1;
      hasMore.value = (fresh as any).hasMore ?? false;
    }
  };
  input.click();
  // 清理：取消文件选择时移除
  const cleanup = () => { input.remove(); window.removeEventListener('focus', cleanup); };
  window.addEventListener('focus', cleanup);
}

async function handleJoin() {
  if (!auth.user) {
    MessagePlugin.warning('请先登录');
    router.push({ name: 'login', query: { redirect: window.location.pathname } });
    return;
  }
  joinStatus.value = 'loading';
  try {
    const res = await shareApi.requestJoin(props.code);
    joinStatus.value = res.status as any;
    MessagePlugin.success('申请已提交，等待创建者审核');
  } catch (err) {
    joinStatus.value = 'none';
    if (err instanceof ApiException) MessagePlugin.error(err.message);
    else MessagePlugin.error('申请失败');
  }
}

/** PhotoSwipe 大图查看时顶部「保存到相册 / 下载」按钮 */
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
      await saveOne(photo.id, photo.originalName);
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
  sessionStorage.setItem(`scroll_${props.code}`, String(window.scrollY));
});

/** 单张保存（缩略图右下角 + PhotoSwipe 大图按钮共用） */
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

/** 顶栏「下载全部」按钮 */
function onDownloadAllClick() {
  if (!album.value || album.value.photos.length === 0) return;

  // 微信/QQ 等内置浏览器：zip 下载会被劫持成"在浏览器打开"或预览，直接弹引导
  if (inAppWebView) {
    const dlg = DialogPlugin.alert({
      header: `当前在 ${inWeChat ? '微信' : 'App'} 内置浏览器`,
      body: `${externalOpenHint.value}，否则无法下载 zip 文件到手机。`,
      confirmBtn: '复制链接',
      onConfirm: async () => {
        try {
          await copyText(window.location.href);
          MessagePlugin.success('链接已复制，去浏览器粘贴打开');
        } catch {
          MessagePlugin.warning('复制失败，请长按地址栏手动复制');
        }
        dlg.destroy();
      },
    });
    return;
  }

  MessagePlugin.info('开始打包下载（图片较多时可能稍慢）');
  window.location.href = photoApi.zipDownloadUrl(props.code);
}

function gotoHome() {
  router.push({ name: 'home' });
}

async function copyShareLink() {
  try {
    await copyText(window.location.href);
    MessagePlugin.success('链接已复制');
  } catch {
    MessagePlugin.warning('复制失败，请长按选中手动复制');
  }
}
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
            <span>{{ (album as any)?.totalPhotos ?? album.photos.length }} 张</span>
            <span class="dot hide-sm">·</span>
            <span class="hide-sm">{{ formatBytes(totalBytes) }}</span>
            <span class="dot hide-sm">·</span>
            <span class="hide-sm" style="color: var(--text-3); font-size: 11px;">原图已加密传输</span>
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
            @click="onDownloadAllClick"
          >
            <template #icon><span class="i-tdesign:download"></span></template>
            <span class="download-text">下载 zip</span>
          </t-button>
          <t-button
            v-if="isOwner && remaining"
            size="small"
            variant="outline"
            @click="handleOwnerUpload"
            :loading="uploadingMore"
          >
            + 补充
          </t-button>
        </div>
      </div>
    </header>

    <!-- 微信/App 内置浏览器引导横幅 -->
    <div v-if="inAppWebView && !wechatTipDismissed" class="webview-banner">
      <div class="container webview-banner-inner">
        <span class="i-tdesign:browser webview-icon"></span>
        <div class="webview-text">
          <div class="webview-title">想下载图片？</div>
          <div class="webview-desc">{{ externalOpenHint }}，否则系统不允许网页下载到本地或相册。</div>
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

        <div v-else-if="album">
          <!-- 贡献者区域 + 申请按钮 -->
          <div v-if="remaining" class="contrib-section">
            <div v-if="acceptedContributors.length > 0" class="contrib-row">
              <div
                v-for="c in acceptedContributors.slice(0, 8)"
                :key="c.userId"
                class="contrib-avatar"
                :title="c.displayName || c.email"
              >
                {{ (c.displayName || c.email || '?').slice(0, 1).toUpperCase() }}
              </div>
              <span class="contrib-label">
                {{ acceptedContributors.length }} 位贡献者
              </span>
            </div>
            <div class="join-row">
              <button
                v-if="joinStatus === 'accepted'"
                class="join-badge join-badge-accepted"
                disabled
              >
                ✓ 已是贡献者，可上传照片参与分享
              </button>
              <button
                v-else-if="joinStatus === 'pending'"
                class="join-badge join-badge-pending"
                disabled
              >
                ⏳ 申请审核中…
              </button>
              <div v-else-if="joinStatus === 'rejected'" class="join-badge join-badge-rejected">
                <span>申请已被拒绝</span>
                <button class="join-btn-sm" @click="handleJoin">重新申请</button>
              </div>
              <button
                v-else
                class="join-btn"
                :disabled="joinStatus === 'loading'"
                @click="handleJoin"
              >
                {{ joinStatus === 'loading' ? '申请中…' : '📷 申请加入成为贡献者' }}
              </button>
            </div>
          </div>

          <!-- 单张保存的轻提示（移动端展示，避免用户找不到入口） -->
          <div v-if="isMobile && !inAppWebView" class="single-save-tip">
            <span class="i-tdesign:tips text-14px"></span>
            <span>点开任意图片可单张保存到相册，整本下载请用顶部「下载 zip」</span>
          </div>

          <div id="viewer-gallery" class="gallery">
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

          <!-- 加载更多 -->
          <div v-if="hasMore" class="loadmore-row">
            <t-button variant="outline" :loading="loadMore" @click="handleLoadMore">
              {{ loadMore ? '加载中…' : `加载更多 · ${(album as any)?.totalPhotos ? ((album as any).totalPhotos - album.photos.length) : '?'} 张剩余` }}
            </t-button>
          </div>
        </div>
      </t-loading>
    </main>
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

.dot { opacity: 0.4; }

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

/* —— 单张保存提示条 —— */
.single-save-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-3);
  background: var(--surface-soft);
  padding: 8px 12px;
  border-radius: var(--radius-md);
  margin-bottom: 10px;
  line-height: 1.5;
}

/* ─── 贡献者区域 ─── */
.contrib-section {
  margin-bottom: 16px;
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 16px 18px;
  border: 1px solid var(--border-light);
}
.contrib-row {
  display: flex;
  align-items: center;
  margin-bottom: 14px;
}
.contrib-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: -8px;
  border: 2px solid var(--surface);
  flex-shrink: 0;
}
.contrib-label {
  font-size: 13px;
  color: var(--text-3);
  margin-left: 16px;
}
.join-row {
  display: flex;
}
.join-btn {
  flex: 1;
  height: 40px;
  background: var(--success);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.join-btn:hover { filter: brightness(1.1); }
.join-btn:disabled { opacity: 0.7; cursor: default; }
.join-badge {
  flex: 1;
  min-height: 36px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  padding: 6px 16px;
  border: none;
}
.join-badge-accepted { background: rgba(16,185,129,0.08); color: var(--success); }
.join-badge-pending { background: rgba(245,158,11,0.08); color: var(--warning); }
.join-badge-rejected { background: rgba(239,68,68,0.06); color: var(--danger); }
.join-btn-sm {
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-full);
  padding: 4px 16px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.join-btn-sm:hover { filter: brightness(1.1); }

.loadmore-row { text-align: center; padding: 24px 0; }

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
    padding: 12px 8px 80px;
    padding-left: max(8px, var(--safe-left));
    padding-right: max(8px, var(--safe-right));
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
