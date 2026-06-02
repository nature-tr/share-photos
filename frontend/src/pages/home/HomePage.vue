<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { SHARE_CODE_REGEX } from '@photo/shared';

const router = useRouter();
const code = ref('');
const submitting = ref(false);

function onSubmit() {
  const c = code.value.trim().toUpperCase();
  if (!SHARE_CODE_REGEX.test(c)) {
    MessagePlugin.warning('分享码格式不正确（8 位字母数字，去除易混淆字符）');
    return;
  }
  submitting.value = true;
  router.push({ name: 'viewer', params: { code: c } });
}

const features = [
  {
    icon: 'i-tdesign:upload',
    title: '上传分享',
    desc: '选好图片与有效期，一键生成分享码',
    gradient: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)',
  },
  {
    icon: 'i-tdesign:image-search',
    title: '凭码即看',
    desc: '查看者无需注册，缩略图懒加载',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)',
  },
  {
    icon: 'i-tdesign:download',
    title: '原图下载',
    desc: '逐张存到相册，或一键打包 zip',
    gradient: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
  },
  {
    icon: 'i-tdesign:time',
    title: '到期自清',
    desc: '过期或主动结束，资源自动释放',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
  },
];
</script>

<template>
  <div class="home">
    <div class="hero">
      <div class="badge">
        <span class="dot"></span>
        无损画质 · 限时分享
      </div>
      <h1 class="title">
        分享你的<span class="grad">珍贵瞬间</span>
      </h1>
      <p class="subtitle">输入分享码即可查看，到期自动清理，无需注册</p>

      <div class="entry-card">
        <div class="entry-label">已有分享码？</div>
        <div class="entry">
          <t-input
            v-model="code"
            placeholder="K7M2X9PQ"
            size="large"
            maxlength="8"
            class="code-input"
            @keyup.enter="onSubmit"
          />
          <t-button theme="primary" size="large" :loading="submitting" @click="onSubmit">
            查看相册
          </t-button>
        </div>
        <div class="entry-hint">8 位字母数字组合，区分大小写</div>
      </div>

      <div class="features">
        <div
          v-for="(f, i) in features"
          :key="i"
          class="feature"
          :style="{ '--card-grad': f.gradient } as Record<string, string>"
        >
          <div class="feature-icon">
            <span :class="f.icon"></span>
          </div>
          <h3>{{ f.title }}</h3>
          <p>{{ f.desc }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 20px 64px;
}

.hero {
  max-width: 920px;
  width: 100%;
  text-align: center;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  font-size: 13px;
  color: var(--text-2);
  box-shadow: var(--shadow-xs);
  margin-bottom: 24px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.18);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.title {
  font-size: 48px;
  font-weight: 700;
  margin: 0 0 16px;
  color: var(--text-1);
  letter-spacing: -0.5px;
  line-height: 1.15;
}

.grad {
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  font-size: 17px;
  color: var(--text-2);
  margin: 0 0 40px;
}

.entry-card {
  max-width: 540px;
  margin: 0 auto 64px;
  background: var(--surface);
  border-radius: var(--radius-xl);
  padding: 24px;
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-light);
  text-align: left;
}

.entry-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  margin-bottom: 10px;
}

.entry {
  display: flex;
  gap: 10px;
}

.code-input {
  flex: 1;
}

.code-input :deep(.t-input) {
  letter-spacing: 6px;
  font-family: 'JetBrains Mono', 'SF Mono', Monaco, Consolas, monospace;
  text-transform: uppercase;
  font-weight: 600;
  font-size: 18px;
}

.entry-hint {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 10px;
  text-align: center;
}

.features {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.feature {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 24px 20px;
  text-align: left;
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-xs);
  transition: transform var(--transition), box-shadow var(--transition);
  position: relative;
  overflow: hidden;
}

.feature::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--card-grad);
  opacity: 0;
  transition: opacity var(--transition);
}

.feature:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-md);
}

.feature-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--card-grad);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  margin-bottom: 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.feature h3 {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 6px;
  color: var(--text-1);
}

.feature p {
  font-size: 13px;
  color: var(--text-2);
  margin: 0;
  line-height: 1.55;
}

@media (max-width: 768px) {
  .home {
    padding: 32px 18px 48px;
    padding-left: max(18px, var(--safe-left));
    padding-right: max(18px, var(--safe-right));
    align-items: flex-start;
  }
  .badge {
    margin-bottom: 18px;
    font-size: 12px;
    padding: 5px 12px;
  }
  .title {
    font-size: 34px;
    line-height: 1.2;
    letter-spacing: -0.4px;
    margin-bottom: 12px;
  }
  .subtitle {
    font-size: 15px;
    line-height: 1.55;
    margin-bottom: 28px;
    padding: 0 8px;
  }
  .entry-card {
    padding: 20px 18px;
    margin-bottom: 36px;
    border-radius: var(--radius-xl);
  }
  .entry {
    flex-direction: column;
    gap: 12px;
  }
  .code-input :deep(.t-input) {
    text-align: center;
    font-size: 20px;
    letter-spacing: 8px;
  }
  .features {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  .feature {
    padding: 18px 16px;
    border-radius: var(--radius-lg);
  }
  .feature-icon {
    width: 40px;
    height: 40px;
    border-radius: 11px;
    font-size: 20px;
    margin-bottom: 12px;
  }
  .feature h3 {
    font-size: 14px;
    margin-bottom: 4px;
  }
  .feature p {
    font-size: 12px;
    line-height: 1.5;
  }
}

@media (max-width: 380px) {
  .title {
    font-size: 28px;
  }
  .subtitle {
    font-size: 14px;
  }
}
</style>
