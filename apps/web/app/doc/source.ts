import { defineI18n } from 'fumadocs-core/i18n';
import { loader } from 'fumadocs-core/source';
import { defineDocs } from 'fumadocs-mdx/macro';
import { DEFAULT_LANG, LANGS } from '../i18n/lang';

/**
 * 帮助页的内容：直接读仓库里的 `site/content`（与线上说明站同一份 MDX，内容单一来源）。
 * 中文文件不带后缀（`install.mdx`），英文为 `install.en.mdx`；`meta.json` 与 `meta.en.json` 定顺序与分组。
 * 构建时编译，正文随帮助页的路由模块一起打包；每页另存一份处理后的 Markdown，供 `.md` 原文与 llms 文件使用。
 */
export const docs = defineDocs({
  dir: '../../site/content',
  docs: { postprocess: { includeProcessedMarkdown: true } },
});

/** 帮助页的语言配置：与站点语言一致，中文是默认语言。 */
const docsI18n = defineI18n({ defaultLanguage: DEFAULT_LANG, languages: [...LANGS] });

export const source = loader({
  baseUrl: '/',
  source: docs.toFumadocsSource(),
  i18n: docsI18n,
});

/** 地址里的帮助页：`/zh/install` → 该页。路由表只为存在的页面注册地址，取不到即是代码写错。 */
export function helpPageOf(pathname: string) {
  const [, lang, slug] = pathname.replace(/\.md$/, '').split('/');
  const page = lang && slug ? source.getPage([slug], lang) : undefined;
  if (!page) throw new Error(`地址没有对应的帮助页：${pathname}`);
  return page;
}
