import type { Config } from '@react-router/dev/config';

/**
 * 产物是纯静态站：`build/client` 既部署到静态托管，也作为桌面端 Tauri 的 frontendDist。
 * 路由全部是静态路径（见 `app/routes.ts`），构建时逐个预渲染成 HTML；
 * 不在列表里的地址由 SPA 回退页在浏览器里渲染。需要运行期服务端的写法（`loader`
 * 落在未预渲染的路由、`action`）在构建期报错。
 */
export default {
  ssr: false,
  prerender: ({ getStaticPaths }) => getStaticPaths(),
} satisfies Config;
