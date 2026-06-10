/**
 * 隐私协议同意弹窗
 *
 * 根据微信小程序2023年9月隐私合规要求：
 * 1. 首次启动时弹出隐私协议，用户同意后方可调用隐私接口
 * 2. 使用 wx.requirePrivacyAuthorize 完成平台级授权
 * 3. 同意状态持久化到 storage，后续不再弹
 */

import { useEffect, useRef, useState } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, RichText } from '@tarojs/components';
import './index.scss';

const PRIVACY_STORAGE_KEY = 'privacy_agreed_v2';

export default function PrivacyConsent() {
  const [visible, setVisible] = useState(false);
  const initDone = useRef(false);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    // 检查是否已同意
    try {
      const agreed = Taro.getStorageSync(PRIVACY_STORAGE_KEY);
      if (agreed) return;
    } catch { /* 首次启动或降级 */ }

    // 监听隐私授权需求事件
    const handler = () => {
      setVisible(true);
    };

    try {
      (Taro as any).onNeedPrivacyAuthorization?.(handler);
      // 同时也调用 requirePrivacyAuthorize 兜底（如果还没触发 onNeed 事件）
      setTimeout(() => {
        if (!initDone.current) return;
        try {
          (Taro as any).requirePrivacyAuthorize?.({
            success: () => { /* 用户授权在弹窗中处理 */ },
            fail: () => setVisible(true),
          });
        } catch { setVisible(true); }
      }, 100);
    } catch {
      // 基础库较低，直接弹
      setVisible(true);
    }

    return () => {
      try { (Taro as any).offNeedPrivacyAuthorization?.(handler); } catch { /* */ }
    };
  }, []);

  const handleAgree = async () => {
    try {
      // 平台级授权
      await new Promise<void>((resolve, reject) => {
        (Taro as any).requirePrivacyAuthorize?.({
          success: () => resolve(),
          fail: () => reject(new Error('用户拒绝')),
        });
      });
    } catch {
      // wx.requirePrivacyAuthorize 失败时降级：允许进入（部分基础库版本不强制）
    }
    try {
      Taro.setStorageSync(PRIVACY_STORAGE_KEY, true);
    } catch { /* */ }
    setVisible(false);
  };

  const handleReject = () => {
    Taro.showModal({
      title: '提示',
      content: '隐私协议是使用本服务的前提条件，不同意将无法使用。您可以稍后在「设置」页面重新查看并同意。',
      confirmText: '我知道了',
      showCancel: false,
      success: () => {
        Taro.exitMiniProgram?.();
      },
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
   我们不会查看、分析或用于任何其他目的。

3. 相机和相册权限
   仅当您主动选择图片或保存图片时请求，不会在后台获取。

4. 本地存储
   用于保存登录状态（Token）和最近浏览记录，
   仅本地保存，不会上传至服务器。

{'     '}

详细条款请查阅：《用户协议》和《隐私政策》
          </Text>
        </View>
        <View className="privacy-links">
          <Text
            className="privacy-link"
            onClick={() => Taro.setClipboardData({
              data: 'https://www.dolmo.top/privacy',
            })}
          >
            查看隐私政策
          </Text>
          <Text className="privacy-link-sep">|</Text>
          <Text
            className="privacy-link"
            onClick={() => Taro.setClipboardData({
              data: 'https://www.dolmo.top/terms',
            })}
          >
            查看用户协议
          </Text>
        </View>
        <View className="privacy-buttons">
          <View className="privacy-btn privacy-btn-reject" onClick={handleReject}>
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
