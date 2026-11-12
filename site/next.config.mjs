import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** x-iztro 文档站。本域名上 `/{lang}/docs/*` 原是它的页面，现在在那边。 */
const LIBRARY_DOCS_URL = 'https://x-iztro.x-haose.com';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  /** 不自动生成 AGENTS.md / CLAUDE.md，本仓库的约定文件由项目自己维护。 */
  agentRules: false,
  /**
   * 排盘库文档搬到了自己的域名，旧地址永久跳转过去，路径不变。
   * 例外是原来的 MCP 说明页：它讲的是本服务，内容现在在本站的安装页。
   */
  async redirects() {
    return [
      {
        source: '/:lang(zh|en)/docs/guide/mcp',
        destination: '/:lang/install',
        permanent: true,
      },
      {
        source: '/:lang(zh|en)/docs',
        destination: `${LIBRARY_DOCS_URL}/:lang/docs`,
        permanent: true,
      },
      {
        source: '/:lang(zh|en)/docs/:path*',
        destination: `${LIBRARY_DOCS_URL}/:lang/docs/:path*`,
        permanent: true,
      },
    ];
  },
  /**
   * 任意内容页追加 `.md` 或 `.mdx` 即得到该页的 Markdown 原文，
   * 供页面上的复制按钮与外部 AI 代理直接抓取。
   * 代理若不知道这个约定，也可以在请求页面时把 `Accept` 设成
   * `text/markdown`，由 proxy.ts 的内容协商导向同一处。
   */
  async rewrites() {
    return [
      {
        source: '/:lang(zh|en)/:path*.md',
        destination: '/llms.mdx/:lang/:path*',
      },
      {
        source: '/:lang(zh|en)/:path*.mdx',
        destination: '/llms.mdx/:lang/:path*',
      },
    ];
  },
};

export default withMDX(config);
