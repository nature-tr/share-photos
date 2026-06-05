import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAuth } from '@/stores/auth.store';
import './index.scss';

export default function SettingsPage() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  function confirmLogout() {
    Taro.showModal({
      title: '退出登录',
      content: '确认登出当前账号？',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          void logout();
          Taro.redirectTo({ url: '/pages/index/index' });
        }
      },
    });
  }

  return (
    <View className="page">
      {user && (
        <View className="card">
          <View className="user-row">
            <View className="avatar">
              <Text className="avatar-text">{(user.displayName || user.email).slice(0, 1).toUpperCase()}</Text>
            </View>
            <View className="user-detail">
              <Text className="user-name">{user.displayName || '未设置昵称'}</Text>
              <Text className="user-email">{user.email}</Text>
            </View>
          </View>
        </View>
      )}

      <View className="card">
        <Text className="card-title">关于</Text>
        <View className="info-row">
          <Text className="info-label">版本</Text>
          <Text className="info-value">v0.1.0</Text>
        </View>
        <View className="info-row">
          <Text className="info-label">格子橱窗</Text>
          <Text className="info-value">限时分享相册</Text>
        </View>
      </View>

      <View className="logout-wrap">
        <View className="logout-btn" onClick={confirmLogout}>
          <Text className="logout-btn-text">退出登录</Text>
        </View>
      </View>
    </View>
  );
}
