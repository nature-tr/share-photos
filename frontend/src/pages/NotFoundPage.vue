<script setup lang="ts">
import { useRouter } from 'vue-router';
const router = useRouter();
</script>

<template>
  <div class="not-found">
    <div class="error-code">404</div>
    <h2>页面不存在</h2>
    <p class="muted">你访问的页面可能已被删除或移动</p>
    <t-button theme="primary" size="large" @click="router.push('/')">
      <template #icon><span class="i-tdesign:home"></span></template>
      返回首页
    </t-button>
  </div>
</template>

<style scoped>
.not-found {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 64px 16px;
  text-align: center;
}

.error-code {
  font-size: 120px;
  font-weight: 800;
  letter-spacing: -4px;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1;
  margin-bottom: 8px;
}

.not-found h2 {
  font-size: 22px;
  font-weight: 600;
  margin: 0;
  color: var(--text-1);
}

.muted {
  color: var(--text-3);
  margin: 0 0 16px;
  font-size: 14px;
}

@media (max-width: 768px) {
  .error-code {
    font-size: 88px;
  }
  .not-found h2 {
    font-size: 18px;
  }
}
</style>
