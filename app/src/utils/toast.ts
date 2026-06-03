import { Alert, Platform, ToastAndroid } from 'react-native';

/**
 * 跨平台 toast：iOS 用 Alert，Android 用 ToastAndroid。
 * 简单够用，避免引入第三方 toast 库。
 */
export function toast(msg: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  } else {
    Alert.alert(msg);
  }
}

export function toastLong(msg: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(msg, ToastAndroid.LONG);
  } else {
    Alert.alert(msg);
  }
}
