import { type Page, expect, test } from '@playwright/test';

/** 收集页面的控制台错误、警告与未捕获异常；测试结束时断言为空。 */
function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

const PAGES = ['/zh', '/en', '/zh/chart', '/en/chart', '/zh/chart#cal=solar&d=2000-8-16&t=2&g=f', '/en/chart#cal=lunar&d=2020-4-3&leap=1&p=evening&h=10&g=m', '/zh/method', '/en/method', '/zh/install', '/en/install', '/zh/tools', '/en/api', '/zh/privacy'];

for (const width of [375, 1440]) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`${width}px ${scheme}：无横向溢出，控制台无报错`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: scheme });
      const problems = watchConsole(page);
      for (const path of PAGES) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        if (path.includes('#')) await expect(page.getByRole('button', { name: /^命宫[，,]/ })).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${path} 横向溢出`).toBe(0);
      }
      expect(problems).toEqual([]);
    });
  }
}

test('主题在首帧前写好：引导脚本在正文解析之前就设了 data-theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => {
    localStorage.setItem('xzw-theme', 'dark');
    new MutationObserver((records, obs) => {
      if (records.some((r) => r.attributeName === 'data-theme')) {
        (window as unknown as { themeSetBeforeBody: boolean }).themeSetBeforeBody = document.body === null;
        obs.disconnect();
      }
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-theme'] });
  });
  await page.goto('/zh/chart');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => (window as unknown as { themeSetBeforeBody: boolean }).themeSetBeforeBody)).toBe(true);
});

test('主题按钮按 跟随系统 → 浅色 → 深色 轮换，并存在本机', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/zh/chart');
  const button = page.getByRole('button', { name: /^主题：/ });
  await expect(button).toHaveAccessibleName('主题：跟随系统，点按切换');
  await button.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('status').filter({ hasText: '主题：浅色' })).toBeVisible();
  await button.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-pref', 'dark');
  await page.getByRole('button', { name: /^主题：/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-pref', 'system');
  expect(await page.evaluate(() => localStorage.getItem('xzw-theme'))).toBeNull();
});

for (const [locale, lang] of [
  ['en-US', 'en'],
  ['zh-TW', 'zh'],
  ['fr-FR', 'zh'],
] as const) {
  test(`根路径按浏览器语言跳转：${locale} → /${lang}`, async ({ browser }) => {
    const context = await browser.newContext({ locale });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page).toHaveURL(`/${lang}`);
    await context.close();
  });
}

test('不存在的地址显示 404：语言取地址，没有语言对照链接，水合无报错', async ({ page }) => {
  const problems = watchConsole(page);
  const res = await page.goto('/en/nope');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('link[rel="alternate"]')).toHaveCount(0);
  expect(problems.filter((p) => !p.includes('404'))).toEqual([]);
});

test('方法页：目录点击滚到标题并把焦点移过去，不改地址', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.goto('/zh/method');
  await page.getByRole('complementary', { name: '本页目录' }).getByRole('link', { name: '盘面与材料' }).click();
  await expect(page.getByRole('heading', { name: '盘面与材料' })).toBeFocused();
  await expect(page).toHaveURL('/zh/method');
  await expect(page.getByRole('heading', { name: '盘面与材料' })).toBeInViewport();
});

test('字体：关键子集的 @font-face 内联在页面里，其余切片的样式表不阻塞渲染，载入后生效', async ({ page, request }) => {
  const html = await (await request.get('/zh/install')).text();
  const head = html.slice(0, html.indexOf('</head>')).replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
  expect(head).toMatch(/<style>@font-face\{font-family:"Noto Serif SC";src:url\("\/fonts\/serif-critical-/);
  expect(head).not.toMatch(/<link rel="stylesheet" href="\/fonts\//);
  await page.goto('/zh/install');
  await expect
    .poll(() => page.evaluate(() => [...document.fonts].filter((f) => f.family.replace(/"/g, '') === 'XZW Sans SC').length))
    .toBeGreaterThan(10);
});
