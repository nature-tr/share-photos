/**
 * 隐私协议同意弹窗（微信官方正确模式）
 *
 * 不使用已废弃的 wx.requirePrivacyAuthorize。
 * 通过 wx.onNeedPrivacyAuthorization 监听隐私授权需求事件：
 *   用户调用 chooseMedia / saveImage 等 → 微信触发 onNeedPrivacyAuthorization
 *   → 弹窗展示协议 → 用户点击同意 → 回调 resolve({ event:'agree' })
 *   → 微信完成授权 → 隐私接口可以正常调用
 */

import { useEffect, useRef, useState } from 'react';
import Taro from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import './index.scss';

const PRIVACY_STORAGE_KEY = 'privacy_agreed_v3';

export default function PrivacyConsent() {
  const [visible, setVisible] = useState(false);
  const initDone = useRef(false);
  /** 存储微信传入的 resolve 函数，用户同意时调用 */
  const resolveRef = useRef<((res: { event: string }) => void) | null>(null);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    // 已同意过不再弹
    try {
      if (Taro.getStorageSync(PRIVACY_STORAGE_KEY)) return;
    } catch { /* */ }

    // 官方模式：监听隐私授权需求事件
    if (typeof (Taro as any).onNeedPrivacyAuthorization === 'function') {
      const handler = (resolve: (res: { event: string }) => void, args?: any) => {
        resolveRef.current = resolve;
        setVisible(true);
      };
      (Taro as any).onNeedPrivacyAuthorization(handler);
      return () => {
        try { (Taro as any).offNeedPrivacyAuthorization?.(handler); } catch { /* */ }
      };
    }

    // 降级：旧版微信，尝试 requirePrivacyAuthorize（必须在用户手势中调用，否则无效）
    setTimeout(() => {
      try {
        (Taro as any).requirePrivacyAuthorize?.({
          success: () => onAgreed(),
          fail: () => setVisible(true),
        });
      } catch {
        setVisible(true);
      }
    }, 100);
  }, []);

  const handleAgree = () => {
    // 通知微信平台：用户已同意
    if (resolveRef.current) {
      resolveRef.current({ event: 'agree' });
      resolveRef.current = null;
    }
    onAgreed();
  };

  const handleDisagree = () => {
    if (resolveRef.current) {
      resolveRef.current({ event: 'disagree' });
      resolveRef.current = null;
    }
    setVisible(false);
    Taro.showModal({
      title: '提示',
      content: '需要同意隐私保护指引才能使用本服务。您可以稍后在「关于」页面重新同意。',
      showCancel: false,
      confirmText: '我知道了',
    });
  };

  const onAgreed = () => {
    try { Taro.setStorageSync(PRIVACY_STORAGE_KEY, true); } catch { /* */ }
    setVisible(false);
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
