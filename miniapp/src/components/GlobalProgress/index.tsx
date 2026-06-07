import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import Taro from '@tarojs/taro';
import { View, Text, Image } from '@tarojs/components';
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

/* ───── 常量 ───── */

const { windowHeight: H, windowWidth: W } = (() => {
  try { const s = Taro.getSystemInfoSync(); return { windowHeight: s.windowHeight, windowWidth: s.windowWidth }; }
  catch { return { windowHeight: 667, windowWidth: 375 }; }
})();
const BALL_H  = 64, CARD_H = 120, SAFE_T = 80, SAFE_B = 12, MARGIN  = 16, TAP_D = 8;
function clamp(v: number, lo: number, hi: number) { return Math.min(Math.max(v, lo), hi); }

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

/* ───── 主体 ───── */

export default function GlobalProgress() {
  const tasks   = useActiveTasks();
  const pages   = Taro.getCurrentPages();

  /* 从全局 store 读取/写入，所有页面共享同一份 collapsed / 位置 */
  const collapsed = useTaskStore((s) => s.gpCollapsed);
  const y = useTaskStore((s) => s.gpY);
  const bx = useTaskStore((s) => s.gpBallX);
  const setCollapsed = useTaskStore((s) => s.setGpCollapsed);
  const setGpPos = useTaskStore((s) => s.setGpPos);
  const shield = useTaskStore((s) => s.gpShield);
  const setShield = useTaskStore((s) => s.setGpShield);

  /* 初次挂载时从 storage 恢复（仅对当前组件实例初始值，store 里已有默认 0） */
  const initDone = useRef(false);
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    const saved = loadPos();
    if (saved) {
      setGpPos(saved.y ?? Math.max(SAFE_T, H - 240), saved.ballX ?? W - BALL_H - MARGIN, saved.collapsed ?? false);
    } else {
      setGpPos(Math.max(SAFE_T, H - 240), W - BALL_H - MARGIN, false);
    }
  }, []);

  /* collapsed 变化时夹 y 到合法范围 */
  useEffect(() => {
    const newY = clamp(y, SAFE_T, H - (collapsed ? BALL_H : CARD_H) - SAFE_B);
    if (newY !== y) setGpPos(newY, bx, collapsed, savePos);
    else savePos({ y, ballX: bx, collapsed });
  }, [collapsed]);

  /* ─── 拖动 ─── */
  const dr = useRef({ sx: 0, sy: 0, ox: 0, oy: 0, moved: false, on: false });

  const ts = (e: any) => {
    const t = e.touches?.[0]; if (!t) return;
    dr.current.sx = t.pageX ?? t.clientX ?? 0;
    dr.current.sy = t.pageY ?? t.clientY ?? 0;
    dr.current.ox = bx;
    dr.current.oy = y;
    dr.current.moved = false;
    dr.current.on = true;
    setShield(true);
  };

  const tm = (e: any) => {
    if (!dr.current.on) return;
    const t = e.touches?.[0]; if (!t) return;
    const dx = (t.pageX ?? t.clientX ?? 0) - dr.current.sx;
    const dy = (t.pageY ?? t.clientY ?? 0) - dr.current.sy;
    if (Math.abs(dx) + Math.abs(dy) < TAP_D) return;
    dr.current.moved = true;
    const newY = clamp(dr.current.oy + dy, SAFE_T, H - (collapsed ? BALL_H : CARD_H) - SAFE_B);
    const newX = collapsed ? clamp(dr.current.ox + dx, MARGIN, W - BALL_H - MARGIN) : bx;
    setGpPos(newY, newX, collapsed);
  };

  const te = () => {
    if (dr.current.on && dr.current.moved) savePos({ y, ballX: bx, collapsed });
    dr.current.on = false;
    setShield(false);
  };

  if (tasks.length === 0) return null;

  /* 遮罩：始终在 DOM，catchMove 永不断开。静止 1px 锚角，拖拽撑满全屏 */
  const shieldView = (
    <View
      className="gp-shield"
      catchMove
      style={{ width: shield ? '100%' : '1px', height: shield ? '100%' : '1px' }}
    />
  );

  /* ─── 小球 ─── */
  const ball = (() => {
    const act = tasks.find((t) => t.status === 'uploading' || t.status === 'downloading');
    const hd  = act ?? tasks[0]!;
    const up  = hd.kind === 'upload';
    const n   = tasks.length;
    return (
      <View className="gp-portal gp-portal-ball" style={{ top: `${y}px`, left: `${bx}px` }}>
        <View className="gp-ball-hitarea" catchMove onTouchStart={ts} onTouchMove={tm} onTouchEnd={te}
          onClick={() => { if (!dr.current.moved) setCollapsed(false); }}>
          <View className={`gp-ball ${hd.status === 'paused' ? 'gp-ball-paused' : ''}`}>
            <Image src={up ? iconUpload('#fff') : iconDownload('#fff')} className="gp-ball-icon" />
            {n > 1 && <View className="gp-ball-badge"><Text className="gp-ball-badge-text">{n}</Text></View>}
          </View>
        </View>
      </View>
    );
  })();

  /* ─── 卡片 ─── */
  const card = (
    <View className="gp-portal gp-portal-card" style={{ top: `${y}px` }}>
      <View className="gp-card">
        <View className="gp-handle" catchMove onTouchStart={ts} onTouchMove={tm} onTouchEnd={te}>
          <View className="gp-handle-bar" />
        </View>
        <View className="gp-collapse-btn" hoverClass="gp-collapse-btn-hover" hoverStayTime={120} onClick={() => setCollapsed(true)}>
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
                {ac && <View className="gp-row-btn" hoverClass="gp-row-btn-hover" hoverStayTime={120} catchMove onClick={(e: any) => { e.stopPropagation(); up ? taskManager.pauseUpload(t.shareId) : taskManager.pauseDownload(t.shareCode); }}>
                  <Image src={iconPause('#475569')} className="gp-row-btn-icon" /></View>}
                {pa && <View className="gp-row-btn" hoverClass="gp-row-btn-hover" hoverStayTime={120} catchMove onClick={(e: any) => { e.stopPropagation(); up ? taskManager.resumeUpload(t.shareId) : taskManager.resumeDownload(t.shareCode); }}>
                  <Image src={up ? iconUpload('#3b82f6') : iconDownload('#3b82f6')} className="gp-row-btn-icon" /></View>}
                <View className="gp-row-btn" hoverClass="gp-row-btn-hover" hoverStayTime={120} catchMove onClick={(e: any) => { e.stopPropagation(); up ? taskManager.cancelUpload(t.shareId) : taskManager.cancelDownload(t.shareCode); }}>
                  <Image src={iconXMark('#94a3b8')} className="gp-row-btn-icon" /></View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );

  return <>{shieldView}{collapsed ? ball : card}</>;
}
