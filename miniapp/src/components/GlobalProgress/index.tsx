import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import Taro from '@tarojs/taro';
import { View, Text, Image } from '@tarojs/components';
import { useTaskStore, type UploadTask, type DownloadTask } from '@/stores/task.store';
import { taskManager } from '@/stores/task.manager';
import { iconPause, iconUpload, iconDownload, iconXMark, iconChevronDown } from '@/assets/icons';
import './index.scss';

/* ────────────────── 持久化 ────────────────── */

const STORAGE_KEY = 'gp_pos_v1';

interface Position {
  y: number;
  ballX?: number;
  collapsed: boolean;
}

function loadPos(): Position | null {
  try { const raw = Taro.getStorageSync(STORAGE_KEY); if (raw) return JSON.parse(raw) as Position; } catch { /* */ }
  return null;
}
function savePos(p: Position) {
  try { Taro.setStorageSync(STORAGE_KEY, JSON.stringify(p)); } catch { /* */ }
}

/* ────────────────── 常量 ────────────────── */

const { windowHeight: _wh, windowWidth: _ww } = (() => {
  try { const s = Taro.getSystemInfoSync(); return { windowHeight: s.windowHeight, windowWidth: s.windowWidth }; }
  catch { return { windowHeight: 667, windowWidth: 375 }; }
})();
const WIN_H = _wh;
const WIN_W = _ww;
const BALL_HITAREA = 64;
const EXPANDED_DEFAULT_H = 120;
const SAFE_TOP = 80;
const SAFE_BOTTOM = 12;
const MARGIN = 16;
const TAP_THRESHOLD = 8;

function clamp(v: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(v, min), max);
}

/* ────────────────── 任务订阅 ────────────────── */

type ActiveUpload = UploadTask & { kind: 'upload' };
type ActiveDownload = DownloadTask & { kind: 'download' };
type ActiveTask = ActiveUpload | ActiveDownload;

function useActiveTasks(): ActiveTask[] {
  const uploads = useTaskStore(useShallow((s) => s.uploads));
  const downloads = useTaskStore(useShallow((s) => s.downloads));
  const tasks: ActiveTask[] = [];
  for (const id of Object.keys(uploads)) {
    const t = uploads[id];
    if (t && t.status !== 'cancelled') tasks.push({ ...t, kind: 'upload' });
  }
  for (const id of Object.keys(downloads)) {
    const t = downloads[id];
    if (t && t.status !== 'cancelled') tasks.push({ ...t, kind: 'download' });
  }
  return tasks;
}

/** 锁定/恢复页面滚动（基础库 ≥2.22.0） */
function lockPageScroll(lock: boolean) {
  try {
    Taro.setPageStyle({ style: { overflow: lock ? 'hidden' : 'visible' } });
  } catch { /* 低版本降级 */ }
}

/* ────────────────── 主体 ────────────────── */

