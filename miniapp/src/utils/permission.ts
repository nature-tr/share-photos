/**
 * 权限请求工具
 *
 * 调用 wx.chooseMedia / wx.saveImageToPhotosAlbum 前必须确保：
 *   1. 微信管理后台「用户隐私保护指引」已声明对应权限
 *   2. 用户已通过 wx.authorize 或系统弹窗授权
 *
 * 常见失败原因：
 *   - 管理后台未声明「相册（仅读取）」→ chooseMedia 返回空
 *   - 用户之前点过拒绝 → wx.authorize 直接 fail，不会再次弹窗
 *   - 用户从 openSetting 返回后权限仍未开（iOS上某些版本的 bug）
 */

import Taro from '@tarojs/taro';

/* ───── 写入相册 ───── */

export async function requestAlbumPermission(): Promise<boolean> {
  try {
    const setting = await Taro.getSetting();
    const auth = setting.authSetting['scope.writePhotosAlbum'];

    if (auth === true) return true;

    if (auth === undefined) {
      try {
        await Taro.authorize({ scope: 'scope.writePhotosAlbum' });
        return true;
      } catch {
        return showSettingsGuide('写入相册', 'scope.writePhotosAlbum');
      }
    }

    return showSettingsGuide('写入相册', 'scope.writePhotosAlbum');
  } catch {
    // getSetting 失败时降级：直接尝试（系统会弹框）
    return true;
  }
}

/* ───── 选图 / 相册读取 ─────
 * 注意：小程序没有 scope.xxx 对应"读取相册"，
 * 权限完全由平台隐私声明控制。这里的作用是：
 *   1. 提示用户检查隐私声明配置
 *   2. 若 chooseMedia 返回值空，引导排查
 */

export async function ensureAlbumReadPermission(): Promise<boolean> {
  // chooseMedia 不需要 wx.authorize，权限由隐私声明控制
  // 这里只做一个前置检查：看之前是否成功过
  const key = 'album_read_ok_v1';
  try {
    const ok = Taro.getStorageSync(key);
    if (ok) return true;
  } catch { /* */ }

  // 直接尝试调一次简单操作来触发平台授权
  try {
    await Taro.chooseMedia({ count: 1, mediaType: ['image'], sizeType: ['compressed'] });
    try { Taro.setStorageSync(key, true); } catch { /* */ }
    return true;
  } catch (err: any) {
    const msg = err?.errMsg ?? '';
    if (msg.indexOf('cancel') >= 0) return false;  // 用户主动取消，不算失败
    if (msg.indexOf('fail') >= 0) {
      Taro.showToast({ title: '选图失败，请检查隐私设置', icon: 'none', duration: 2000 });
    }
    return false;
  }
}

/* ───── 通用：拒绝后引导设置页 ───── */

async function showSettingsGuide(permName: string, scope: string): Promise<boolean> {
  try {
    const res = await Taro.showModal({
      title: `需要${permName}权限`,
      content: `保存图片到相册需要您授权「${permName}」权限。\n\n请前往设置页面，找到「${permName}」并将其开启。`,
      confirmText: '前往设置',
      cancelText: '暂不',
    });
    if (!res.confirm) return false;

    await Taro.openSetting();

    // 从设置返回后用轮询重试检查（openSetting 返回后权限状态可能未同步）
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 300));
      try {
        const s = await Taro.getSetting();
        if (s.authSetting[scope] === true) return true;
      } catch { /* */ }
    }
    return false;
  } catch {
    return false;
  }
}
