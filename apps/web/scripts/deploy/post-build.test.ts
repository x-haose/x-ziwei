import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DEV_SITE, SITES, analyticsBeacon } from '../../app/lib/deploy.ts';
import { headersFile, withCsp } from './post-build.ts';

const hash = (s: string) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;

describe('withCsp', () => {
  const page =
    '<html><head><meta charSet="utf-8"/><script>boot()</script><style>@font-face{}</style>' +
    '<script type="module" src="/assets/a.js"></script><noscript><link rel="stylesheet" href="/f.css"/></noscript>' +
    '</head><body><script type="module" async="">import "/assets/b.js";</script></body></html>';

  it('紧跟字符集声明插入，内联脚本与样式按哈希放行，外链脚本不计', () => {
    const out = withCsp(page, DEV_SITE);
    const meta = out.match(/^<html><head><meta charSet="utf-8"\/><meta http-equiv="Content-Security-Policy" content="([^"]*)"\/><script>/);
    expect(meta).not.toBeNull();
    const policy = Object.fromEntries(meta![1]!.split('; ').map((d) => [d.split(' ')[0], d.split(' ').slice(1)]));
    expect(policy['script-src']).toEqual(["'self'", "'wasm-unsafe-eval'", hash('boot()'), hash('import "/assets/b.js";')]);
    expect(policy['style-src']).toContain(hash('@font-face{}'));
  });

  it('没有字符集声明时报错', () => {
    expect(() => withCsp('<html><head></head></html>', DEV_SITE)).toThrow();
  });

  it('只有带统计的目标放行统计脚本与上报地址', () => {
    const directives = (html: string) => html.match(/content="([^"]*)"/)![1]!.split('; ');
    const beta = directives(withCsp(page, SITES.beta));
    expect(beta).toContain("connect-src 'self' https:");
    expect(beta.find((d) => d.startsWith('script-src'))).toContain(' https://static.cloudflareinsights.com ');
    const dev = directives(withCsp(page, DEV_SITE));
    expect(dev).toContain("connect-src 'self' https:");
    expect(dev.join('; ')).not.toContain('cloudflareinsights');
  });
});

describe('analyticsBeacon', () => {
  it('网页目标带统计脚本，不统计的目标不带', () => {
    expect(analyticsBeacon(SITES.beta)).toEqual({
      src: 'https://static.cloudflareinsights.com/beacon.min.js',
      'data-cf-beacon': '{"token":"6d526463cb234d90a459ddaa0419d83d"}',
    });
    expect(analyticsBeacon(SITES.production)).toEqual(analyticsBeacon(SITES.beta));
    expect(analyticsBeacon(DEV_SITE)).toBeNull();
  });
});

describe('headersFile', () => {
  it('测试站禁止收录，正式站不禁', () => {
    expect(headersFile(SITES.beta)).toContain('X-Robots-Tag: noindex');
    expect(headersFile(SITES.production)).not.toContain('X-Robots-Tag');
  });
});
