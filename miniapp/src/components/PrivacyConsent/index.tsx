/**
 * 隐私协议同意弹窗（直接调用 wx 底层 API，跳过 Taro 包装层）
 *
 * 前几版失败原因：
 *   1. wx.requirePrivacyAuthorize 已废弃，且必须在用户手势中调用
 *   2. Taro 4 的 onNeedPrivacyAuthorization 可能未正确暴露底层 API
 *
 * 本版：直接调用 wx 全局对象，不经过 Taro 中间层。
 * 注册 wx.onNeedPrivacyAuthorization → 用户调 chooseMedia 时
 * 微信底层触发该事件 → 弹窗 → 用户点同意 → resolve({event:'agree'})
 */

import { useEffect, useRef, useState } from 'react';
import Taro from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import './index.scss';

/** 获取原生 wx 对象（不经过 Taro） */
function getWx(): any {
  return (globalThis as any).wx || (Taro as any).apiready || wx || (Taro as any);
}

export default function PrivacyConsent() {
  const [visible, setVisible] = useState(false);
  const resolveRef = useRef<((res: { event: string }) => void) | null>(null);
  const initDone = useRef(false);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    const wxNative = getWx();

    // 总是注册监听（不要检查 storage），让微信底层决定是否需要弹窗
    if (typeof wxNative?.onNeedPrivacyAuthorization === 'function') {
      const handler = (resolve: (res: { event: string }) => void) => {
        resolveRef.current = resolve;
        setVisible(true);
      };
      wxNative.onNeedPrivacyAuthorization(handler);
    }
    // 无 onNeedPrivacyAuthorization 时降级：首次启动弹一次自定义弹窗
    else {
      try {
        if (Taro.getStorageSync('privacy_agreed_v3')) return;
      } catch { /* */ }
      setVisible(true);
    }
  }, []);

  const handleAgree = () => {
    // 通知微信底层：用户已同意
    if (resolveRef.current) {
      resolveRef.current({ event: 'agree' });
      resolveRef.current = null;
    }
    try { Taro.setStorageSync('privacy_agreed_v3', true); } catch { /* */ }
    setVisible(false);
  };

  const handleDisagree = () => {
    if (resolveRef.current) {
      resolveRef.current({ event: 'disagree' });
      resolveRef.current = null;
    }
    setVisible(false);
    Taro.showModal({
      title: '提示',
      content: '需要同意隐私保护指引才能使用选图和保存功能。',
      showCancel: false,
      confirmText: '我知道了',
    });
  };

  if (!visible) return null;

  return (
    <View className="privacy-overlay">
      <View className="privacy-card">
        <Text className="privacy-title">隐私保护指引</Text>
        <View className="privacy-content-scroll">
          <Text className="privacy-content">
格子橱窗尊重并保护您的隐私。为提供相册分享服务，我们将按照以下原则处理您的信息：

1. 账号信息（邮箱、昵称）
   用于创建和管理您的账户，仅存储在我们的服务器上。

2. 您上传的图片
   仅存储在您指定的分享中，到期自动删除且不可恢复。

3. 相册权限（读取 + 写入）
   仅在您主动选图上传或保存图片时使用，不会在后台访问。

4. 本地存储
   用于保存登录状态和浏览记录，仅本地保存，不上传至服务器。

同意后即可正常使用选图和保存功能。
          </Text>
        </View>
        <View className="privacy-links">
          <Text className="privacy-link" onClick={() => Taro.navigateTo({ url: '/pages/me/privacy/index' })}>查看隐私政策</Text>
          <Text className="privacy-link-sep">|</Text>
          <Text className="privacy-link" onClick={() => Taro.navigateTo({ url: '/pages/me/terms/index' })}>查看用户协议</Text>
        </View>
        <View className="privacy-buttons">
          <View className="privacy-btn privacy-btn-reject" onClick={handleDisagree}>
            <Text className="privacy-btn-text">拒绝</Text>
          </View>
          <View className="privacy-btn privacy-btn-agree" onClick={handleAgree}>
            <Text className="privacy-btn-text">同意</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
