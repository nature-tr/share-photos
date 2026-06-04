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
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#2563eb',
    navigationBarTitleText: 'Dolmo Photo',
    navigationBarTextStyle: 'white',
    backgroundColor: '#f5f7fa',
  },
  tabBar: {
    color: '#999',
    selectedColor: '#2563eb',
    backgroundColor: '#fff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: '',
        selectedIconPath: '',
      },
      {
        pagePath: 'pages/me/shares/index',
        text: '我的',
        iconPath: '',
        selectedIconPath: '',
      },
    ],
  },
});
