import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import Taro from '@tarojs/taro';
import { View, Text, Image } from '@tarojs/components';
import { useTaskStore, type UploadTask, type DownloadTask } from '@/stores/task.store';
import { taskManager } from '@/stores/task.manager';
import {
  iconPause,
  iconUpload,
  iconDownload,
  iconXMark,
  iconChevronDown,
} from '@/assets/icons';
import './index.scss';

/* ────────────────── 持久化位置 ────────────────── */

const STORAGE_KEY = 'gp_pos_v1';

interface Position {
  y: number;
  /** 悬浮球的 left 位置（卡片忽略此字段） */
  ballX?: number;
  collapsed: boolean;
}

function loadPos(): Position | null {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Position;
  } catch { /* ignore */ }
  return null;
}

function savePos(p: Position) {
  try { Taro.setStorageSync(STORAGE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

const { windowHeight: _wh, windowWidth: _ww } = (() => {
  try { const s = Taro.getSystemInfoSync(); return { windowHeight: s.windowHeight, windowWidth: s.windowWidth }; }
  catch { return { windowHeight: 667, windowWidth: 375 }; }
})();
const WIN_H = _wh;
const WIN_W = _ww;

/* ────────────────── 主体 ────────────────── */

const COLLAPSED_SIZE = 56;
const BALL_VISUAL = 48;   // 小球视觉尺寸 px（≈96rpx）
const BALL_HITAREA = 64;   // 小球触摸热区 px（≈128rpx），比视觉大确保 catchMove 可靠
const EXPANDED_DEFAULT_H = 120;
const SAFE_TOP = 80;
const SAFE_BOTTOM = 12;
const MARGIN = 16;          // 小球距屏幕边缘最小距离
const TAP_THRESHOLD = 8;

type ActiveUpload = UploadTask & { kind: 'upload' };
type ActiveDownload = DownloadTask & { kind: 'download' };
type ActiveTask = ActiveUpload | ActiveDownload;

/** 仅订阅 store 标量；title 在渲染阶段从 manager 现取，不混进 selector。 */
function useActiveTasks(): ActiveTask[] {
  const uploadIds = useTaskStore(useShallow((s) => Object.keys(s.uploads)));
  const downloadIds = useTaskStore(useShallow((s) => Object.keys(s.downloads)));
  const uploads = useTaskStore((s) => s.uploads);
  const downloads = useTaskStore((s) => s.downloads);

  const tasks: ActiveTask[] = [];
  for (const id of uploadIds) {
    const t = uploads[id];
    if (t && t.status !== 'cancelled') tasks.push({ ...t, kind: 'upload' });
  }
  for (const id of downloadIds) {
    const t = downloads[id];
    if (t && t.status !== 'cancelled') tasks.push({ ...t, kind: 'download' });
  }
  return tasks;
}

function clamp(v: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(v, min), max);
}

export default function GlobalProgress() {
  const tasks = useActiveTasks();

  const init = useRef(loadPos()).current;

  const [collapsed, setCollapsed] = useState<boolean>(init?.collapsed ?? false);
  const [y, setY] = useState<number>(
    init?.y != null ? init.y : Math.max(SAFE_TOP, WIN_H - 240),
  );
  /** 悬浮球水平位置（卡片忽略） */
  const [ballX, setBallX] = useState<number>(
    init?.ballX != null ? init.ballX : WIN_W - BALL_HITAREA - MARGIN,
  );
  /** 拖拽中标记：用于挂全屏遮罩阻断页面内置滚动 */
  const [dragging, setDragging] = useState(false);

  const yRef = useRef(y); yRef.current = y;
  const ballXRef = useRef(ballX); ballXRef.current = ballX;

  /** 折叠态切换时调整 y 不超出底部 */
  useEffect(() => {
    const h = collapsed ? BALL_HITAREA : EXPANDED_DEFAULT_H;
    setY((prev) => clamp(prev, SAFE_TOP, WIN_H - h - SAFE_BOTTOM));
    savePos({ y: yRef.current, ballX: ballXRef.current, collapsed });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [collapsed]);

  /* ─── 拖动 ─── */

  const dragRef = useRef({
    startX: 0, startY: 0,
    originX: 0, originY: 0,
    moved: false, dragging: false,
  });

  const onTouchStart = (e: any) => {
    const t = e.touches?.[0];
    if (!t) return;
    dragRef.current.startX = t.pageX ?? t.clientX ?? 0;
    dragRef.current.startY = t.pageY ?? t.clientY ?? 0;
    dragRef.current.originX = ballXRef.current;
    dragRef.current.originY = yRef.current;
    dragRef.current.moved = false;
    dragRef.current.dragging = true;
  };

  const onTouchMove = (e: any) => {
    if (!dragRef.current.dragging) return;
    const t = e.touches?.[0];
    if (!t) return;
    const curX = t.pageX ?? t.clientX ?? 0;
    const curY = t.pageY ?? t.clientY ?? 0;
    const dx = curX - dragRef.current.startX;
    const dy = curY - dragRef.current.startY;
    if (Math.abs(dx) + Math.abs(dy) < TAP_THRESHOLD) return;
    dragRef.current.moved = true;
    setDragging(true); // 挂全屏遮罩阻断页面内置滚动

    const h = collapsed ? BALL_HITAREA : EXPANDED_DEFAULT_H;
    setY(clamp(dragRef.current.originY + dy, SAFE_TOP, WIN_H - h - SAFE_BOTTOM));
    // 悬浮球还支持横向拖动
    if (collapsed) {
      setBallX(clamp(dragRef.current.originX + dx, MARGIN, WIN_W - BALL_HITAREA - MARGIN));
    }
  };

  const onTouchEnd = () => {
    if (dragRef.current.dragging && dragRef.current.moved) {
      savePos({ y: yRef.current, ballX: ballXRef.current, collapsed });
    }
    dragRef.current.dragging = false;
    setDragging(false);
  };

  if (tasks.length === 0) return null;

  /* 拖拽全屏遮罩：始终渲染，用 hidden 切显隐，避免 mount/unmount 开销 */
  const dragOverlay = (
    <View
      hidden={!dragging}
      catchMove
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 998 }}
    />
  );

  /* ────────────────── 折叠态：悬浮小球 ────────────────── */

  if (collapsed) {
    const active = tasks.find((t) => t.status === 'uploading' || t.status === 'downloading');
    const head = active ?? tasks[0]!;
    const isUp = head.kind === 'upload';
    const totalCount = tasks.length;

    return (
      <>
        {dragOverlay}
        <View
          className="gp-portal gp-portal-ball"
          style={{ top: `${y}px`, left: `${ballX}px` }}
        >
          <View
            className="gp-ball-hitarea"
            catchMove
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onClick={() => {
              if (dragRef.current.moved) return;
              setCollapsed(false);
            }}
          >
            <View className={`gp-ball ${head.status === 'paused' ? 'gp-ball-paused' : ''}`}>
              <Image
                src={isUp ? iconUpload('#ffffff') : iconDownload('#ffffff')}
                className="gp-ball-icon"
              />
              {totalCount > 1 && (
                <View className="gp-ball-badge">
                  <Text className="gp-ball-badge-text">{totalCount}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </>
    );
  }

  /* ────────────────── 展开大卡片 ────────────────── */

  const pages = Taro.getCurrentPages();

  return (
    <>
      {dragOverlay}
      <View
        className="gp-portal gp-portal-card"
        style={{ top: `${y}px` }}
      >
      <View className="gp-card">
        {/* 抓手栏：仅这个区域响应拖动；折叠按钮独立 */}
        <View
          className="gp-handle"
          catchMove
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <View className="gp-handle-bar" />
        </View>
        <View
          className="gp-collapse-btn"
          hoverClass="gp-collapse-btn-hover"
          hoverStayTime={120}
          onClick={() => setCollapsed(true)}
        >
          <Image src={iconChevronDown('#94a3b8')} className="gp-collapse-icon" />
        </View>

        {tasks.map((t) => {
          const isUpload = t.kind === 'upload';
          const isActive = t.status === 'uploading' || t.status === 'downloading';
          const isPaused = t.status === 'paused';
          const total = t.total;
          const pct = total > 0 ? Math.round((t.done / total) * 100) : 0;
          const id = isUpload ? t.shareId : t.shareCode;
          const title = isUpload ? taskManager.getUploadCtx(t.shareId)?.meta.title : '';

          const onRowClick = () => {
            const current = pages[pages.length - 1];
            if (isUpload) {
              if (current?.route === 'pages/me/new/index') return;
              Taro.navigateTo({ url: `/pages/me/new/index?restoreShareId=${t.shareId}` });
            } else {
              if (
                current?.route === 'pages/viewer/detail/index' &&
                (current?.options as any)?.code === t.shareCode
              ) return;
              Taro.navigateTo({ url: `/pages/viewer/detail/index?code=${t.shareCode}` });
            }
          };

          return (
            <View key={id} className="gp-row" onClick={onRowClick}>
              <View className="gp-row-left">
                <Text className="gp-row-label">
                  {isUpload ? '↑' : '↓'}{' '}
                  {isUpload ? `上传 ${t.done}/${total}` : `保存 ${t.done}/${total}`}
                  {title ? ` · ${title}` : ''}
                  {isPaused ? ' 已暂停' : ''}
                  {t.failed > 0 ? ` (失败${t.failed})` : ''}
                </Text>
                {(isActive || isPaused) && (
                  <View className="gp-row-track">
                    <View
                      className="gp-row-fill"
                      style={{ width: `${pct}%`, background: isPaused ? '#94a3b8' : undefined }}
                    />
                  </View>
                )}
              </View>
              <View className="gp-row-actions">
                {isActive && (
                  <View
                    className="gp-row-btn"
                    hoverClass="gp-row-btn-hover"
                    hoverStayTime={120}
                    catchMove
                    onClick={(e: any) => {
                      e.stopPropagation();
                      if (isUpload) taskManager.pauseUpload(t.shareId);
                      else taskManager.pauseDownload(t.shareCode);
                    }}
                  >
                    <Image src={iconPause('#475569')} className="gp-row-btn-icon" />
                  </View>
                )}
                {isPaused && (
                  <View
                    className="gp-row-btn"
                    hoverClass="gp-row-btn-hover"
                    hoverStayTime={120}
                    catchMove
                    onClick={(e: any) => {
                      e.stopPropagation();
                      if (isUpload) taskManager.resumeUpload(t.shareId);
                      else taskManager.resumeDownload(t.shareCode);
                    }}
                  >
                    <Image
                      src={isUpload ? iconUpload('#3b82f6') : iconDownload('#3b82f6')}
                      className="gp-row-btn-icon"
                    />
                  </View>
                )}
                <View
                  className="gp-row-btn"
                  hoverClass="gp-row-btn-hover"
                  hoverStayTime={120}
                  catchMove
                  onClick={(e: any) => {
                    e.stopPropagation();
                    if (isUpload) taskManager.cancelUpload(t.shareId);
                    else taskManager.cancelDownload(t.shareCode);
                  }}
                >
                  <Image src={iconXMark('#94a3b8')} className="gp-row-btn-icon" />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  </>
);
}
