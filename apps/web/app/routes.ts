import { readFileSync, readdirSync } from 'node:fs';
import { type RouteConfig, index, route } from '@react-router/dev/routes';
import { helpSlugs } from './doc/content-files';
import { LANGS } from './i18n/lang';

/** 帮助页内容目录：仓库里的 site/content（内容单一来源）。 */
const CONTENT = new URL('../../../site/content/', import.meta.url);

/** 帮助页的 slug，按 `meta.json` 的顺序；目录与 meta 不一致时构建报错（见 `helpSlugs`）。 */
function readHelpSlugs(): string[] {
  const meta = (file: string) => (JSON.parse(readFileSync(new URL(file, CONTENT), 'utf8')) as { pages: string[] }).pages;
  return helpSlugs(readdirSync(CONTENT), meta('meta.json'), meta('meta.en.json'));
}

const HELP_SLUGS = readHelpSlugs();

/**
 * 全部是静态路径，预渲染时逐个生成文件。每种语言各注册一份同样的页面，路由 id 带语言前缀以示区分。
 *
 * 除页面外还有几个只出文本的资源路由，预渲染成静态文件：
 * 每个内容页的 `.md` 原文、`llms.txt` 与 `llms-full.txt`（根路径取默认语言）与各语言的同名文件、
 * 各语言的站内搜索索引 `search.json`，以及 `robots.txt` 与 `sitemap.xml`。不在表里的地址落到 404。
 */
export default [
  index('routes/root.tsx'),
  route('llms.txt', 'routes/llms-index.ts', { id: 'llms' }),
  route('llms-full.txt', 'routes/llms-full.ts', { id: 'llms-full' }),
  route('robots.txt', 'routes/robots.ts'),
  route('sitemap.xml', 'routes/sitemap.ts'),
  ...LANGS.flatMap((lang) => [
    route(lang, 'routes/home.tsx', { id: `${lang}/home` }),
    route(`${lang}/chart`, 'routes/chart.tsx', { id: `${lang}/chart` }),
    route(`${lang}/method`, 'routes/method.tsx', { id: `${lang}/method` }),
    route(`${lang}/method.md`, 'routes/doc-markdown.ts', { id: `${lang}/method.md` }),
    route(`${lang}/llms.txt`, 'routes/llms-index.ts', { id: `${lang}/llms` }),
    route(`${lang}/llms-full.txt`, 'routes/llms-full.ts', { id: `${lang}/llms-full` }),
    route(`${lang}/search.json`, 'routes/search-index.ts', { id: `${lang}/search` }),
    ...HELP_SLUGS.flatMap((slug) => [
      route(`${lang}/${slug}`, 'routes/help.tsx', { id: `${lang}/${slug}` }),
      route(`${lang}/${slug}.md`, 'routes/doc-markdown.ts', { id: `${lang}/${slug}.md` }),
    ]),
  ]),
  route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig;
