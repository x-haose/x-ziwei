import { createI18nMiddleware } from 'fumadocs-core/i18n/middleware';
import { isMarkdownPreferred, rewritePath } from 'fumadocs-core/negotiation';
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { i18n } from '@/lib/i18n';

const i18nMiddleware = createI18nMiddleware(i18n);

/** 内容页路径 → 该页 Markdown 原文端点。首页不是内容页，没有 Markdown 形态。 */
const toMarkdown = rewritePath('/:lang/*path', '/llms.mdx/:lang/*path');

/**
 * 请求入口。
 *
 * AI 代理通常不知道「URL 追加 .md」这个约定，但会在 `Accept` 里声明
 * 更想要 Markdown。这里据此把内容页请求导向 Markdown 原文端点，
 * 让代理拿到几 KB 的正文而不是几十 KB 的整页 HTML。
 *
 * 两种方式可以同时出现（`.md` 结尾且 `Accept: text/markdown`）。
 * 中间件跑在 next.config 的 rewrite 之前，此时 `.md` / `.mdx` 后缀还在路径上，
 * 直接改写会把后缀带进 slug 而查不到页面，故先剥掉再改写。
 *
 * 其余请求交给语言协商中间件。
 */
export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (isMarkdownPreferred(request)) {
    const path = request.nextUrl.pathname.replace(/\.mdx?$/, '');
    const rewritten = toMarkdown.rewrite(path);
    if (rewritten) return NextResponse.rewrite(new URL(rewritten, request.url));
  }

  return i18nMiddleware(request, event);
}

export const config = {
  /**
   * 跳过内部资源与带扩展名的路径。
   *
   * `_next` 与 `api` 是框架内部路由；`llms.mdx` 是单页 Markdown 的内部
   * 重写目标，不该再被语言协商重定向到 `/zh/...`。
   *
   * 末段带扩展名的路径同样跳过：`robots.txt`、`sitemap.xml`、`llms.txt`、
   * `llms-full.txt` 与 `public/` 下的静态文件都是按固定路径取用的，
   * 加语言前缀就取不到了。`.md` / `.mdx` 是例外——内容页追加后缀取原文时
   * 仍要走上面的协商与语言前缀补全。
   */
  matcher: ['/((?!api|_next|llms\\.mdx|.*\\.(?!mdx?$)[^/.]+$).*)'],
};
