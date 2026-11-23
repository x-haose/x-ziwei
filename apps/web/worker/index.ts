import { langOfPath } from '../app/i18n/lang';
import { hasExtension, markdownPath, pickLang } from './negotiate';

interface Env {
  ASSETS: Fetcher;
}

/**
 * 站点的 Worker。静态资源（`build/client`）的路由、`_headers`、`_redirects`、404 页都由 Workers 静态资源处理，
 * 这里只补两件静态文件做不到的事（`wrangler.jsonc` 的 `run_worker_first` 让带哈希的资源不经这里）：
 * - 语言段之下：`.mdx` 后缀与 `Accept: text/markdown` 改取该页的 Markdown 原文（见 `markdownPath`）。
 *   页面地址的响应带 `Vary: Accept`，HTML 与原文不会被缓存混用。
 * - 不带语言段、又没有对应文件的地址（如 `/install`）：按 `Accept-Language` 选语言，
 *   该语言下有这个地址就 302 过去，没有就照常返回 404 页。
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (langOfPath(url.pathname)) return withLang(request, env);
    const res = await env.ASSETS.fetch(request);
    if (res.status !== 404) return res;
    const target = `/${pickLang(request.headers.get('Accept-Language'))}${url.pathname}`;
    const probe = await withLang(new Request(new URL(target, url), request), env);
    await probe.body?.cancel();
    if (probe.status >= 400) return res;
    await res.body?.cancel();
    return new Response(null, { status: 302, headers: { Location: `${target}${url.search}`, Vary: 'Accept-Language' } });
  },
} satisfies ExportedHandler<Env>;

/** 语言段之下的请求：按需改取 Markdown 原文，其余原样交给静态资源。 */
async function withLang(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const page = !hasExtension(url.pathname);
  const md = markdownPath(url.pathname, request);
  if (md) {
    const res = await env.ASSETS.fetch(new Request(new URL(md, url), request));
    if (res.ok) return page ? varyAccept(res) : res;
    await res.body?.cancel();
  }
  const res = await env.ASSETS.fetch(request);
  return page ? varyAccept(res) : res;
}

function varyAccept(res: Response): Response {
  const out = new Response(res.body, res);
  out.headers.append('Vary', 'Accept');
  return out;
}
