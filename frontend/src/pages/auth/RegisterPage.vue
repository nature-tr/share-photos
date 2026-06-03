<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { useAuthStore } from '@/stores/auth.store';
import { ApiException } from '@/api/client';

const router = useRouter();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const displayName = ref('');
const submitting = ref(false);

async function onSubmit() {
  if (!email.value || !password.value) {
    MessagePlugin.warning('请填写完整');
    return;
  }
  if (password.value.length < 8) {
    MessagePlugin.warning('密码至少 8 位，且需含字母与数字');
    return;
  }
  submitting.value = true;
  try {
    await authStore.register({
      email: email.value,
      password: password.value,
      displayName: displayName.value || undefined,
    });
    MessagePlugin.success('注册成功');
    router.push('/me/shares');
  } catch (err) {
    if (err instanceof ApiException) {
      MessagePlugin.error(err.message);
    } else {
      MessagePlugin.error('注册失败');
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="card">
      <div class="brand">
        <span class="logo-icon">
          <span class="i-tdesign:image-1 text-22px"></span>
        </span>
      </div>
      <h2>创建账号</h2>
      <p class="muted">开始你的相册分享之旅</p>

      <div class="form">
        <div class="field">
          <label>邮箱</label>
          <t-input v-model="email" placeholder="you@example.com" size="large" @enter="onSubmit" />
        </div>
        <div class="field">
          <label>
            密码
            <span class="hint-inline">至少 8 位，含字母与数字</span>
          </label>
          <t-input v-model="password" placeholder="••••••••" type="password" size="large" @enter="onSubmit" />
        </div>
        <div class="field">
          <label>
            昵称
            <span class="hint-inline">可选</span>
          </label>
          <t-input v-model="displayName" placeholder="你的称呼" size="large" @enter="onSubmit" />
        </div>
        <t-button theme="primary" size="large" block :loading="submitting" @click="onSubmit">
          注册
        </t-button>
      </div>

      <div class="hint">
        已有账号？
        <router-link to="/login" class="link">直接登录</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
}

.card {
  width: 100%;
  max-width: 420px;
  background: var(--surface);
  border-radius: var(--radius-xl);
  padding: 40px 36px 32px;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-light);
}

.brand {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.logo-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  box-shadow: 0 8px 20px rgba(139, 92, 246, 0.32);
}

.card h2 {
  margin: 0 0 6px;
  font-size: 24px;
  font-weight: 700;
  text-align: center;
  letter-spacing: -0.3px;
}

.muted {
  font-size: 14px;
  color: var(--text-3);
  text-align: center;
  margin: 0 0 28px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  display: flex;
  align-items: center;
  gap: 6px;
}

.hint-inline {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}

.hint {
  margin-top: 24px;
  font-size: 13px;
  color: var(--text-3);
  text-align: center;
}

.link {
  color: var(--primary);
  font-weight: 500;
}

.link:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .auth-page {
    align-items: flex-start;
    padding: 40px 18px;
    padding-left: max(18px, var(--safe-left));
    padding-right: max(18px, var(--safe-right));
  }
  .card {
    padding: 32px 22px 24px;
    border-radius: var(--radius-xl);
  }
  .logo-icon {
    width: 52px;
    height: 52px;
    font-size: 26px;
  }
  .card h2 {
    font-size: 22px;
  }
  .muted {
    font-size: 13px;
    margin-bottom: 24px;
  }
  .form {
    gap: 14px;
  }
}
</style>
