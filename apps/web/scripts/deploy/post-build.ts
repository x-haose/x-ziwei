import { createHash } from 'node:crypto';
import { readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Site } from '../../app/lib/deploy.ts';

/**
 * 构建之后、部署之前对 `build/client` 的处理（由 `react-router.config.ts` 的 `buildEnd` 调用）。
 * 产物按 Cloudflare Workers 静态资源的约定准备：`404.html`、`_headers`；`_redirects` 是 `public/` 里的静态文件。
 */
export async function postBuild({ clientDir, site }: { clientDir: string; site: Site }): Promise<void> {
  const files = await listFiles(clientDir);
  await dropResourceData(clientDir, files);
  await rename(path.join(clientDir, '__spa-fallback.html'), path.join(clientDir, '404.html'));
  for (const file of await listFiles(clientDir)) {
    if (!file.endsWith('.html')) continue;
    const full = path.join(clientDir, file);
    await writeFile(full, withCsp(await readFile(full, 'utf8')));
  }
  await writeFile(path.join(clientDir, '_headers'), headersFile(site));
}

/** 目录下全部文件的相对路径（`/` 分隔）。 */
async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries.filter((e) => e.isFile()).map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join('/'));
}

/**
 * 删掉资源路由的 `.data` 文件。React Router 8.5 预渲染带 loader 的资源路由（`.md`、`llms.txt` 等）时，
 * 除了文件本身，总会再按 `<路径>.data` 存一份单次请求格式的数据，没有开关可以不生成；
 * 这些数据只在前端路由里用 `<Link>`/`fetcher` 访问资源路由时才会被读取，本站对这些地址一律整页打开，用不到。
 * 判据：`X.data` 旁边有同名文件 `X`，即是资源路由的数据；页面路由的 `.data`（旁边是目录）不动。
 */
async function dropResourceData(dir: string, files: string[]): Promise<void> {
  const all = new Set(files);
  for (const f of files) {
    if (f.endsWith('.data') && all.has(f.slice(0, -'.data'.length))) await rm(path.join(dir, f));
  }
}

const sha256 = (text: string) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

/** 页面里内联的 `<script>`（不含带 `src` 的外链脚本）与 `<style>` 的原文。 */
export function inlineBlocks(html: string): { scripts: string[]; styles: string[] } {
  const scripts = [...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .filter((m) => !/\ssrc=/.test(m[1] ?? ''))
    .map((m) => m[2] ?? '');
  const styles = [...html.matchAll(/<style(\s[^>]*)?>([\s\S]*?)<\/style>/g)].map((m) => m[2] ?? '');
  return { scripts, styles };
}

/**
 * React Aria（react-aria 3.53）的按压交互在运行时往 `<head>` 插入的样式，内容固定。
 * 它不在预渲染的 HTML 里，按原文的哈希放行；升级后内容若变，端到端测试会因 CSP 违规而失败。
 */
const REACT_ARIA_PRESS_STYLE = '@layer {\n  [data-react-aria-pressable] {\n    touch-action: pan-x pan-y pinch-zoom;\n  }\n}';

/**
 * 一个页面的内容安全策略。内联脚本与样式逐段按 SHA-256 放行：主题引导、根路径跳转、插入字体样式表的脚本，
 * 以及 React Router 每页不同的水合数据与入口脚本；关键字体的 @font-face 样式与 React Aria 运行时插入的样式。
 * `'wasm-unsafe-eval'` 供排盘内核编译 WebAssembly；`style-src-attr 'unsafe-inline'` 供预渲染 HTML 里 React 写出的 `style` 属性。
 */
export function contentSecurityPolicy(html: string): string {
  const { scripts, styles } = inlineBlocks(html);
  return [
    "default-src 'self'",
    ["script-src 'self' 'wasm-unsafe-eval'", ...scripts.map(sha256)].join(' '),
    ["style-src 'self'", ...[...styles, REACT_ARIA_PRESS_STYLE].map(sha256)].join(' '),
    "style-src-attr 'unsafe-inline'",
    "img-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; ');
}

const CHARSET = '<meta charSet="utf-8"/>';

/**
 * 在页面 `<head>` 的字符集声明之后、任何脚本之前插入本页的 CSP `<meta>`。
 * 用 `<meta>` 而不是响应头：内联脚本每页不同（水合数据），404 页又会出现在任意地址上，按路径配响应头对不上；
 * `<meta>` 跟着文件走。`<meta>` 不支持的 `frame-ancestors` 放在 `_headers` 里。
 */
export function withCsp(html: string): string {
  const at = html.indexOf(CHARSET);
  if (at < 0) throw new Error('页面里没有字符集声明，CSP 无处插入');
  const meta = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(html)}"/>`;
  const end = at + CHARSET.length;
  return html.slice(0, end) + meta + html.slice(end);
}

/** 文件名带内容哈希、可长期缓存的资源：Vite 产物（含内核 wasm）与字体切片及其样式表。 */
const IMMUTABLE = ['/assets/*', '/fonts/*.woff2', '/fonts/*.css'];

/**
 * Workers 静态资源的 `_headers`。全站：禁止 MIME 嗅探、跨站只带源的 Referer、禁止被嵌进框架；
 * 测试站另加 `X-Robots-Tag` 禁止收录。带哈希的资源缓存一年且不再验证；其余（HTML、文本）用平台默认的
 * `max-age=0, must-revalidate` 加 ETag，每次验证。
 */
export function headersFile(site: Site): string {
  const all = [
    'X-Content-Type-Options: nosniff',
    'Referrer-Policy: strict-origin-when-cross-origin',
    "Content-Security-Policy: frame-ancestors 'none'",
    ...(site.indexable ? [] : ['X-Robots-Tag: noindex, nofollow']),
  ];
  const lines = ['/*', ...all.map((h) => `  ${h}`)];
  for (const p of IMMUTABLE) lines.push(p, '  Cache-Control: public, max-age=31536000, immutable');
  return `${lines.join('\n')}\n`;
}
