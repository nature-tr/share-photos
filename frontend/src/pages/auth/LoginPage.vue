<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { useAuthStore } from '@/stores/auth.store';
import { ApiException } from '@/api/client';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const submitting = ref(false);

async function onSubmit() {
  if (!email.value || !password.value) {
    MessagePlugin.warning('请填写完整');
    return;
  }
  submitting.value = true;
  try {
    await authStore.login({ email: email.value, password: password.value });
    MessagePlugin.success('登录成功');
    const redirect = (route.query.redirect as string) || '/me/shares';
    router.push(redirect);
  } catch (err) {
    if (err instanceof ApiException) {
      MessagePlugin.error(err.message);
    } else {
      MessagePlugin.error('登录失败');
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
      <h2>欢迎回来</h2>
      <p class="muted">登录后管理你的分享相册</p>

      <div class="form">
        <div class="field">
          <label>邮箱</label>
          <t-input
            v-model="email"
            placeholder="you@example.com"
            size="large"
            @keyup.enter="onSubmit"
          />
        </div>
        <div class="field">
          <label>密码</label>
          <t-input
            v-model="password"
            placeholder="••••••••"
            type="password"
            size="large"
            @keyup.enter="onSubmit"
          />
        </div>
        <t-button theme="primary" size="large" block :loading="submitting" @click="onSubmit">
          登录
        </t-button>
      </div>

      <div class="hint">
        没有账号？
        <router-link to="/register" class="link">立即注册</router-link>
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
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3);
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
