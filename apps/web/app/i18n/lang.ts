/**
 * 站点语言。
 *
 * 地址一律带语言前缀（`/zh/…`、`/en/…`），与说明站一致，链接可以跨语言分享而不依赖浏览器协商。
 * 中文是默认语言：根路径识别不出浏览器语言时去中文，第一期文案也以中文为准。
 */
export const LANGS = ['zh', 'en'] as const;

export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = 'zh';

/** 写进 `<html lang>` 的 BCP 47 标签：中文页面是简体中文，决定 CJK 字形与断行规则。 */
export const HTML_LANG: Record<Lang, string> = { zh: 'zh-CN', en: 'en' };

export function isLang(value: string): value is Lang {
  return (LANGS as readonly string[]).includes(value);
}

/** 地址第一段是受支持的语言时返回它；根路径与 404 等不带语言段的地址返回 null。 */
export function langOfPath(pathname: string): Lang | null {
  const first = pathname.split('/')[1] ?? '';
  return isLang(first) ? first : null;
}

/** 把站内路径（不带语言段，以 `/` 开头或为空串）拼到某个语言下。空串是该语言的首页。 */
export function localePath(lang: Lang, path: string): string {
  if (path !== '' && !path.startsWith('/')) throw new Error(`站内路径须以 / 开头：${path}`);
  return `/${lang}${path}`;
}
