import { useState } from 'react';
import { View, Text, Input, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useAuth, getUserFromStorage } from '@/stores/auth.store';
import { getHistory, saveHistoryList } from '@/utils/history';
import { getViewerShare } from '@/api/share.api';
import GlobalProgress from '@/components/GlobalProgress';
import {
  iconAdd,
  iconList,
  iconLogout,
  iconScan,
  iconFolder,
  iconArrowRight,
} from '@/assets/icons';
import logoImg from '../../assets/logo.png';
import './index.scss';

interface HistoryItem { code: string; title: string; lastViewedAt: number; photoCount: number }

export default function IndexPage() {
  const storeUser = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  // 首次渲染直接读 storage 保底，后续以 zustand 为准
  const [storageUser] = useState(() => getUserFromStorage());
  const user = storeUser ?? storageUser;
  const [code, setCode] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useDidShow(() => {
    const raw = getHistory();
    setHistory(raw);
    // 后台验证：移除失效分享 + 同步重命名
    if (raw.length > 0) {
      Promise.all(
        raw.map((h) =>
          getViewerShare(h.code, 1, 1)
            .then((res) => {
              if (res.error) return { code: h.code, invalid: true };
              const newTitle = res.data?.title;
              if (newTitle && newTitle !== h.title) return { code: h.code, title: newTitle };
              return null;
            })
            .catch(() => ({ code: h.code, invalid: true })),
        ),
      ).then((results) => {
        const hasChange = results.some((r) => r !== null);
        if (!hasChange) return;
        let list = getHistory();
        for (const r of results) {
          if (!r) continue;
          if ((r as any).invalid) {
            list = list.filter((x) => x.code !== r.code);
          } else if ((r as any).title) {
            list = list.map((x) => (x.code === r.code ? { ...x, title: (r as any).title } : x));
          }
        }
        saveHistoryList(list);
        setHistory(list);
      });
    }
  });

  function go() {
    const c = code.trim().toUpperCase();
    if (!c) return;
    Taro.navigateTo({ url: `/pages/viewer/detail/index?code=${c}` });
  }
  function gotoScan() { Taro.navigateTo({ url: '/pages/scan/index' }); }
  function confirmLogout() {
    Taro.showModal({ title: '退出登录', content: '确认登出当前账号？', confirmColor: '#ef4444', success: (r) => { if (r.confirm) void logout(); } });
  }

  return (
    <View className="page-root">
      {/* 顶栏：左 头像+用户名 / logo，右 新建/我的/退出 */}
      <View className="top-bar">
        <View className="top-left">
          {user && (
            <View className="top-avatar">
              <Text className="top-avatar-text">{(user.displayName || user.email).slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <Text className="top-logo">{user ? (user.displayName || user.email) : '格子橱窗'}</Text>
        </View>
        <View className="top-actions">
          {user ? (
            <>
              <View className="top-icon" onClick={() => Taro.navigateTo({ url: '/pages/me/new/index' })}>
                <Image src={iconAdd('#475569')} className="top-icon-img" />
              </View>
              <View className="top-icon" onClick={() => Taro.navigateTo({ url: '/pages/me/shares/index' })}>
                <Image src={iconList('#475569')} className="top-icon-img" />
              </View>
              <View className="top-logout" onClick={confirmLogout}>
                <Image src={iconLogout('#94a3b8')} className="top-icon-img top-icon-img-sm" />
              </View>
            </>
          ) : (
            <View className="top-login-btn" onClick={() => Taro.navigateTo({ url: '/pages/auth/login/index' })}>
              <Text className="top-login-btn-text">登录</Text>
            </View>
          )}
        </View>
      </View>

      {/* 品牌区 */}
      <View className="brand-section">
        <View className="logo-box">
          <Image src={logoImg} className="logo-img" mode="aspectFit" />
        </View>
        <Text className="app-title">格子橱窗</Text>
        <Text className="app-subtitle">限时分享相册 · 一键存到手机相册</Text>
      </View>

      {/* 输入分享码 + 扫码 */}
      <View className="card">
        <Text className="card-label">输入分享码</Text>
        <View className="code-row">
          <Input className="code-input" value={code} onInput={(e) => setCode(e.detail.value.toUpperCase())} placeholder="ABCD1234" maxlength={8} confirmType="go" onConfirm={go} />
          <View className="code-scan-btn" onClick={gotoScan}>
            <Image src={iconScan('#2563eb')} className="code-scan-img" />
          </View>
        </View>
        <View className={`btn-primary ${!code.trim() ? 'btn-primary-disabled' : ''}`} onClick={() => code.trim() && go()}>
          <Text className="btn-primary-text">查看相册</Text>
        </View>
      </View>

      {/* 最近浏览 */}
      {history.length > 0 && (
        <>
          <Text className="section-label">最近浏览</Text>
          <View className="history-list">
            {history.slice(0, 5).map((h) => (
              <View key={h.code} className="history-item" onClick={() => Taro.navigateTo({ url: `/pages/viewer/detail/index?code=${h.code}&fromHistory=1` })}>
                <View className="history-icon">
                  <Image src={iconFolder('#2563eb')} className="history-icon-img" />
                </View>
                <View className="history-body">
                  <Text className="history-title" numberOfLines={1}>{h.title || h.code}</Text>
                  <Text className="history-desc">{h.photoCount} 张 · {h.code}</Text>
                </View>
                <Image src={iconArrowRight('#cbd5e1')} className="row-arrow" />
              </View>
            ))}
          </View>
        </>
      )}

      <View style={{ height: '64rpx' }} />
      <Text className="footer-text">格子橱窗 · v0.1</Text>
      <GlobalProgress />
    </View>
  );
}
