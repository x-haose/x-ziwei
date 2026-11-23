import { readFileSync } from 'node:fs';
import { type RouteConfig, index, route } from '@react-router/dev/routes';
import { LANGS } from './i18n/lang';

/**
 * 帮助页的 slug，按 `site/content/meta.json` 的顺序（分隔符行 `---…---` 不是页面）。
 * 中英文的 meta 列的页面必须相同，否则某种语言会缺页。
 */
function helpSlugs(): string[] {
  const read = (file: string) =>
    (JSON.parse(readFileSync(new URL(`../../../site/content/${file}`, import.meta.url), 'utf8')) as { pages: string[] }).pages.filter(
      (p) => !p.startsWith('---'),
    );
  const zh = read('meta.json');
  const en = read('meta.en.json');
  if (zh.join() !== en.join()) throw new Error(`meta.json 与 meta.en.json 列的页面不同：${zh.join()} / ${en.join()}`);
  return zh;
}

const HELP_SLUGS = helpSlugs();

/**
 * 全部是静态路径，预渲染时逐个生成文件。每种语言各注册一份同样的页面，路由 id 带语言前缀以示区分。
 *
 * 除页面外还有几个只出文本的资源路由，预渲染成静态文件：
 * 每个内容页的 `.md` 原文、`llms.txt`（根路径取默认语言）与各语言的 `llms.txt`、`llms-full.txt`，
 * 以及站内搜索的索引 `search.json`。不在表里的地址落到 404。
 */
export default [
  index('routes/root.tsx'),
  route('llms.txt', 'routes/llms-index.ts', { id: 'llms' }),
  route('search.json', 'routes/search-index.ts'),
  ...LANGS.flatMap((lang) => [
    route(lang, 'routes/home.tsx', { id: `${lang}/home` }),
    route(`${lang}/chart`, 'routes/chart.tsx', { id: `${lang}/chart` }),
    route(`${lang}/method`, 'routes/method.tsx', { id: `${lang}/method` }),
    route(`${lang}/method.md`, 'routes/doc-markdown.ts', { id: `${lang}/method.md` }),
    route(`${lang}/llms.txt`, 'routes/llms-index.ts', { id: `${lang}/llms` }),
    route(`${lang}/llms-full.txt`, 'routes/llms-full.ts', { id: `${lang}/llms-full` }),
    ...HELP_SLUGS.flatMap((slug) => [
      route(`${lang}/${slug}`, 'routes/help.tsx', { id: `${lang}/${slug}` }),
      route(`${lang}/${slug}.md`, 'routes/doc-markdown.ts', { id: `${lang}/${slug}.md` }),
    ]),
  ]),
  route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig;
