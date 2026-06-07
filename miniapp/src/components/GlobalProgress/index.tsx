import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import Taro from '@tarojs/taro';
import { View, Text, Image, MovableArea, MovableView } from '@tarojs/components';
import { useTaskStore, type UploadTask, type DownloadTask } from '@/stores/task.store';
import { taskManager } from '@/stores/task.manager';
import { iconPause, iconUpload, iconDownload, iconXMark, iconChevronDown } from '@/assets/icons';
import './index.scss';

/* ───── 持久化 ───── */

const STORAGE_KEY = 'gp_pos_v1';
interface Pos { y: number; ballX?: number; collapsed: boolean }
function loadPos(): Pos | null {
  try { const r = Taro.getStorageSync(STORAGE_KEY); return r ? JSON.parse(r) as Pos : null; } catch { return null; }
}
function savePos(p: Pos) {
  try { Taro.setStorageSync(STORAGE_KEY, JSON.stringify(p)); } catch { /* */ }
}

/* ───── 屏幕尺寸（px） ───── */

const { windowHeight: H, windowWidth: W } = (() => {
  try { const s = Taro.getSystemInfoSync(); return { windowHeight: s.windowHeight, windowWidth: s.windowWidth }; }
  catch { return { windowHeight: 667, windowWidth: 375 }; }
})();

/* 折叠球视觉 96rpx，按 750 设计稿换算到当前屏幕 px */
const RPX = W / 750;
const BALL_PX = Math.round(96 * RPX);          // 球可视尺寸
const BALL_HIT = Math.round(128 * RPX);        // 拖拽热区（比可视大一圈）
const CARD_MARGIN_PX = Math.round(32 * RPX);   // 卡片左右间距 32rpx
const CARD_W_PX = W - CARD_MARGIN_PX * 2;
const SAFE_T = 80;
const SAFE_B = 12;

/* ───── 任务订阅 ───── */

type AT = (UploadTask & { kind: 'upload' }) | (DownloadTask & { kind: 'download' });
function useActiveTasks(): AT[] {
  const ups = useTaskStore(useShallow((s) => s.uploads));
  const dls = useTaskStore(useShallow((s) => s.downloads));
  const out: AT[] = [];
  for (const id of Object.keys(ups)) { const t = ups[id]; if (t && t.status !== 'cancelled') out.push({ ...t, kind: 'upload' }); }
  for (const id of Object.keys(dls)) { const t = dls[id]; if (t && t.status !== 'cancelled') out.push({ ...t, kind: 'download' }); }
  return out;
}

function clamp(v: number, lo: number, hi: number) { return Math.min(Math.max(v, lo), hi); }

/* ───── 主体 ───── */

