import { useEffect, useMemo, useRef, useState } from 'react';
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

/* ────────────────── 屏幕尺寸（同步一次） ────────────────── */

function getWindowHeight(): number {
  try {
    return Taro.getSystemInfoSync().windowHeight;
  } catch {
    return 667;
  }
}

/* ────────────────── 主体 ────────────────── */

const COLLAPSED_SIZE = 56;     // 悬浮球尺寸 px
const SAFE_TOP = 80;           // 不要遮挡顶部导航
const SAFE_BOTTOM = 12;        // 与屏幕底部最小间距
const TAP_THRESHOLD = 6;       // 拖动 vs 点击的阈值（px）

type ActiveTask =
  | (UploadTask & { kind: 'upload'; title?: string })
  | (DownloadTask & { kind: 'download'; title?: string });

/** 用 useShallow 仅订阅"活动任务的关键标量"，避免任意 setState 都重渲。 */
function useActiveTasks(): ActiveTask[] {
  return useTaskStore(
    useShallow((s) => {
      const ups: ActiveTask[] = [];
      for (const t of Object.values(s.uploads)) {
        if (t.status === 'cancelled') continue;
        ups.push({ ...t, kind: 'upload', title: taskManager.getUploadCtx(t.shareId)?.meta.title });
      }
      const dls: ActiveTask[] = [];
      for (const t of Object.values(s.downloads)) {
        if (t.status === 'cancelled') continue;
        dls.push({ ...t, kind: 'download' });
      }
      return [...ups, ...dls];
    }),
  );
}

export default function GlobalProgress() {
  const tasks = useActiveTasks();

  /* 屏幕高度（仅取一次） */
  const winH = useMemo(() => getWindowHeight(), []);

  /* 初始位置：lazy init 仅在挂载时读 storage 一次 */
  const [collapsed, setCollapsed] = useState<boolean>(() => loadPos()?.collapsed ?? false);
  const [y, setY] = useState<number>(() => {
    const init = loadPos();
    if (init?.y != null) return init.y;
    return Math.max(SAFE_TOP, winH - 240);
  });

  /* 元素自身高度（用于限制拖动边界） */
  const [elH, setElH] = useState<number>(collapsed ? COLLAPSED_SIZE : 120);

  /* 折叠态切换时调整 y 不超出底部 */
  useEffect(() => {
    const h = collapsed ? COLLAPSED_SIZE : Math.max(elH, 80);
    setY((prev) => clamp(prev, SAFE_TOP, winH - h - SAFE_BOTTOM));
  }, [collapsed, elH, winH]);

  /* 拖动状态（写入 ref 避免重渲；仅在 onTouchEnd 持久化一次） */
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
    if (dragRef.current.dragging && dragRef.current.moved) {
      // 仅拖动结束保存一次
      savePos({ y, collapsed });
    }
    dragRef.current.dragging = false;
  };

  /* collapsed 变化时单独持久化（折叠/展开切换） */
  useEffect(() => { savePos({ y, collapsed }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [collapsed]);

  /* 测量元素实际高度：用 nextTick 等 DOM 提交 */
  useEffect(() => {
    if (collapsed) return;
    const measure = () => {
      const q = Taro.createSelectorQuery();
      q.select('.global-progress-portal .gp-card-inner')
        .boundingClientRect((rect: any) => {
          if (rect && rect.height && Math.abs(rect.height - elH) > 4) {
            setElH(rect.height);
          }
        })
        .exec();
    };
    if (typeof Taro.nextTick === 'function') Taro.nextTick(measure);
    else setTimeout(measure, 50);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [collapsed, tasks.length]);

  if (tasks.length === 0) return null;

  /* ────────────────── 折叠态 ────────────────── */

  if (collapsed) {
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

  /* ────────────────── 展开大卡片 ────────────────── */

  const pages = Taro.getCurrentPages();

  return (
    <View
      className="global-progress-portal"
      style={{ top: `${y}px`, left: '32rpx', right: '32rpx' }}
    >
      <View className="gp-card-inner">
        {/* 抓手 + 折叠按钮 */}
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
          const id = isUpload ? t.shareId : t.shareCode;

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
                  {t.title ? ` · ${t.title}` : ''}
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

function clamp(v: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(v, min), max);
}
