<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import imageCompression from 'browser-image-compression';
import { shareApi, photoApi } from '@/api/share.api';
import { ApiException } from '@/api/client';
import {
  TTL_PRESETS,
  MAX_FILE_SIZE,
  MAX_PHOTOS_PER_SHARE,
  SUPPORTED_MIME_TYPES,
  UPLOAD_CONCURRENCY,
  formatBytes,
  type UploadedAs,
} from '@photo/shared';

const router = useRouter();

interface UploadItem {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
}

const title = ref('');
const ttlSeconds = ref<number>(TTL_PRESETS[2]!.seconds);
const uploadMode = ref<UploadedAs>('original');
const items = ref<UploadItem[]>([]);
const submitting = ref(false);
const createdShare = ref<{ id: string; code: string } | null>(null);

const ttlOptions = TTL_PRESETS.map((p) => ({ label: p.label, value: p.seconds }));

const stats = computed(() => {
  const total = items.value.length;
  const done = items.value.filter((i) => i.status === 'done').length;
  const error = items.value.filter((i) => i.status === 'error').length;
  const totalBytes = items.value.reduce((s, i) => s + i.file.size, 0);
  return { total, done, error, totalBytes };
});

function fileId() {
  return Math.random().toString(36).slice(2);
}

function onSelectFiles(files: FileList | File[] | null) {
  if (!files) return;
  const list = Array.from(files);
  for (const f of list) {
    if (!SUPPORTED_MIME_TYPES.includes(f.type as (typeof SUPPORTED_MIME_TYPES)[number])) {
      MessagePlugin.warning(`已跳过不支持的文件: ${f.name}`);
      continue;
    }
    if (items.value.length >= MAX_PHOTOS_PER_SHARE) {
      MessagePlugin.warning(`单次最多 ${MAX_PHOTOS_PER_SHARE} 张`);
      break;
    }
    const url = URL.createObjectURL(f);
    items.value.push({
      id: fileId(),
      file: f,
      preview: url,
      status: 'pending',
      progress: 0,
    });
  }
}

function onFileInput(e: Event) {
  const input = e.target as HTMLInputElement;
  onSelectFiles(input.files);
  input.value = '';
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  if (e.dataTransfer?.files) onSelectFiles(e.dataTransfer.files);
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
}

function removeItem(id: string) {
  const idx = items.value.findIndex((i) => i.id === id);
  if (idx >= 0) {
    URL.revokeObjectURL(items.value[idx]!.preview);
    items.value.splice(idx, 1);
  }
}

function clearAll() {
  for (const i of items.value) URL.revokeObjectURL(i.preview);
  items.value = [];
}

async function compressIfNeeded(file: File): Promise<File> {
  if (uploadMode.value !== 'compressed') return file;
  try {
    const out = await imageCompression(file, {
      maxWidthOrHeight: 4000,
      initialQuality: 0.92,
      useWebWorker: true,
      fileType: 'image/jpeg',
    });
    const baseName = file.name.replace(/\.[^.]+$/, '');
    return new File([out], `${baseName}.jpg`, { type: 'image/jpeg' });
  } catch (err) {
    console.warn('压缩失败，回退到原图', err);
    return file;
  }
}

async function uploadOne(item: UploadItem, shareId: string): Promise<void> {
  item.status = 'uploading';
  item.progress = 0;
  try {
    let toUpload = item.file;
    if (toUpload.size > MAX_FILE_SIZE && uploadMode.value !== 'compressed') {
      throw new Error(`文件大小超过 ${formatBytes(MAX_FILE_SIZE)}，建议切换为压缩上传`);
    }
    toUpload = await compressIfNeeded(item.file);
    if (toUpload.size > MAX_FILE_SIZE) {
      throw new Error(`压缩后仍超过 ${formatBytes(MAX_FILE_SIZE)}`);
    }
    await photoApi.upload(shareId, toUpload, uploadMode.value, (p) => {
      item.progress = p;
    });
    item.status = 'done';
    item.progress = 100;
  } catch (err) {
    item.status = 'error';
    item.error = err instanceof ApiException ? err.message : (err as Error).message;
  }
}

