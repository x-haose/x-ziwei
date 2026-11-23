import { isMarkdownPreferred } from 'fumadocs-core/negotiation';
import { DEFAULT_LANG, type Lang, isLang } from '../app/i18n/lang';

/**
 * 按 `Accept-Language` 选站点语言：按 q 值从高到低（同值保持原顺序）找第一个主标签受支持的语言
 * （`zh-TW` 也算中文），找不到就用默认语言。与根路径页面里按 `navigator.languages` 跳转的规则一致。
 */
export function pickLang(header: string | null): Lang {
  const ranked = (header ?? '')
    .split(',')
    .map((part, i) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.slice(2)) : 1, i };
    })
    .filter((e) => e.tag && e.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  for (const { tag } of ranked) {
    const primary = tag.split('-')[0] ?? '';
    if (isLang(primary)) return primary;
  }
  return DEFAULT_LANG;
}

/** 路径末段带扩展名（`.md`、`.txt`、`.json` 等），即不是页面地址。 */
export function hasExtension(pathname: string): boolean {
  return /\.[^/]+$/.test(pathname);
}

/**
 * 语言段之下的请求该改为取哪份 Markdown 原文，不取原文时为 null。与旧说明站的约定一致：
 * 页面地址追加 `.md` 即原文（静态文件，不经这里）；追加 `.mdx` 同样取原文；
 * 页面地址的请求在 `Accept` 里把 Markdown 排得不低于 HTML 时（规则见 fumadocs 的 `isMarkdownPreferred`）也取原文。
 */
export function markdownPath(pathname: string, request: Request): string | null {
  if (pathname.endsWith('.mdx')) return pathname.slice(0, -1);
  if (hasExtension(pathname) || !isMarkdownPreferred(request)) return null;
  return `${pathname.replace(/\/$/, '')}.md`;
}
