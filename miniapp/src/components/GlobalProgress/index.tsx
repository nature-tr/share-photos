import { useEffect, useMemo, useRef, useState } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Image } from '@tarojs/components';
import { useTaskStore } from '@/stores/task.store';
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
  /** 距离屏幕顶部的 px */
  y: number;
  /** 是否折叠为悬浮球 */
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

/* ────────────────── 屏幕尺寸（同步） ────────────────── */

function getWindowHeight(): number {
  try {
    const sys = Taro.getSystemInfoSync();
    return sys.windowHeight;
  } catch {
    return 667;
  }
}

/* ────────────────── 主体 ────────────────── */

const COLLAPSED_SIZE = 56;     // 悬浮球尺寸 px
const SAFE_TOP = 80;           // 不要遮挡顶部导航
const SAFE_BOTTOM = 12;        // 与屏幕底部最小间距
const TAP_THRESHOLD = 6;       // 拖动 vs 点击的阈值（px）

export default function GlobalProgress() {
  const allUploads = useTaskStore((s) => s.uploads);
  const allDownloads = useTaskStore((s) => s.downloads);

  /* 任务列表（去掉 cancelled） */
  const tasks = useMemo(() => {
    return [
      ...Object.values(allUploads).map((t) => ({ ...t, kind: 'upload' as const })),
      ...Object.values(allDownloads).map((t) => ({ ...t, kind: 'download' as const })),
    ].filter((t) => t.status !== 'cancelled');
  }, [allUploads, allDownloads]);

  const winH = useRef(getWindowHeight()).current;

  /* 初始位置：底部偏上 */
  const init = loadPos();
  const [collapsed, setCollapsed] = useState<boolean>(init?.collapsed ?? false);
  /** 元素 top 在屏幕中的位置（px） */
  const [y, setY] = useState<number>(() => {
    if (init?.y != null) return init.y;
    return Math.max(SAFE_TOP, winH - 240);
  });

  /* 元素自身高度（dynamic）：用于限制拖动边界 */
  const [elH, setElH] = useState<number>(collapsed ? COLLAPSED_SIZE : 120);

  /* 折叠态切换时调整 y 不超出底部 */
  useEffect(() => {
    const h = collapsed ? COLLAPSED_SIZE : Math.max(elH, 80);
    setY((prev) => clamp(prev, SAFE_TOP, winH - h - SAFE_BOTTOM));
  }, [collapsed, elH, winH]);

  /* 持久化 */
  useEffect(() => { savePos({ y, collapsed }); }, [y, collapsed]);

  /* 任务消失时重置（下次任务进来时从默认位置开始也行，这里不做） */

  /* 拖动状态 */
  const dragRef = useRef({
    startY: 0,
    originY: 0,
    moved: false,
    dragging: false,
  });

  const onTouchStart = (e: any) => {
    const t = e.touches?.[0];
    if (!t) return;
    dragRef.current = {
      startY: t.clientY ?? t.pageY ?? 0,
      originY: y,
      moved: false,
      dragging: true,
    };
  };

  const onTouchMove = (e: any) => {
    if (!dragRef.current.dragging) return;
    const t = e.touches?.[0];
    if (!t) return;
    const cur = t.clientY ?? t.pageY ?? 0;
    const delta = cur - dragRef.current.startY;
    if (Math.abs(delta) > TAP_THRESHOLD) dragRef.current.moved = true;
    const h = collapsed ? COLLAPSED_SIZE : Math.max(elH, 80);
    setY(clamp(dragRef.current.originY + delta, SAFE_TOP, winH - h - SAFE_BOTTOM));
  };

  const onTouchEnd = () => {
    dragRef.current.dragging = false;
  };

  /* 用 onLayout 等价物：通过 ref 测量元素高度 */
  const cardSelector = '.global-progress-portal .gp-card-inner';
  useEffect(() => {
    if (collapsed) return;
    // 多次延迟测量，等 DOM 渲染稳定
    const timers: any[] = [];
    [80, 250, 600].forEach((d) => {
      timers.push(setTimeout(() => {
        const q = Taro.createSelectorQuery();
        q.select(cardSelector).boundingClientRect((rect: any) => {
          if (rect && rect.height && Math.abs(rect.height - elH) > 4) {
            setElH(rect.height);
          }
        }).exec();
      }, d));
    });
    return () => { timers.forEach(clearTimeout); };
  }, [collapsed, tasks.length]);

  if (tasks.length === 0) return null;

  /* ────────────────── 渲染：折叠态 ────────────────── */

  if (collapsed) {
    /* 决定显示的图标：优先 active 上传，其次 active 下载，否则取首个任务 */
    const active = tasks.find((t) => t.status === 'uploading' || t.status === 'downloading');
    const head = active ?? tasks[0]!;
    const isUp = head.kind === 'upload';
    const totalCount = tasks.length;

    return (
      <View
        className="global-progress-portal"
        style={{ top: `${y}px`, right: '24rpx' }}
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
    );
  }

  /* ────────────────── 渲染：展开大卡片 ────────────────── */

  const pages = Taro.getCurrentPages();

  return (
    <View
      className="global-progress-portal"
      style={{ top: `${y}px`, left: '32rpx', right: '32rpx' }}
    >
      <View className="gp-card-inner">
        {/* 顶部抓手栏（拖动 + 折叠） */}
        <View
          className="gp-handle"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <View className="gp-handle-bar" />
          <View
            className="gp-collapse-btn"
            onClick={(e: any) => {
              e.stopPropagation();
              setCollapsed(true);
            }}
            onTouchStart={(e: any) => e.stopPropagation()}
            onTouchMove={(e: any) => e.stopPropagation()}
          >
            <Image src={iconChevronDown('#94a3b8')} className="gp-collapse-icon" />
          </View>
        </View>

        {tasks.map((t) => {
          const isUpload = t.kind === 'upload';
          const isActive = t.status === 'uploading' || t.status === 'downloading';
          const isPaused = t.status === 'paused';
          const total = t.total;
          const pct = total > 0 ? Math.round((t.done / total) * 100) : 0;

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
            <View key={isUpload ? t.shareId : t.shareCode} className="gp-row" onClick={onRowClick}>
              <View className="gp-row-left">
                <Text className="gp-row-label">
                  {isUpload ? '↑' : '↓'}
                  {' '}{isUpload ? `上传 ${t.done}/${total}` : `保存 ${t.done}/${total}`}
                  {t.formTitle ? ` · ${t.formTitle}` : ''}
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
              <View className="gp-row-actions" onClick={(e: any) => e.stopPropagation()}>
                {isActive && (
                  <View
                    className="gp-row-btn"
                    onClick={() =>
                      isUpload
                        ? taskManager.pauseUpload(t.shareId)
                        : taskManager.pauseDownload(t.shareCode)
                    }
                  >
                    <Image src={iconPause('#475569')} className="gp-row-btn-icon" />
                  </View>
                )}
                {isPaused && (
                  <View
                    className="gp-row-btn"
                    onClick={() =>
                      isUpload
                        ? taskManager.resumeUpload(t.shareId)
                        : taskManager.resumeDownload(t.shareCode)
                    }
                  >
                    <Image
                      src={isUpload ? iconUpload('#3b82f6') : iconDownload('#3b82f6')}
                      className="gp-row-btn-icon"
                    />
                  </View>
                )}
                <View
                  className="gp-row-btn"
                  onClick={() =>
                    isUpload
                      ? taskManager.cancelUpload(t.shareId)
                      : taskManager.cancelDownload(t.shareCode)
                  }
                >
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

/* ────────────────── 工具 ────────────────── */

function clamp(v: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(v, min), max);
}
