<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { DialogPlugin, MessagePlugin } from 'tdesign-vue-next';
import { shareApi } from '@/api/share.api';
import { ApiException } from '@/api/client';
import { formatRemaining, formatBytes, formatDateTime, TTL_PRESETS } from '@photo/shared';
import type { ShareSummary } from '@photo/shared';
import { copyText } from '@/utils/clipboard';

const router = useRouter();
const items = ref<ShareSummary[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = 20;

const tick = ref(0);
let timer: number | null = null;

async function load() {
  loading.value = true;
  try {
    const res = await shareApi.list({ page: page.value, pageSize });
    items.value = res.items;
    total.value = res.total;
  } catch (err) {
    if (err instanceof ApiException) MessagePlugin.error(err.message);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  load();
  timer = window.setInterval(() => {
    tick.value++;
  }, 1000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

function statusInfo(s: ShareSummary): { text: string; cls: string } {
  if (s.status === 'cleaned') return { text: '已清理', cls: 'st-cleaned' };
  if (s.status === 'ended') return { text: '已结束', cls: 'st-ended' };
  if (s.expiresAt <= Date.now()) return { text: '已过期', cls: 'st-expired' };
  return { text: '生效中', cls: 'st-active' };
}

function remaining(s: ShareSummary): string {
  void tick.value;
  if (s.status !== 'active') return '—';
  return formatRemaining(s.expiresAt - Date.now());
}

async function copyCode(code: string) {
  try {
    await copyText(code);
    MessagePlugin.success(`分享码 ${code} 已复制`);
  } catch {
    MessagePlugin.warning('复制失败，请长按选中手动复制');
  }
}

async function copyLink(code: string) {
  const url = `${window.location.origin}/v/${code}`;
  try {
    await copyText(url);
    MessagePlugin.success('链接已复制');
  } catch {
    MessagePlugin.warning('复制失败，请长按选中手动复制');
  }
}

async function extend(s: ShareSummary, seconds: number) {
  try {
    const r = await shareApi.extend(s.id, seconds);
    s.expiresAt = r.expiresAt;
    MessagePlugin.success('已续期');
  } catch (err) {
    if (err instanceof ApiException) MessagePlugin.error(err.message);
  }
}

function onDropdownClick(s: ShareSummary, payload: unknown) {
  const value = (payload as { value?: number }).value;
  if (typeof value === 'number') {
    void extend(s, value);
  }
}

function ttlOptions() {
  return TTL_PRESETS.map((p) => ({ content: '续 ' + p.label, value: p.seconds }));
}

function endShare(s: ShareSummary) {
  const dialog = DialogPlugin.confirm({
    header: '结束分享',
    body: `确认提前结束分享「${s.title || s.code}」？该操作不可恢复，所有图片将被清理。`,
    confirmBtn: { content: '确认结束', theme: 'danger' },
    onConfirm: async () => {
      try {
        await shareApi.end(s.id);
        MessagePlugin.success('已结束分享');
        await load();
      } catch (err) {
        if (err instanceof ApiException) MessagePlugin.error(err.message);
      } finally {
        dialog.destroy();
      }
    },
    onClose: () => dialog.destroy(),
  });
}

function viewAlbum(code: string) {
  const url = router.resolve({ name: 'viewer', params: { code } }).href;
  window.open(url, '_blank');
}

function gotoNew() {
  router.push({ name: 'new-share' });
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2>我的分享</h2>
        <p class="page-sub">{{ total }} 个分享 · 管理你创建的所有相册</p>
      </div>
      <t-button theme="primary" @click="gotoNew">
        <template #icon><span class="i-tdesign:add"></span></template>
        新建分享
      </t-button>
    </div>

    <t-loading :loading="loading">
      <div v-if="items.length === 0 && !loading" class="empty">
        <div class="empty-icon">
          <span class="i-tdesign:image-1 text-48px"></span>
        </div>
        <h3>还没有分享</h3>
        <p>创建你的第一个分享相册，把美好瞬间分享给朋友</p>
        <t-button theme="primary" size="large" @click="gotoNew">
          <template #icon><span class="i-tdesign:add"></span></template>
          创建分享
        </t-button>
      </div>

      <div v-else class="grid">
        <div v-for="s in items" :key="s.id" class="card" :class="statusInfo(s).cls">
          <div class="card-head">
            <div class="title-line">
              <h3 class="title">{{ s.title || '未命名相册' }}</h3>
              <span class="status-pill">
                <span class="status-dot"></span>
                {{ statusInfo(s).text }}
              </span>
            </div>
          </div>

          <div class="code-box">
            <div class="code-label">分享码</div>
            <div class="code-row">
              <code class="code">{{ s.code }}</code>
              <div class="code-actions">
                <button class="icon-btn" @click="copyCode(s.code)" title="复制分享码">
                  <span class="i-tdesign:copy text-16px"></span>
                </button>
                <button class="icon-btn" @click="copyLink(s.code)" title="复制链接">
                  <span class="i-tdesign:link text-16px"></span>
                </button>
              </div>
            </div>
          </div>

          <div class="meta">
            <div class="meta-row">
              <span class="meta-label">
                <span class="i-tdesign:image-1 text-14px"></span>
                {{ s.photoCount }} 张
              </span>
              <span class="meta-label">{{ formatBytes(s.totalBytes) }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">
                <span class="i-tdesign:calendar-1 text-14px"></span>
                {{ formatDateTime(s.createdAt) }}
              </span>
            </div>
            <div class="meta-row remaining" :class="{ urgent: s.status === 'active' && s.expiresAt - Date.now() < 3600_000 }">
              <span class="i-tdesign:time text-14px"></span>
              <template v-if="s.status === 'active'">剩余 {{ remaining(s) }}</template>
              <template v-else-if="s.status === 'ended'">已于 {{ s.endedAt ? formatDateTime(s.endedAt) : '—' }} 结束</template>
              <template v-else>已清理</template>
            </div>
          </div>

          <div class="actions">
            <t-button size="medium" variant="outline" @click="viewAlbum(s.code)">
              <template #icon><span class="i-tdesign:browse"></span></template>
              预览
            </t-button>
            <t-dropdown
              v-if="s.status === 'active'"
              :options="ttlOptions()"
              @click="(d: unknown) => onDropdownClick(s, d)"
            >
              <t-button size="medium" theme="primary" variant="outline">
                续期
                <template #suffix><span class="i-tdesign:chevron-down text-12px"></span></template>
              </t-button>
            </t-dropdown>
            <t-button
              v-if="s.status === 'active'"
              size="medium"
              theme="danger"
              variant="text"
              @click="endShare(s)"
            >
              结束
            </t-button>
          </div>
        </div>
      </div>

      <div v-if="total > pageSize" class="pagination">
        <t-pagination
          v-model="page"
          :total="total"
          :page-size="pageSize"
          :page-size-options="[]"
          @current-change="load"
        />
      </div>
    </t-loading>
  </div>
</template>

<style scoped>
.page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px 64px;
  width: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 28px;
  gap: 16px;
}

.page-header h2 {
  margin: 0 0 6px;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.page-sub {
  margin: 0;
  font-size: 13px;
  color: var(--text-3);
}

/* —— 空状态 —— */
.empty {
  text-align: center;
  padding: 80px 16px;
}

.empty-icon {
  width: 80px;
  height: 80px;
  border-radius: 24px;
  background: linear-gradient(135deg, var(--primary-soft), var(--accent-soft));
  color: var(--primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.empty h3 {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
}

.empty p {
  margin: 0 0 24px;
  font-size: 14px;
  color: var(--text-3);
}

/* —— 卡片网格 —— */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}

.card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 20px;
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition), transform var(--transition);
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: relative;
  overflow: hidden;
}

.card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--primary);
}

.card.st-active::before {
  background: linear-gradient(90deg, var(--primary), var(--accent));
}
.card.st-ended::before { background: var(--warning); }
.card.st-expired::before { background: var(--danger); }
.card.st-cleaned::before { background: var(--text-3); }

.card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.card.st-cleaned {
  opacity: 0.7;
}

.card-head {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.title-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 500;
  flex-shrink: 0;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.st-active .status-pill {
  background: rgba(16, 185, 129, 0.1);
  color: var(--success);
}
.st-active .status-dot {
  background: var(--success);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.18);
  animation: pulse 2s infinite;
}
.st-ended .status-pill {
  background: rgba(245, 158, 11, 0.12);
  color: var(--warning);
}
.st-ended .status-dot { background: var(--warning); }
.st-expired .status-pill {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
}
.st-expired .status-dot { background: var(--danger); }
.st-cleaned .status-pill {
  background: var(--surface-hover);
  color: var(--text-3);
}
.st-cleaned .status-dot { background: var(--text-3); }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* —— 分享码 —— */
.code-box {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.04), rgba(139, 92, 246, 0.04));
  border: 1px solid rgba(37, 99, 235, 0.1);
  border-radius: var(--radius-md);
  padding: 12px 14px;
}

.code-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-3);
  font-weight: 500;
  margin-bottom: 4px;
}

