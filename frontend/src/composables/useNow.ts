import { ref, onUnmounted } from 'vue';

/**
 * 局部 1Hz 时间源（默认 1s 刷新一次）。
 *
 * 取代页面里手写 `const tick = ref(0); setInterval(() => tick.value++, 1000)` 的反模式：
 *  - 计时器集中管理，不会忘记清理
 *  - computed 直接依赖 now.value 即可，无需 `void tick.value` 这种 hack
 *
 * 用法：
 * ```ts
 * const now = useNow();
 * const remaining = computed(() => formatRemaining(album.value.expiresAt - now.value));
 * ```
 */
export function useNow(intervalMs = 1000) {
  const now = ref(Date.now());
  const timer = window.setInterval(() => {
    now.value = Date.now();
  }, intervalMs);
  onUnmounted(() => clearInterval(timer));
  return now;
}
