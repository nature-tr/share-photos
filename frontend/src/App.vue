<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter, RouterView, RouterLink } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/stores/auth.store';
import { MessagePlugin } from 'tdesign-vue-next';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { user, isAuthenticated } = storeToRefs(authStore);

// 登录态恢复在路由守卫里完成（router/index.ts 的 beforeEach），无需在此重复。

const showHeader = computed(() => route.name !== 'viewer');

async function handleLogout() {
  await authStore.logout();
  MessagePlugin.success('已退出登录');
  router.push({ name: 'home' });
}
</script>

<template>
  <div class="app-root">
    <header v-if="showHeader" class="app-header">
      <div class="container">
        <RouterLink to="/" class="logo">
          <span class="logo-icon">
            <span class="i-tdesign:image-1 text-22px"></span>
          </span>
          <span class="logo-text">Dolmo Photo</span>
        </RouterLink>
        <nav class="nav">
          <template v-if="isAuthenticated && user">
            <RouterLink to="/me/shares/new" class="nav-item">
              <span class="i-tdesign:add nav-icon"></span>
              <span class="nav-label">新建分享</span>
            </RouterLink>
            <RouterLink to="/me/shares" class="nav-item">
              <span class="i-tdesign:view-list nav-icon"></span>
              <span class="nav-label">我的分享</span>
            </RouterLink>
            <div class="user-chip">
              <span class="avatar">{{ (user.displayName || user.email || '?').charAt(0).toUpperCase() }}</span>
              <span class="user-name">{{ user.displayName || user.email }}</span>
              <button class="logout-btn" @click="handleLogout" title="退出登录">
                <span class="i-tdesign:logout text-16px"></span>
              </button>
            </div>
          </template>
          <template v-else>
            <RouterLink to="/login" class="nav-item">登录</RouterLink>
            <RouterLink to="/register" class="nav-item primary">
              <span>注册</span>
            </RouterLink>
          </template>
        </nav>
      </div>
    </header>

    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-root {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: saturate(180%) blur(14px);
  -webkit-backdrop-filter: saturate(180%) blur(14px);
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  padding-top: var(--safe-top);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  font-weight: 600;
  font-size: 15px;
  color: var(--text-1);
}

.logo-icon {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.32);
}

.logo-text {
  letter-spacing: 0.2px;
}

.nav {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: var(--radius-md);
  color: var(--text-2);
  font-size: 14px;
  font-weight: 500;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.nav-item:hover {
  background: var(--surface-hover);
  color: var(--text-1);
}

.nav-item.router-link-active {
  background: var(--primary-soft);
  color: var(--primary);
}

.nav-item.primary {
  background: var(--primary);
  color: #fff;
}

.nav-item.primary:hover {
  background: var(--primary-hover);
  color: #fff;
}

.nav-icon {
  font-size: 16px;
}

.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 4px 4px 4px;
  background: var(--surface-hover);
  border-radius: var(--radius-full);
  margin-left: 6px;
}

.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-name {
  font-size: 13px;
  color: var(--text-2);
  max-width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logout-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-3);
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.logout-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

@media (max-width: 768px) {
  .container {
    padding: 0 14px;
    padding-left: max(14px, var(--safe-left));
    padding-right: max(14px, var(--safe-right));
    height: 54px;
  }
  .logo {
    gap: 8px;
  }
  .logo-icon {
    width: 30px;
    height: 30px;
    border-radius: 8px;
  }
  .logo-text {
    display: inline;
    font-size: 14px;
  }
  .nav {
    gap: 2px;
  }
  .nav-label {
    display: none;
  }
  .nav-item {
    width: 38px;
    height: 38px;
    padding: 0;
    justify-content: center;
    border-radius: var(--radius-md);
  }
  .nav-item.primary {
    width: auto;
    padding: 0 14px;
    height: 38px;
    font-size: 13px;
  }
  .nav-icon {
    font-size: 18px;
  }
  .user-chip {
    padding: 3px;
    margin-left: 2px;
  }
  .avatar {
    width: 30px;
    height: 30px;
    font-size: 12px;
  }
  .user-name {
    display: none;
  }
  .logout-btn {
    width: 28px;
    height: 28px;
  }
}

/* 极小屏：只显示图标 logo，不显示文字 */
@media (max-width: 380px) {
  .container {
    gap: 8px;
  }
  .logo-text {
    display: none;
  }
}
</style>
