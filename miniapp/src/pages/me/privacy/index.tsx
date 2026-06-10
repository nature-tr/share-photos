import Taro from '@tarojs/taro';
import { View, Text, ScrollView } from '@tarojs/components';
import './index.scss';

export default function PrivacyPage() {
  return (
    <ScrollView className="page" scrollY enhanced showScrollbar={false}>
      <View className="legal-card">
        <Text className="legal-title">隐私保护指引</Text>
        <Text className="legal-updated">最后更新：2026 年 6 月</Text>

        <Text className="legal-section-title">1. 信息收集</Text>
        <Text className="legal-body">
          为提供相册分享服务，我们可能收集以下信息：{'\n\n'}
          1.1 账号信息（邮箱、昵称）：用于创建和管理您的账户，仅存储在我们的服务器上。{'\n\n'}
          1.2 您上传的图片：仅存储在您指定的分享中，按您设置的有效期到期自动删除。{'\n\n'}
          1.3 本地存储数据（Token、浏览记录）：仅保存在您的设备上，不上传至服务器。
        </Text>

        <Text className="legal-section-title">2. 信息使用</Text>
        <Text className="legal-body">
          2.1 我们仅将您的信息用于提供和维护本服务。{'\n\n'}
          2.2 我们不会将您的个人信息分享给任何第三方，除非法律法规要求。{'\n\n'}
          2.3 我们不会查看、分析或用于任何与分享相册无关的目的。
        </Text>

        <Text className="legal-section-title">3. 权限申请</Text>
        <Text className="legal-body">
          3.1 相册权限：仅当您主动点击「保存图片到相册」时请求，用于将图片写入您的手机相册。{'\n\n'}
          3.2 相机权限：仅当您主动选择图片时使用。{'\n\n'}
          3.3 我们不会在后台获取任何权限。
        </Text>

        <Text className="legal-section-title">4. 数据存储与删除</Text>
        <Text className="legal-body">
          4.1 您的账号信息将一直保留，直到您联系我们删除。{'\n\n'}
          4.2 您上传的所有图片在分享到期后自动从服务器删除，不可恢复。{'\n\n'}
          4.3 您可以通过「我的分享」手动结束分享，将立即删除所有相关图片。{'\n\n'}
          4.4 本地浏览记录可通过「设置」页面清除。
        </Text>

        <Text className="legal-section-title">5. 未成年人保护</Text>
        <Text className="legal-body">
          我们非常重视对未成年人个人信息的保护。若您是 14 周岁以下的未成年人，在使用本服务前应取得您监护人的同意。
        </Text>

        <Text className="legal-section-title">6. 联系我们</Text>
        <Text className="legal-body">
          如有任何疑问，请联系我们：{'\n'}
          邮箱：tianrandolmo@gmail.com{'\n'}
          官网：https://www.dolmo.top
        </Text>
      </View>
    </ScrollView>
  );
}
