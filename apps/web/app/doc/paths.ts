import type { Lang } from '../i18n/lang';
import { MESSAGES } from '../i18n/messages';

/**
 * 帮助页的站内地址。页面以 `site/content` 的文件名为 slug，地址一般是 `/{lang}/{slug}`；
 * 知识包格式说明（slug `knowledge`）让出 `/{lang}/knowledge` 给知识包功能页，住在 `/{lang}/knowledge/format`。
 */
const MOVED: Record<string, string> = { knowledge: 'knowledge/format' };

/** 帮助页在语言段之后的路径（不带开头的 `/`）。 */
export function docPathOf(slug: string): string {
  return MOVED[slug] ?? slug;
}

/** 语言段之后的路径对应的帮助页 slug；不是帮助页的路径返回 null。 */
export function docSlugAt(path: string, slugs: readonly string[]): string | null {
  return slugs.find((s) => docPathOf(s) === path) ?? null;
}

/**
 * 内容里写的旧地址：格式说明搬家之前 `/{lang}/knowledge`（含锚点）指的是它，改写到新地址。
 * 其余地址原样返回。
 */
export function currentDocHref(href: string): string {
  const m = /^\/(zh|en)\/knowledge(#.*)?$/.exec(href);
  return m ? `/${m[1]}/${MOVED.knowledge}${m[2] ?? ''}` : href;
}

/** 帮助页的标题：知识包格式说明改称「知识包格式」，与功能页「知识包」区分；其余用 MDX 里的标题。 */
export function docTitle(slug: string, lang: Lang, title: string): string {
  return slug === 'knowledge' ? MESSAGES[lang].knowledge.formatTitle : title;
}
