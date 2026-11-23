import { languageAlternates } from '../i18n/lang';
import type { Site } from './deploy';

/** robots.txt：允许收录的站点放开全部并指向 sitemap；测试站禁止抓取任何地址。 */
export function robotsTxt(site: Site): string {
  return site.indexable ? `User-agent: *\nAllow: /\n\nSitemap: ${site.origin}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n';
}

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * sitemap.xml：每个页面在每种语言下各一条，每条附全部语言（含 `x-default`）的 hreflang 对照。
 * `rests` 是语言段之后的路径（首页为空串）。
 */
export function sitemapXml(site: Site, langs: readonly string[], rests: readonly string[]): string {
  const urls = langs.flatMap((lang) =>
    rests.map((rest) => {
      const links = languageAlternates(site.origin, rest)
        .map((a) => `<xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${escapeXml(a.href)}"/>`)
        .join('');
      return `<url><loc>${escapeXml(`${site.origin}/${lang}${rest}`)}</loc>${links}</url>`;
    }),
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}
