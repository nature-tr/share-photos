import { PropsWithChildren } from 'react';
import { useLaunch } from '@tarojs/taro';
import Taro from '@tarojs/taro';
import { useAuth } from '@/stores/auth.store';
import { useTaskStore } from '@/stores/task.store';
import PrivacyConsent from '@/components/PrivacyConsent';
import './app.scss';

/* ── 从 storage 恢复悬浮窗位置（全局仅一次） ── */
const STORAGE_KEY = 'gp_pos_v1';
interface Pos { y: number; ballX?: number; collapsed: boolean }
function loadPos(): Pos | null {
  try { const r = Taro.getStorageSync(STORAGE_KEY); return r ? JSON.parse(r) as Pos : null; } catch { return null; }
}

function App({ children }: PropsWithChildren) {
  const checkAuth = useAuth((s) => s.checkAuth);

  useLaunch(() => {
    void checkAuth();
    /* 初始化悬浮窗位置（全局只这一次，之后各页面共享 store 值） */
    const saved = loadPos();
    const { windowHeight: H = 667, windowWidth: W = 375 } = (() => {
      try { const s = Taro.getSystemInfoSync(); return { windowHeight: s.windowHeight, windowWidth: s.windowWidth }; }
      catch { return { windowHeight: 667, windowWidth: 375 }; }
    })();
    const BALL_H = 64, SAFE_T = 80;
    const sy = saved?.y ?? Math.max(SAFE_T, H - 240);
    const sx = saved?.ballX ?? W - BALL_H - 16;
    const sc = saved?.collapsed ?? false;
    useTaskStore.getState().setGpPos(sy, sx, sc);
  });

  return (
    <>
      {children}
      <PrivacyConsent />
      {/* GlobalProgress 在各页面中渲染（不可放 app 层：Taro App 层 fixed 元素会被 page native view 遮挡） */}
    </>
  );
}

export default App;