async function startUpload() {
  if (items.value.length === 0) {
    MessagePlugin.warning('请先选择图片');
    return;
  }
  submitting.value = true;
  try {
    const share = await shareApi.create({
      ttlSeconds: ttlSeconds.value,
      title: title.value.trim() || undefined,
    });
    createdShare.value = { id: share.id, code: share.code };

    const queue = [...items.value];
    let active = 0;
    let cursor = 0;

    await new Promise<void>((resolve) => {
      const next = () => {
        while (active < UPLOAD_CONCURRENCY && cursor < queue.length) {
          const item = queue[cursor++]!;
          active++;
          uploadOne(item, share.id).finally(() => {
            active--;
            if (cursor >= queue.length && active === 0) resolve();
            else next();
          });
        }
        if (queue.length === 0) resolve();
      };
      next();
    });

    if (stats.value.error === 0) {
      MessagePlugin.success(`全部上传完成，共 ${stats.value.done} 张`);
    } else {
      MessagePlugin.warning(`完成 ${stats.value.done} 张，失败 ${stats.value.error} 张`);
    }
  } catch (err) {
    if (err instanceof ApiException) MessagePlugin.error(err.message);
    else MessagePlugin.error('创建分享失败');
  } finally {
    submitting.value = false;
  }
}

async function copyCode() {
  if (!createdShare.value) return;
  try {
    await navigator.clipboard.writeText(createdShare.value.code);
    MessagePlugin.success('分享码已复制');
  } catch {
    MessagePlugin.warning('复制失败，请手动复制');
  }
}

async function copyLink() {
  if (!createdShare.value) return;
  const url = `${window.location.origin}/v/${createdShare.value.code}`;
  try {
    await navigator.clipboard.writeText(url);
    MessagePlugin.success('链接已复制');
  } catch {
    MessagePlugin.warning('复制失败');
  }
}

function gotoMyShares() {
  router.push({ name: 'my-shares' });
}

function viewAlbum() {
  if (!createdShare.value) return;
  router.push({ name: 'viewer', params: { code: createdShare.value.code } });
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h2>新建分享</h2>
      <p class="page-sub">选择图片和有效期，生成专属分享码</p>
    </div>

    <!-- 创建成功 -->
    <div v-if="createdShare && stats.done === stats.total && stats.error === 0" class="success-card">
      <div class="success-icon">
        <span class="i-tdesign:check text-32px"></span>
      </div>
      <h3>上传完成！</h3>
      <p class="muted">把以下分享码或链接发给朋友</p>

      <div class="result-code-box">
        <div class="result-code">{{ createdShare.code }}</div>
        <div class="result-meta">{{ stats.done }} 张 · {{ formatBytes(stats.totalBytes) }}</div>
      </div>

      <div class="result-actions">
        <t-button theme="primary" size="large" @click="copyCode">
          <template #icon><span class="i-tdesign:copy"></span></template>
          复制分享码
        </t-button>
        <t-button size="large" variant="outline" @click="copyLink">
          <template #icon><span class="i-tdesign:link"></span></template>
          复制链接
        </t-button>
      </div>

      <div class="result-secondary">
        <t-button variant="text" @click="viewAlbum">查看相册</t-button>
        <span class="sep">·</span>
        <t-button variant="text" @click="gotoMyShares">我的分享</t-button>
      </div>
    </div>

    <!-- 上传中或失败 -->
    <template v-else>
      <div class="config-card">
        <div class="form-row">
          <label>相册标题</label>
          <t-input
            v-model="title"
            placeholder="例如：周末聚会（可选）"
            :disabled="submitting"
          />
        </div>
        <div class="form-row">
          <label>有效期</label>
          <div class="ttl-grid">
            <button
              v-for="o in ttlOptions"
              :key="o.value"
              class="ttl-chip"
              :class="{ active: ttlSeconds === o.value }"
              :disabled="submitting"
              @click="ttlSeconds = o.value"
            >
              {{ o.label }}
            </button>
          </div>
        </div>
        <div class="form-row">
          <label>上传模式</label>
          <div class="mode-grid">
            <button
              class="mode-card"
              :class="{ active: uploadMode === 'original' }"
              :disabled="submitting"
              @click="uploadMode = 'original'"
            >
              <div class="mode-icon"><span class="i-tdesign:image-1 text-22px"></span></div>
              <div>
                <div class="mode-title">原图上传</div>
                <div class="mode-desc">保留 100% 画质</div>
              </div>
            </button>
            <button
              class="mode-card"
              :class="{ active: uploadMode === 'compressed' }"
              :disabled="submitting"
              @click="uploadMode = 'compressed'"
            >
              <div class="mode-icon"><span class="i-tdesign:rocket text-22px"></span></div>
              <div>
                <div class="mode-title">压缩上传</div>
                <div class="mode-desc">长边≤4000，速度更快</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div
        class="dropzone"
        :class="{ has: items.length > 0 }"
        @drop="onDrop"
        @dragover="onDragOver"
      >
        <label v-if="items.length === 0" class="dropzone-empty">
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            class="hidden-input"
            @change="onFileInput"
          />
          <div class="dz-icon">
            <span class="i-tdesign:upload text-36px"></span>
          </div>
          <p class="dz-title">点击或拖拽图片到此处</p>
          <p class="dz-hint">JPEG / PNG / WebP / HEIC · 单文件 ≤ {{ formatBytes(MAX_FILE_SIZE) }}</p>
        </label>
        <template v-else>
          <div class="dz-toolbar">
            <span class="dz-count">已选 {{ items.length }} 张 · {{ formatBytes(stats.totalBytes) }}</span>
            <button class="link-btn" @click="clearAll" :disabled="submitting">清空</button>
          </div>
          <div class="grid">
            <div v-for="item in items" :key="item.id" class="thumb">
              <img :src="item.preview" alt="" />
              <div v-if="item.status === 'uploading'" class="overlay">
                <div class="progress-ring">{{ item.progress }}%</div>
              </div>
              <div v-else-if="item.status === 'done'" class="overlay done">
                <span class="i-tdesign:check-circle-filled text-32px"></span>
              </div>
              <div v-else-if="item.status === 'error'" class="overlay error" :title="item.error">
                <span class="i-tdesign:close-circle-filled text-32px"></span>
                <div class="overlay-text">{{ item.error || '失败' }}</div>
              </div>
              <button
                v-if="item.status === 'pending'"
                class="thumb-remove"
                @click="removeItem(item.id)"
                aria-label="移除"
              >
                <span class="i-tdesign:close text-12px"></span>
              </button>
            </div>
            <label v-if="!submitting" class="thumb add">
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                class="hidden-input"
                @change="onFileInput"
              />
              <span class="i-tdesign:add text-32px"></span>
            </label>
          </div>
        </template>
      </div>

      <div class="bottom-bar">
        <div class="bb-info">
          <template v-if="!submitting">
            已选 {{ items.length }}
            <span v-if="items.length > 0">/ {{ MAX_PHOTOS_PER_SHARE }} 张</span>
          </template>
          <template v-else>
            上传中 · 完成 {{ stats.done }} · 失败 {{ stats.error }}
          </template>
        </div>
        <t-button
          theme="primary"
          size="large"
          :loading="submitting"
          :disabled="items.length === 0"
          @click="startUpload"
        >
          {{ submitting ? '上传中…' : '创建并上传' }}
        </t-button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 24px 100px;
  width: 100%;
}

