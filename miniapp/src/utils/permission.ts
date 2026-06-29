/**
 * 权限请求工具（wx.authorize 体系）
 *
 * 写入：scope.writePhotosAlbum → wx.authorize → 被拒则引导 openSetting
 * 读取：无对应 scope，通过 wx.openPrivacyContract 打开隐私授权页，
 *       用户同意后 chooseMedia 即可正常工作
 */

import Taro from '@tarojs/taro';

/* ───── 写入相册（保存图片） ───── */

export async function requestWriteAlbumPermission(): Promise<boolean> {
  try {
    const setting = await Taro.getSetting();
    const auth = setting.authSetting['scope.writePhotosAlbum'];

    if (auth === true) return true;

    // 从未请求过 → 弹系统授权框
    if (auth === undefined) {
      try {
        await Taro.authorize({ scope: 'scope.writePhotosAlbum' });
        return true;
      } catch {
        return guideToSetting('写入相册');
      }
    }

    // 之前被拒 → 引导去设置页手动开
    return guideToSetting('写入相册');
  } catch {
    return true; // 降级
  }
}

/* ───── 读取相册（选图上传） ───── */

export async function requestReadAlbumPermission(): Promise<boolean> {
  // 先试一次 chooseMedia，如果已有授权会直接成功
  try {
    await Taro.chooseMedia({ count: 1, mediaType: ['image'], sizeType: ['compressed'] });
    return true;
  } catch (err: any) {
    const msg: string = err?.errMsg ?? '';

    // 用户主动取消 → 不需要授权
    if (msg.indexOf('cancel') >= 0) return false;

    // scope 未被隐私指引声明 → 打开隐私协议页让用户同意
    if (msg.indexOf('scope') >= 0 || msg.indexOf('privacy') >= 0 || msg.indexOf('declared') >= 0) {
      try {
        await Taro.openPrivacyContract?.({});
      } catch { /* 部分版本不支持 openPrivacyContract */ }
      return false; // 用户需同意后重试
    }

    return false;
  }
}

/* ───── 通用：拒绝后引导设置页 ───── */

async function guideToSetting(label: string): Promise<boolean> {
  try {
    const res = await Taro.showModal({
      title: `需要${label}权限`,
      content: `请前往设置页面，找到「${label}」并将其开启。`,
      confirmText: '前往设置',
      cancelText: '暂不',
    });
    if (!res.confirm) return false;
    await Taro.openSetting();
    // openSetting 返回后权限可能未同步，轮询检查
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 300));
      try {
        const s = await Taro.getSetting();
        if (s.authSetting['scope.writePhotosAlbum'] === true) return true;
      } catch { /* */ }
    }
    return false;
  } catch {
    return false;
  }
}