.code-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.code {
  font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace;
  font-size: 22px;
  letter-spacing: 5px;
  font-weight: 700;
  color: var(--primary);
  background: linear-gradient(135deg, var(--primary), var(--accent));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.code-actions {
  display: flex;
  gap: 4px;
}

.icon-btn {
  border: none;
  background: transparent;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-2);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.icon-btn:hover {
  background: var(--surface-hover);
  color: var(--primary);
}

/* —— Meta —— */
.meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--text-2);
}

.meta-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.meta-row.remaining {
  font-weight: 500;
}

.meta-row.remaining.urgent {
  color: var(--warning);
}

/* —— 操作 —— */
.actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  padding-top: 14px;
  border-top: 1px dashed var(--border-light);
}

.actions .t-button {
  flex: 1;
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 32px;
}

@media (max-width: 768px) {
  .page {
    padding: 24px 16px 64px;
    padding-left: max(16px, var(--safe-left));
    padding-right: max(16px, var(--safe-right));
  }
  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    margin-bottom: 20px;
  }
  .page-header h2 {
    font-size: 22px;
  }
  .page-sub {
    font-size: 12px;
  }
  .grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .card {
    padding: 18px 16px;
    border-radius: var(--radius-lg);
    gap: 12px;
  }
  .title {
    font-size: 16px;
  }
  .code-box {
    padding: 14px 16px;
  }
  .code-label {
    font-size: 10px;
    margin-bottom: 6px;
  }
  .code {
    font-size: 22px;
    letter-spacing: 5px;
  }
  .meta-row {
    font-size: 12px;
    gap: 10px;
  }
  .actions {
    flex-wrap: wrap;
    gap: 6px;
    padding-top: 12px;
  }
  .actions .t-button {
    flex: 1 0 calc(50% - 3px);
    min-width: 0;
  }
  .empty {
    padding: 60px 16px;
  }
  .empty-icon {
    width: 64px;
    height: 64px;
    border-radius: 18px;
  }
  .empty h3 {
    font-size: 17px;
  }
  .empty p {
    font-size: 13px;
    line-height: 1.55;
    padding: 0 8px;
  }
}
</style>