export default function GlobalProgress() {
  const tasks = useActiveTasks();
  const init = useRef(loadPos()).current;

  const [collapsed, setCollapsed] = useState<boolean>(init?.collapsed ?? false);
  const [y, setY] = useState<number>(init?.y != null ? init.y : Math.max(SAFE_TOP, WIN_H - 240));
  const [ballX, setBallX] = useState<number>(init?.ballX != null ? init.ballX : WIN_W - BALL_HITAREA - MARGIN);

  const yRef = useRef(y); yRef.current = y;
  const ballXRef = useRef(ballX); ballXRef.current = ballX;

  useEffect(() => {
    const h = collapsed ? BALL_HITAREA : EXPANDED_DEFAULT_H;
    setY((prev) => clamp(prev, SAFE_TOP, WIN_H - h - SAFE_BOTTOM));
    savePos({ y: yRef.current, ballX: ballXRef.current, collapsed });
  }, [collapsed]);

  /* ─── 拖动 ─── */

  const dragRef = useRef({ startX: 0, startY: 0, originX: 0, originY: 0, moved: false, active: false });

  const onTouchStart = (e: any) => {
    const t = e.touches?.[0];
    if (!t) return;
    dragRef.current.startX = t.pageX ?? t.clientX ?? 0;
    dragRef.current.startY = t.pageY ?? t.clientY ?? 0;
    dragRef.current.originX = ballXRef.current;
    dragRef.current.originY = yRef.current;
    dragRef.current.moved = false;
    dragRef.current.active = true;
    lockPageScroll(true);
  };

  const onTouchMove = (e: any) => {
    if (!dragRef.current.active) return;
    const t = e.touches?.[0];
    if (!t) return;
    const dx = (t.pageX ?? t.clientX ?? 0) - dragRef.current.startX;
    const dy = (t.pageY ?? t.clientY ?? 0) - dragRef.current.startY;
    if (Math.abs(dx) + Math.abs(dy) < TAP_THRESHOLD) return;
    dragRef.current.moved = true;
    const h = collapsed ? BALL_HITAREA : EXPANDED_DEFAULT_H;
    setY(clamp(dragRef.current.originY + dy, SAFE_TOP, WIN_H - h - SAFE_BOTTOM));
    if (collapsed) setBallX(clamp(dragRef.current.originX + dx, MARGIN, WIN_W - BALL_HITAREA - MARGIN));
  };

  const onTouchEnd = () => {
    if (dragRef.current.active && dragRef.current.moved) {
      savePos({ y: yRef.current, ballX: ballXRef.current, collapsed });
    }
    dragRef.current.active = false;
    lockPageScroll(false);
  };

  if (tasks.length === 0) return null;

  const pages = Taro.getCurrentPages();

  /* ─── 折叠态：小球 ─── */

  if (collapsed) {
    const active = tasks.find((t) => t.status === 'uploading' || t.status === 'downloading');
    const head = active ?? tasks[0]!;
    const isUp = head.kind === 'upload';
    const totalCount = tasks.length;

    return (
      <View className="gp-portal gp-portal-ball" style={{ top: `${y}px`, left: `${ballX}px` }}>
        <View
          className="gp-ball-hitarea" catchMove
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          onClick={() => { if (!dragRef.current.moved) setCollapsed(false); }}
        >
          <View className={`gp-ball ${head.status === 'paused' ? 'gp-ball-paused' : ''}`}>
            <Image src={isUp ? iconUpload('#ffffff') : iconDownload('#ffffff')} className="gp-ball-icon" />
            {totalCount > 1 && (
              <View className="gp-ball-badge"><Text className="gp-ball-badge-text">{totalCount}</Text></View>
            )}
          </View>
        </View>
      </View>
    );
  }

  /* ─── 展开态：大卡片 ─── */

  return (
    <View className="gp-portal gp-portal-card" style={{ top: `${y}px` }}>
      <View className="gp-card">
        <View
          className="gp-handle" catchMove
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        >
          <View className="gp-handle-bar" />
        </View>
        <View
          className="gp-collapse-btn" hoverClass="gp-collapse-btn-hover" hoverStayTime={120}
          onClick={() => setCollapsed(true)}
        >
          <Image src={iconChevronDown('#94a3b8')} className="gp-collapse-icon" />
        </View>
        {tasks.map((t) => {
          const isUpload = t.kind === 'upload';
          const isActive = t.status === 'uploading' || t.status === 'downloading';
          const isPaused = t.status === 'paused';
          const pct = t.total > 0 ? Math.round((t.done / t.total) * 100) : 0;
          const id = isUpload ? t.shareId : t.shareCode;
          const title = isUpload ? taskManager.getUploadCtx(t.shareId)?.meta.title : '';

          return (
            <View
              key={id} className="gp-row"
              onClick={() => {
                const cur = pages[pages.length - 1];
                if (isUpload) {
                  if (cur?.route === 'pages/me/new/index') return;
                  Taro.navigateTo({ url: `/pages/me/new/index?restoreShareId=${t.shareId}` });
                } else {
                  if (cur?.route === 'pages/viewer/detail/index' && (cur?.options as any)?.code === t.shareCode) return;
                  Taro.navigateTo({ url: `/pages/viewer/detail/index?code=${t.shareCode}` });
                }
              }}
            >
              <View className="gp-row-left">
                <Text className="gp-row-label">
                  {isUpload ? '↑' : '↓'} {isUpload ? `上传 ${t.done}/${t.total}` : `保存 ${t.done}/${t.total}`}
                  {title ? ` · ${title}` : ''}
                  {isPaused ? ' 已暂停' : ''}
                  {t.failed > 0 ? ` (失败${t.failed})` : ''}
                </Text>
                {(isActive || isPaused) && (
                  <View className="gp-row-track">
                    <View className="gp-row-fill" style={{ width: `${pct}%`, background: isPaused ? '#94a3b8' : undefined }} />
                  </View>
                )}
              </View>
              <View className="gp-row-actions">
                {isActive && (
                  <View className="gp-row-btn" hoverClass="gp-row-btn-hover" hoverStayTime={120} catchMove
                    onClick={(e: any) => { e.stopPropagation(); isUpload ? taskManager.pauseUpload(t.shareId) : taskManager.pauseDownload(t.shareCode); }}>
                    <Image src={iconPause('#475569')} className="gp-row-btn-icon" />
                  </View>
                )}
                {isPaused && (
                  <View className="gp-row-btn" hoverClass="gp-row-btn-hover" hoverStayTime={120} catchMove
                    onClick={(e: any) => { e.stopPropagation(); isUpload ? taskManager.resumeUpload(t.shareId) : taskManager.resumeDownload(t.shareCode); }}>
                    <Image src={isUpload ? iconUpload('#3b82f6') : iconDownload('#3b82f6')} className="gp-row-btn-icon" />
                  </View>
                )}
                <View className="gp-row-btn" hoverClass="gp-row-btn-hover" hoverStayTime={120} catchMove
                  onClick={(e: any) => { e.stopPropagation(); isUpload ? taskManager.cancelUpload(t.shareId) : taskManager.cancelDownload(t.shareCode); }}>
                  <Image src={iconXMark('#94a3b8')} className="gp-row-btn-icon" />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
