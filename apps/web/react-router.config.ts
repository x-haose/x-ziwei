import path from 'node:path';
import type { Config } from '@react-router/dev/config';
import { siteOf } from './app/lib/deploy.ts';
import { postBuild } from './scripts/deploy/post-build.ts';

/**
 * 产物是纯静态站：`build/client` 既部署到静态托管，也作为桌面端 Tauri 的 frontendDist。
 * 路由全部是静态路径（见 `app/routes.ts`），构建时逐个预渲染成 HTML；
 * 不在列表里的地址由 SPA 回退页（部署时改名为 `404.html`）在浏览器里渲染。需要运行期服务端的写法（`loader`
 * 落在未预渲染的路由、`action`）在构建期报错。构建结束后按部署目标补齐部署用的文件（见 `scripts/deploy/post-build.ts`）。
 */
export default {
  ssr: false,
  prerender: ({ getStaticPaths }) => getStaticPaths(),
  buildEnd: ({ reactRouterConfig }) =>
    postBuild({ clientDir: path.join(reactRouterConfig.buildDirectory, 'client'), site: siteOf(process.env.XZW_SITE) }),
} satisfies Config;
