import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/pages/home/HomePage.vue'),
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/auth/LoginPage.vue'),
    meta: { guestOnly: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/pages/auth/RegisterPage.vue'),
    meta: { guestOnly: true },
  },
  {
    path: '/me/shares',
    name: 'my-shares',
    component: () => import('@/pages/me/MySharesPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/me/shares/new',
    name: 'new-share',
    component: () => import('@/pages/me/NewSharePage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/v/:code',
    name: 'viewer',
    component: () => import('@/pages/viewer/ViewerPage.vue'),
    props: true,
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/pages/NotFoundPage.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();

  // 首次进入应用尝试恢复
  if (!authStore.restored) {
    await authStore.tryRestore();
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return { name: 'my-shares' };
  }
  return true;
});

export default router;
