import type { MetaDescriptor } from 'react-router';
import { type Lang, langOfPath } from '../i18n/lang';

/** 从路由的地址取语言，供 `meta` 导出使用（`meta` 在组件之外执行，拿不到 hooks）。 */
export function metaLang(pathname: string): Lang {
  const lang = langOfPath(pathname);
  if (!lang) throw new Error(`meta 只用于语言段之下的页面：${pathname}`);
  return lang;
}

/** 页面标题与描述。标题统一以「：x-ziwei」收尾，首页除外。 */
export function pageMeta(title: string, description?: string): MetaDescriptor[] {
  return description ? [{ title }, { name: 'description', content: description }] : [{ title }];
}
