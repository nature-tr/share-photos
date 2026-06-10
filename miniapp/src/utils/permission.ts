/**
 * 请求相册保存权限
 *
 * 调用 wx.saveImageToPhotosAlbum 前必须确保用户已授权 scope.writePhotosAlbum。
 * 否则直接调用会在 iOS 上静默失败，在 Android 上弹出系统授权弹窗但用户体验差。
 *
 * 流程：
 *   1. wx.getSetting 检查 scope.writePhotosAlbum 状态
 *   2. 未授权 → wx.authorize 弹出系统授权框
 *   3. 已拒绝 → 弹窗引导用户去设置页手动开启
 *
 * 返回 true 表示权限可用，false 表示用户拒绝。
 */

import Taro from '@tarojs/taro';

export async function requestAlbumPermission(): Promise<boolean> {
  try {
    const setting = await Taro.getSetting();
    const auth = setting.authSetting['scope.writePhotosAlbum'];

    // 已授权
    if (auth === true) return true;

    // 从未请求过 → 弹系统授权框
    if (auth === undefined) {
      try {
        await Taro.authorize({ scope: 'scope.writePhotosAlbum' });
        return true;
      } catch {
        // 用户点了拒绝
        return showSettingsGuide();
      }
    }

    // 之前拒绝过 → 直接引导去设置页
    return showSettingsGuide();
  } catch {
    // getSetting 失败时降级：直接尝试保存（小程序会弹系统框）
    return true;
  }
}

async function showSettingsGuide(): Promise<boolean> {
  try {
    const res = await Taro.showModal({
      title: '需要相册权限',
      content: '保存图片到相册需要您授权「写入相册」权限。是否前往设置开启？',
      confirmText: '去设置',
      cancelText: '暂不',
    });
    if (res.confirm) {
      await Taro.openSetting();
      // 从设置页返回后重新检查
      const setting = await Taro.getSetting();
      return setting.authSetting['scope.writePhotosAlbum'] === true;
    }
    return false;
  } catch {
    return false;
  }
}
