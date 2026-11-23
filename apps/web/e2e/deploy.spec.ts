import { expect, test } from '@playwright/test';

/**
 * 部署形态：经 `wrangler dev` 跑 Worker 与静态资源（`_headers`、`_redirects`、404 页、末尾斜杠），
 * 产物按测试站构建（`XZW_SITE=beta`）。
 */

test('未知地址返回 404 状态，回退页在浏览器里渲染 404 页面', async ({ page }) => {
  const res = await page.goto('/zh/nope');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('没有这个页面');
  expect((await page.request.get('/assets/nope.js')).status()).toBe(404);
});

test('页面的规范地址不带末尾斜杠', async ({ request }) => {
  const res = await request.get('/zh/install/', { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers().location).toBe('/zh/install');
});

test('不带语言段的地址按 Accept-Language 跳到对应语言，没有的地址照常 404', async ({ request }) => {
  const en = await request.get('/install?x=1', { maxRedirects: 0, headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
  expect(en.status()).toBe(302);
  expect(en.headers().location).toBe('/en/install?x=1');
  expect(en.headers().vary).toContain('Accept-Language');
  const zh = await request.get('/install.mdx', { maxRedirects: 0, headers: { 'Accept-Language': 'fr' } });
  expect(zh.headers().location).toBe('/zh/install.mdx');
  expect((await request.get('/nope', { maxRedirects: 0 })).status()).toBe(404);
});

test('Markdown 原文：.md、.mdx 后缀与 Accept: text/markdown', async ({ request }) => {
  const md = await (await request.get('/zh/install.md')).text();
  expect(md).toMatch(/^# 安装 \(\/zh\/install\)/);
  const mdx = await request.get('/zh/install.mdx');
  expect(mdx.headers()['content-type']).toContain('text/markdown');
  expect(await mdx.text()).toBe(md);
  const negotiated = await request.get('/zh/install', { headers: { Accept: 'text/markdown' } });
  expect(await negotiated.text()).toBe(md);
  expect(negotiated.headers().vary).toContain('Accept');
  const html = await request.get('/zh/install', { headers: { Accept: 'text/html,*/*;q=0.8' } });
  expect(html.headers()['content-type']).toContain('text/html');
  expect(html.headers().vary).toContain('Accept');
});

test('旧说明站 /{lang}/docs/* 的地址永久跳转', async ({ request }) => {
  const mcp = await request.get('/en/docs/guide/mcp', { maxRedirects: 0 });
  expect(mcp.status()).toBe(301);
  expect(mcp.headers().location).toBe('/en/install');
  const lib = await request.get('/zh/docs/api/chart', { maxRedirects: 0 });
  expect(lib.status()).toBe(301);
  expect(lib.headers().location).toBe('https://x-iztro.x-haose.com/zh/docs/api/chart');
});

test('测试站禁止收录：robots.txt 与 X-Robots-Tag；sitemap 带 hreflang', async ({ request }) => {
  expect(await (await request.get('/robots.txt')).text()).toBe('User-agent: *\nDisallow: /\n');
  const page = await request.get('/zh/install');
  expect(page.headers()['x-robots-tag']).toBe('noindex, nofollow');
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain(
    '<url><loc>https://ziwei-beta.x-haose.com/en/install</loc><xhtml:link rel="alternate" hreflang="zh-CN" href="https://ziwei-beta.x-haose.com/zh/install"/>',
  );
  expect((await request.get('/llms-full.txt')).headers()['content-type']).toContain('text/plain');
});

test('缓存：带哈希的资源长期缓存，页面每次验证；安全响应头', async ({ page, request }) => {
  const wasm: string[] = [];
  page.on('response', (r) => {
    if (r.url().endsWith('.wasm')) wasm.push(r.url());
  });
  await page.goto('/zh/chart');
  await expect.poll(() => wasm.length).toBeGreaterThan(0);
  const asset = await request.get(new URL(wasm[0]!).pathname);
  expect(asset.headers()['content-type']).toBe('application/wasm');
  expect(asset.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
  const html = await request.get('/zh/chart');
  expect(html.headers()['cache-control']).toBe('public, max-age=0, must-revalidate');
  expect(html.headers()['content-security-policy']).toBe("frame-ancestors 'none'");
  expect(html.headers()['x-content-type-options']).toBe('nosniff');
});

test('每个页面的 CSP 放行它自己的内联脚本：页面水合、排盘内核能编译，没有违规', async ({ page }) => {
  const violations: string[] = [];
  await page.exposeFunction('reportViolation', (v: string) => violations.push(v));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { reportViolation: (v: string) => void }).reportViolation(`${e.violatedDirective} ${e.blockedURI}`),
    );
  });
  await page.goto('/');
  await expect(page).toHaveURL('/zh');
  await page.goto('/zh/chart#cal=solar&d=2000-8-16&t=2&g=f');
  await expect(page.getByRole('button', { name: /^命宫，/ })).toBeVisible();
  await page.goto('/en/install');
  await page.waitForLoadState('networkidle');
  await page.goto('/zh/nope');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('没有这个页面');
  expect(violations).toEqual([]);
});