export default function GlobalProgress() {
  const tasks   = useActiveTasks();
  const init    = useRef(loadPos()).current;
  const pages   = Taro.getCurrentPages();

  const [collapsed, setCollapsed] = useState(init?.collapsed ?? false);
  const [y, setY] = useState(init?.y ?? Math.max(SAFE_T, H - 240));
  const [bx, setBx] = useState(init?.ballX ?? W - BALL_HIT - 16);

  /* 拖拽过程：仅记录是否真正发生过位移，用来抑制点击 */
  const movedRef = useRef(false);

  /* 折叠态切换：调整 y 不超界，并持久化 */
  useEffect(() => {
    setY((p) => clamp(p, SAFE_T, H - (collapsed ? BALL_HIT : 120) - SAFE_B));
    savePos({ y, ballX: bx, collapsed });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed]);

  if (tasks.length === 0) return null;

  /* ───── 折叠态：小球 ───── */
  if (collapsed) {
    const act = tasks.find((t) => t.status === 'uploading' || t.status === 'downloading');
    const hd  = act ?? tasks[0]!;
    const up  = hd.kind === 'upload';
    const n   = tasks.length;

    return (
      <MovableArea className="gp-area">
        <MovableView
          className="gp-mv-ball"
          direction="all"
          x={bx}
          y={y}
          inertia={false}
          outOfBounds={false}
          damping={50}
          onChange={(e: any) => {
            // 用户拖动（source==='touch'）才认为发生了位移；惯性等不算
            if (e.detail.source === 'touch') movedRef.current = true;
          }}
          onTouchEnd={() => {
            // movable-view 的 x/y 是受控的，但 onChange 不会自动同步到 state
            // 所以 onTouchEnd 时通过 query 拿当前位置（不需要也行：用 onChange 中的 detail）
          }}
          /** onChange detail.x/y 是实时位置，记录到 state */
          /* @ts-ignore */
          onTouchStart={() => { movedRef.current = false; }}
        >
          <View
            className={`gp-ball ${hd.status === 'paused' ? 'gp-ball-paused' : ''}`}
            onClick={() => {
              if (movedRef.current) { movedRef.current = false; return; }
              // 真正记下位置（拖动结束后）
              setCollapsed(false);
            }}
          >
            <Image src={up ? iconUpload('#fff') : iconDownload('#fff')} className="gp-ball-icon" />
            {n > 1 && <View className="gp-ball-badge"><Text className="gp-ball-badge-text">{n}</Text></View>}
          </View>
        </MovableView>
      </MovableArea>
    );
  }

  /* ───── 展开态：大卡片 ───── */
  return (
    <MovableArea className="gp-area">
      <MovableView
        className="gp-mv-card"
        direction="vertical"
        x={CARD_MARGIN_PX}
        y={y}
        inertia={false}
        outOfBounds={false}
        damping={50}
        onChange={(e: any) => {
          if (e.detail.source === 'touch') {
            movedRef.current = true;
            setY(e.detail.y);
          }
        }}
        onTouchStart={() => { movedRef.current = false; }}
        onTouchEnd={() => {
          if (movedRef.current) savePos({ y, ballX: bx, collapsed });
        }}
      >
        <View className="gp-card">
          <View className="gp-handle"><View className="gp-handle-bar" /></View>
          <View
            className="gp-collapse-btn" hoverClass="gp-collapse-btn-hover" hoverStayTime={120}
            onClick={() => { if (!movedRef.current) { setBx(bx); setCollapsed(true); } movedRef.current = false; }}
          >
            <Image src={iconChevronDown('#94a3b8')} className="gp-collapse-icon" />
          </View>
          {tasks.map((t) => {
            const up = t.kind === 'upload';
            const ac = t.status === 'uploading' || t.status === 'downloading';
            const pa = t.status === 'paused';
            const pc = t.total > 0 ? Math.round((t.done / t.total) * 100) : 0;
            const title = up ? taskManager.getUploadCtx(t.shareId)?.meta.title : '';
            return (
              <View key={up ? t.shareId : t.shareCode} className="gp-row" onClick={() => {
                if (movedRef.current) { movedRef.current = false; return; }
                const cur = pages[pages.length - 1];
                if (up) { if (cur?.route !== 'pages/me/new/index') Taro.navigateTo({ url: `/pages/me/new/index?restoreShareId=${t.shareId}` }); }
                else { if (!(cur?.route === 'pages/viewer/detail/index' && (cur?.options as any)?.code === t.shareCode)) Taro.navigateTo({ url: `/pages/viewer/detail/index?code=${t.shareCode}` }); }
              }}>
                <View className="gp-row-left">
                  <Text className="gp-row-label">
                    {up ? '↑' : '↓'} {up ? `上传 ${t.done}/${t.total}` : `保存 ${t.done}/${t.total}`}{title ? ` · ${title}` : ''}{pa ? ' 已暂停' : ''}{t.failed > 0 ? ` (失败${t.failed})` : ''}
                  </Text>
                  {(ac || pa) && <View className="gp-row-track"><View className="gp-row-fill" style={{ width: `${pc}%`, background: pa ? '#94a3b8' : undefined }} /></View>}
                </View>
                <View className="gp-row-actions">
                  {ac && <View className="gp-row-btn" hoverClass="gp-row-btn-hover" hoverStayTime={120} onClick={(e: any) => { e.stopPropagation(); up ? taskManager.pauseUpload(t.shareId) : taskManager.pauseDownload(t.shareCode); }}>
                    <Image src={iconPause('#475569')} className="gp-row-btn-icon" /></View>}
                  {pa && <View className="gp-row-btn" hoverClass="gp-row-btn-hover" hoverStayTime={120} onClick={(e: any) => { e.stopPropagation(); up ? taskManager.resumeUpload(t.shareId) : taskManager.resumeDownload(t.shareCode); }}>
                    <Image src={up ? iconUpload('#3b82f6') : iconDownload('#3b82f6')} className="gp-row-btn-icon" /></View>}
                  <View className="gp-row-btn" hoverClass="gp-row-btn-hover" hoverStayTime={120} onClick={(e: any) => { e.stopPropagation(); up ? taskManager.cancelUpload(t.shareId) : taskManager.cancelDownload(t.shareCode); }}>
                    <Image src={iconXMark('#94a3b8')} className="gp-row-btn-icon" /></View>
                </View>
              </View>
            );
          })}
        </View>
      </MovableView>
    </MovableArea>
  );
}