.page-header h2 {
  margin: 0 0 6px;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.page-sub {
  margin: 0 0 24px;
  font-size: 13px;
  color: var(--text-3);
}

/* —— 配置卡片 —— */
.config-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 24px;
  margin-bottom: 16px;
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-row > label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
}

/* TTL chips */
.ttl-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ttl-chip {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  padding: 8px 16px;
  border-radius: var(--radius-full);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: inherit;
}

.ttl-chip:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.ttl-chip.active {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
}

.ttl-chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Mode cards */
.mode-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.mode-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  border: 2px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  text-align: left;
  transition: all var(--transition-fast);
  font-family: inherit;
  color: var(--text-2);
}

.mode-card:hover:not(:disabled) {
  border-color: var(--border-strong);
}

.mode-card.active {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--text-1);
}

.mode-card.active .mode-icon {
  color: var(--primary);
}

.mode-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--surface-hover);
  color: var(--text-2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: color var(--transition-fast);
}

.mode-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 2px;
}

.mode-desc {
  font-size: 12px;
  color: var(--text-3);
}

.mode-card:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* —— Dropzone —— */
.dropzone {
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 2px dashed var(--border-strong);
  padding: 24px;
  transition: border-color var(--transition);
}

.dropzone.has {
  border-style: solid;
  border-color: var(--border-light);
}

.dropzone-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  cursor: pointer;
  min-height: 240px;
  text-align: center;
}

.dz-icon {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, var(--primary-soft), var(--accent-soft));
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dz-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-1);
}

.dz-hint {
  margin: 0;
  font-size: 13px;
  color: var(--text-3);
}

.hidden-input {
  display: none;
}

.dz-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 0 4px;
}

.dz-count {
  font-size: 13px;
  color: var(--text-2);
}

.link-btn {
  border: none;
  background: transparent;
  color: var(--text-3);
  font-size: 13px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
}

.link-btn:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--danger);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
}

.thumb {
  position: relative;
  aspect-ratio: 1 / 1;
  background: var(--surface-hover);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb.add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--border-strong);
  cursor: pointer;
  background: transparent;
  color: var(--text-3);
  transition: all var(--transition-fast);
}

.thumb.add:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-soft);
}

