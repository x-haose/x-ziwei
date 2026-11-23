import type { Lang } from '../i18n/lang';
import { localePath } from '../i18n/lang';
import type { Messages } from '../i18n/messages';
import { docTitle } from './paths';
import { source } from './source';

/** 内容页侧栏的一项。`id` 是地址里语言段之后的 slug。 */
export interface DocNavItem {
  id: string;
  title: string;
  url: string;
}

export interface DocNavGroup {
  title: string;
  items: DocNavItem[];
}

/**
 * 内容页侧栏：分组与顺序取自帮助页的 `meta.json`（分隔符行起一组），方法页排在第一组的最前面。
 * 上一篇/下一篇按侧栏自上而下的顺序前后相接。
 */
export function docNav(lang: Lang, t: Messages): DocNavGroup[] {
  const groups: DocNavGroup[] = [];
  for (const node of source.getPageTree(lang).children) {
    if (node.type === 'separator') {
      if (typeof node.name !== 'string') throw new Error('meta.json 里的分隔符没有文字');
      groups.push({ title: node.name, items: [] });
      continue;
    }
    if (node.type !== 'page') throw new Error('帮助页不分子目录');
    const page = source.getNodePage(node, lang);
    if (!page) throw new Error(`侧栏项没有对应的页面：${node.url}`);
    const group = groups.at(-1);
    if (!group) throw new Error('meta.json 的第一项应是分隔符');
    group.items.push({ id: page.slugs.join('/'), title: docTitle(page.slugs.join('/'), lang, page.data.title), url: page.url });
  }
  const first = groups[0];
  if (!first) throw new Error('帮助页没有任何分组');
  first.items.unshift({ id: 'method', title: t.doc.methodTitle, url: localePath(lang, '/method') });
  return groups;
}
