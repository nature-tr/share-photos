export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/scan/index',
    'pages/auth/login/index',
    'pages/auth/register/index',
    'pages/me/shares/index',
    'pages/me/new/index',
    'pages/me/settings/index',
    'pages/me/privacy/index',
    'pages/me/terms/index',
    'pages/viewer/detail/index',
  ],
  window: {
    backgroundTextStyle: 'dark',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: '格子橱窗',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f5f7fa',
  },
  __usePrivacyCheck__: true,
  privacy: {
    title: '隐私保护指引',
    content:
      '格子橱窗尊重并保护您的隐私。为提供相册分享服务，我们可能收集和处理以下信息：\n\n' +
      '1. 账号信息（邮箱、昵称）：用于创建和管理您的账户；\n' +
      '2. 您上传的图片：仅存储在您指定的分享中，到期自动删除；\n' +
      '3. 相机和相册权限：仅当您主动选择图片或保存图片时请求；\n' +
      '4. 本地存储：用于保存登录状态和浏览记录，不上传至服务器。\n\n' +
      '我们不会将您的个人信息用于任何与本服务无关的目的。',
    organizationName: '格子橱窗团队',
    policyUrl: 'https://www.dolmo.top/privacy',
    organizationUrl: 'https://www.dolmo.top',
  },
});
