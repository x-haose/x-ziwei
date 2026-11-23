import { describe, expect, it } from 'vitest';
import { robotsTxt, sitemapXml } from './crawl';
import { SITES } from './deploy';

describe('robotsTxt', () => {
  it('正式站放开抓取并指向 sitemap', () => {
    expect(robotsTxt(SITES.production)).toBe('User-agent: *\nAllow: /\n\nSitemap: https://ziwei.x-haose.com/sitemap.xml\n');
  });

  it('测试站禁止抓取', () => {
    expect(robotsTxt(SITES.beta)).toBe('User-agent: *\nDisallow: /\n');
  });
});

describe('sitemapXml', () => {
  it('每种语言各一条，附全部语言与 x-default 的对照', () => {
    const xml = sitemapXml(SITES.production, ['zh', 'en'], ['', '/install']);
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual([
      'https://ziwei.x-haose.com/zh',
      'https://ziwei.x-haose.com/zh/install',
      'https://ziwei.x-haose.com/en',
      'https://ziwei.x-haose.com/en/install',
    ]);
    const install = xml.split('<url>').find((u) => u.includes('<loc>https://ziwei.x-haose.com/en/install</loc>'));
    expect(install).toContain('hreflang="zh-CN" href="https://ziwei.x-haose.com/zh/install"');
    expect(install).toContain('hreflang="en" href="https://ziwei.x-haose.com/en/install"');
    expect(install).toContain('hreflang="x-default" href="https://ziwei.x-haose.com/zh/install"');
  });
});
