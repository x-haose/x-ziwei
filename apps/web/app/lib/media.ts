import { useSyncExternalStore } from 'react';

/**
 * 媒体查询是否成立，随窗口变化更新。预渲染与水合时按不成立处理，水合后换成真实值；
 * 只用于首帧之后才出现的界面（如弹层的形态），首帧的版式一律交给 CSS 媒体查询。
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}

/** 是否已经水合：预渲染与水合那一次渲染为 false，之后为 true。只依赖浏览器状态的内容据此推迟到水合之后。 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
