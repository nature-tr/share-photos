export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/scan/index',
    'pages/auth/login/index',
    'pages/auth/register/index',
    'pages/me/shares/index',
    'pages/me/new/index',
    'pages/me/settings/index',
    'pages/viewer/detail/index',
  ],
  window: {
    backgroundTextStyle: 'dark',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: '格子橱窗',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f5f7fa',
  },
});
