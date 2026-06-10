import { View, Text, ScrollView } from '@tarojs/components';
import './index.scss';

export default function TermsPage() {
  return (
    <ScrollView className="page" scrollY enhanced showScrollbar={false}>
      <View className="legal-card">
        <Text className="legal-title">用户协议</Text>
        <Text className="legal-updated">最后更新：2026 年 6 月</Text>

        <Text className="legal-section-title">1. 服务说明</Text>
        <Text className="legal-body">
          格子橱窗是一个限时相册分享工具（以下简称「本服务」）。{'\n\n'}
          您可以通过本服务创建限时相册、上传图片、生成分享链接/二维码，并让他人凭分享码查看和下载图片。
        </Text>

        <Text className="legal-section-title">2. 账号</Text>
        <Text className="legal-body">
          2.1 您需要注册账号才能使用本服务。您提供的邮箱和昵称将用于身份识别。{'\n\n'}
          2.2 您对账号下的所有操作负责。请妥善保管您的密码。{'\n\n'}
          2.3 如发现账号异常，请立即联系我们。
        </Text>

        <Text className="legal-section-title">3. 用户行为</Text>
        <Text className="legal-body">
          3.1 您不得上传违法、侵权、色情、暴力等违反法律法规的内容。{'\n\n'}
          3.2 您对所上传图片的内容和版权负责。{'\n\n'}
          3.3 我们有权在发现违规内容时删除相关内容并终止您的账号。
        </Text>

        <Text className="legal-section-title">4. 免责声明</Text>
        <Text className="legal-body">
          4.1 本服务按「现状」提供，不提供任何明示或暗示的保证。{'\n\n'}
          4.2 我们不对因使用本服务导致的任何直接或间接损失承担责任。{'\n\n'}
          4.3 图片到期自动删除后不可恢复，请提前备份重要图片。
        </Text>

        <Text className="legal-section-title">5. 协议修改</Text>
        <Text className="legal-body">
          我们可能不时修改本协议。修改后的协议将在页面上公布。继续使用本服务即表示您接受修改后的协议。
        </Text>

        <Text className="legal-section-title">6. 联系我们</Text>
        <Text className="legal-body">
          邮箱：tianrandolmo@gmail.com{'\n'}
          官网：https://www.dolmo.top
        </Text>
      </View>
    </ScrollView>
  );
}