.thumb-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--transition-fast);
  -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
}

.thumb:hover .thumb-remove {
  opacity: 1;
}

.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.86);
}

.progress-ring {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
  background: var(--surface);
  padding: 6px 12px;
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-sm);
}

.overlay.done {
  background: rgba(16, 185, 129, 0.16);
  color: var(--success);
}

.overlay.error {
  background: rgba(239, 68, 68, 0.16);
  color: var(--danger);
  padding: 8px;
  text-align: center;
}

.overlay-text {
  font-size: 11px;
  color: var(--text-2);
  line-height: 1.3;
}

/* —— 底部操作栏 —— */
.bottom-bar {
  position: sticky;
  bottom: 16px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: var(--blur-bg);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-xl);
  padding: 12px 16px 12px 20px;
  margin-top: 16px;
  box-shadow: var(--shadow-lg);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  z-index: 5;
}

.bb-info {
  font-size: 13px;
  color: var(--text-2);
}

/* —— 成功卡片 —— */
.success-card {
  background: var(--surface);
  border-radius: var(--radius-xl);
  padding: 56px 32px 40px;
  text-align: center;
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-md);
  position: relative;
  overflow: hidden;
}

.success-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--primary), var(--accent), var(--success));
}

.success-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--success), #059669);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  box-shadow: 0 8px 24px rgba(16, 185, 129, 0.32);
}

.success-card h3 {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 700;
}

.muted {
  color: var(--text-3);
  font-size: 14px;
  margin: 0;
}

.result-code-box {
  margin: 28px auto;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.06), rgba(139, 92, 246, 0.06));
  border: 1px solid rgba(37, 99, 235, 0.12);
  border-radius: var(--radius-lg);
  padding: 24px 32px;
  display: inline-block;
}

.result-code {
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  font-size: 40px;
  letter-spacing: 10px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 6px;
}

.result-meta {
  font-size: 13px;
  color: var(--text-3);
}

.result-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.result-secondary {
  font-size: 13px;
  color: var(--text-3);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.sep {
  color: var(--border-strong);
}

@media (max-width: 768px) {
  .page {
    padding: 24px 16px 120px;
    padding-left: max(16px, var(--safe-left));
    padding-right: max(16px, var(--safe-right));
  }
  .page-header h2 {
    font-size: 22px;
  }
  .page-sub {
    font-size: 12px;
  }
  .config-card {
    padding: 18px 16px;
    gap: 16px;
    border-radius: var(--radius-lg);
  }
  .form-row > label {
    font-size: 12px;
  }
  .ttl-grid {
    gap: 6px;
  }
  .ttl-chip {
    padding: 7px 14px;
    font-size: 13px;
  }
  .mode-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .mode-card {
    padding: 12px 14px;
  }
  .mode-icon {
    width: 36px;
    height: 36px;
  }
  .mode-title {
    font-size: 13px;
  }
  .mode-desc {
    font-size: 11px;
  }
  .dropzone {
    padding: 14px;
    border-radius: var(--radius-lg);
  }
  .dropzone-empty {
    min-height: 200px;
    gap: 10px;
  }
  .dz-icon {
    width: 56px;
    height: 56px;
  }
  .dz-title {
    font-size: 15px;
  }
  .dz-hint {
    font-size: 12px;
    line-height: 1.5;
    padding: 0 8px;
  }
  .grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .thumb {
    border-radius: var(--radius-sm);
  }
  .thumb-remove {
    opacity: 1;
  }
  .bottom-bar {
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
    padding: 14px 16px;
    margin-bottom: max(0px, var(--safe-bottom));
    border-radius: var(--radius-lg);
  }
  .bb-info {
    text-align: center;
    font-size: 13px;
  }
  .bottom-bar .t-button {
    width: 100%;
  }
  .success-card {
    padding: 40px 20px 28px;
    border-radius: var(--radius-xl);
  }
  .success-icon {
    width: 64px;
    height: 64px;
  }
  .success-card h3 {
    font-size: 20px;
  }
  .result-code-box {
    padding: 18px 20px;
    margin: 24px 0;
    width: 100%;
    box-sizing: border-box;
  }
  .result-code {
    font-size: 30px;
    letter-spacing: 7px;
  }
  .result-actions {
    flex-direction: column;
    gap: 10px;
  }
  .result-actions .t-button {
    width: 100%;
  }
}

@media (max-width: 380px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .ttl-chip {
    flex: 1 0 calc(33.33% - 4px);
    text-align: center;
  }
  .result-code {
    font-size: 26px;
    letter-spacing: 5px;
  }
}
</style>
