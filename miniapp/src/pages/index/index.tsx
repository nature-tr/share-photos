import { useState } from 'react';
import { View, Text, Input, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useAuth } from '@/stores/auth.store';
import { getHistory } from '@/utils/history';
import logoImg from '../../assets/logo.png';
import './index.scss';

interface HistoryItem { code: string; title: string; lastViewedAt: number; photoCount: number }

export default function IndexPage() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [code, setCode] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useDidShow(() => { setHistory(getHistory()); });

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
      {/* 顶栏：左 logo，右 新建/我的/用户chip+退出 */}
      <View className="top-bar">
        <Text className="top-logo">Dolmo Photo</Text>
        <View className="top-actions">
          {user ? (
            <>
              <View className="top-icon" onClick={() => Taro.navigateTo({ url: '/pages/me/new/index' })}>
                <Text className="top-icon-text">＋</Text>
              </View>
              <View className="top-icon" onClick={() => Taro.navigateTo({ url: '/pages/me/shares/index' })}>
                <Text className="top-icon-text">☰</Text>
              </View>
              <View className="top-user-chip">
                <View className="top-avatar">
                  <Text className="top-avatar-text">{(user.displayName || user.email).slice(0, 1).toUpperCase()}</Text>
                </View>
                <View className="top-logout" onClick={confirmLogout}>
                  <Text className="top-logout-text">↪</Text>
                </View>
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
        <Text className="app-title">Dolmo Photo</Text>
        <Text className="app-subtitle">限时分享相册 · 一键存到手机相册</Text>
      </View>

      {/* 输入分享码 */}
      <View className="card">
        <Text className="card-label">输入分享码</Text>
        <Input className="code-input" value={code} onInput={(e) => setCode(e.detail.value.toUpperCase())} placeholder="ABCD1234" maxlength={8} confirmType="go" onConfirm={go} />
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
              <View key={h.code} className="history-item" onClick={() => Taro.navigateTo({ url: `/pages/viewer/detail/index?code=${h.code}` })}>
                <View className="history-icon"><Text>⌘</Text></View>
                <View className="history-body">
                  <Text className="history-title" numberOfLines={1}>{h.title || h.code}</Text>
                  <Text className="history-desc">{h.photoCount} 张 · {h.code}</Text>
                </View>
                <Text className="arrow">›</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* 操作入口 */}
      <Text className="section-label">更多操作</Text>

      <View className="action-card" onClick={gotoScan}>
        <View className="action-icon action-icon-blue"><Text className="action-icon-text">⌒</Text></View>
        <View className="action-body">
          <Text className="action-title">扫一扫</Text>
          <Text className="action-desc">扫描分享码二维码进入</Text>
        </View>
        <Text className="arrow">›</Text>
      </View>

      <View className="action-card" onClick={() => { if (user) Taro.navigateTo({ url: '/pages/me/new/index' }); else Taro.navigateTo({ url: '/pages/auth/login/index' }); }}>
        <View className="action-icon action-icon-green"><Text className="action-icon-text">↑</Text></View>
        <View className="action-body">
          <Text className="action-title">分享图片</Text>
          <Text className="action-desc">{user ? '从相册选图，生成分享码与二维码' : '需要先登录账号'}</Text>
        </View>
        <Text className="arrow">›</Text>
      </View>

      {user && (
        <View className="action-card" onClick={() => Taro.navigateTo({ url: '/pages/me/shares/index' })}>
          <View className="action-icon action-icon-gray"><Text className="action-icon-text">≡</Text></View>
          <View className="action-body">
            <Text className="action-title">我的分享</Text>
            <Text className="action-desc">查看、续期或结束已创建的分享</Text>
          </View>
          <Text className="arrow">›</Text>
        </View>
      )}

      <View style={{ height: '64rpx' }} />
      <Text className="footer-text">Dolmo Photo · v0.1</Text>
    </View>
  );
}
