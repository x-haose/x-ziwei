import { type Lang, localePath } from '../i18n/lang';
import type { Messages } from '../i18n/messages';
import { type HelpPage, helpUrl } from '../lib/site';

export type DocId = 'method' | HelpPage;

/** 文档分组与顺序：侧栏按它列出，上一篇/下一篇按它前后相接。 */
export const DOC_GROUPS: readonly { group: keyof Messages['doc']['groups']; items: readonly DocId[] }[] = [
  { group: 'use', items: ['method', 'install', 'tools', 'knowledge'] },
  { group: 'dev', items: ['api', 'self-host'] },
  { group: 'about', items: ['privacy', 'terms', 'support'] },
];

export const DOC_ORDER: readonly DocId[] = DOC_GROUPS.flatMap((g) => g.items);

/** 文档的地址：已在本站的走站内路由，其余仍在说明站。 */
export function docLink(lang: Lang, id: DocId): { to: string } | { href: string } {
  return id === 'method' ? { to: localePath(lang, '/method') } : { href: helpUrl(lang, id) };
}

export function docTitle(t: Messages, id: DocId): string {
  return id === 'self-host' ? t.doc.titles.selfHost : t.doc.titles[id];
}

export function docGroup(id: DocId): keyof Messages['doc']['groups'] {
  const g = DOC_GROUPS.find((x) => x.items.includes(id));
  if (!g) throw new Error(`文档不在分组里：${id}`);
  return g.group;
}
