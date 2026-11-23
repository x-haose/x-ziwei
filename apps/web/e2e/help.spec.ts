import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from './test';

/** 帮助页内容的唯一来源：仓库里的 site/content。按 meta 列出 slug，读各页 frontmatter 的标题。 */
const CONTENT = path.resolve(import.meta.dirname, '../../../site/content');
const slugs = (JSON.parse(readFileSync(path.join(CONTENT, 'meta.json'), 'utf8')) as { pages: string[] }).pages.filter((p) => !p.startsWith('---'));
const titleOf = (file: string) => /^title:\s*"?(.+?)"?\s*$/m.exec(readFileSync(path.join(CONTENT, file), 'utf8'))![1]!;
const PAGES = slugs.flatMap((slug) => [
  { url: `/zh/${slug}`, title: titleOf(`${slug}.mdx`) },
  { url: `/en/${slug}`, title: titleOf(`${slug}.en.mdx`) },
]);

test('每个帮助页能打开，站内链接都有页面、锚点都有标题，没有指向旧说明站的链接', async ({ page, request }) => {
  const checked = new Set<string>();
  for (const p of [...PAGES, { url: '/zh/method', title: '解读方法' }, { url: '/en/method', title: 'Reading method' }]) {
    await page.goto(p.url);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.title);
    const hrefs = await page.locator('a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
    expect(hrefs.filter((h) => /^https?:\/\/ziwei\.x-haose\.com/.test(h)), `${p.url} 有指向旧站的链接`).toEqual([]);
    for (const href of hrefs) {
      if (href.startsWith('#')) {
        const id = decodeURIComponent(href.slice(1));
        expect(await page.locator(`[id="${id}"]`).count(), `${p.url} 的锚点 ${href} 没有对应标题`).toBe(1);
        continue;
      }
      if (!href.startsWith('/')) continue;
      const target = href.split('#')[0]!;
      if (checked.has(target)) continue;
      checked.add(target);
      expect((await request.get(target)).status(), `${p.url} 链到 ${target}`).toBe(200);
    }
  }
});

test('给模型读的文本：llms 索引、全文与每页的 .md 原文', async ({ request }) => {
  const index = await (await request.get('/llms.txt')).text();
  expect(index).toContain('- [安装](/zh/install.md)');
  expect(index).toContain('[English index](/en/llms.txt)');
  const en = await (await request.get('/en/llms.txt')).text();
  expect(en).toContain('- [Install](/en/install.md)');
  const full = await (await request.get('/zh/llms-full.txt')).text();
  expect(full).toContain('# 解读方法 (/zh/method)');
  for (const slug of slugs) expect(full).toContain(`(/zh/${slug})`);
  for (const p of PAGES) {
    const res = await request.get(`${p.url}.md`);
    expect(res.status()).toBe(200);
    expect(await res.text()).toMatch(new RegExp(`^# ${p.title.replace(/[()]/g, '\\$&')} \\(${p.url}\\)`));
  }
  expect(await (await request.get('/en/method.md')).text()).toContain('You are chatting with the user about Zi Wei Dou Shu');
});

test('站内搜索：按 / 打开，输入即搜，回车跳到结果', async ({ page }) => {
  await page.goto('/zh/install');
  await page.waitForLoadState('networkidle');
  await page.keyboard.press('/');
  const dialog = page.getByRole('dialog', { name: '搜索帮助与解读方法' });
  await expect(dialog).toBeVisible();
  // 状态行在输入之前就已挂载，读屏才会播报之后的变化。
  await expect(dialog.getByRole('status')).toHaveText('');
  await page.keyboard.type('隐私政策');
  await expect(dialog.getByRole('status')).toHaveText(/^\d+ 条结果$/);
  const first = dialog.getByRole('option').first();
  await expect(first).toContainText('隐私政策');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/zh\/privacy/);
  await expect(dialog).toBeHidden();
});

test('顶栏的「装进 AI」在安装页标为当前，内容页里的站内链接走前端路由', async ({ page }) => {
  await page.goto('/zh/install');
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '装进 AI' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('article').getByRole('link', { name: '没有 Skill 时' }).first().click();
  await expect(page).toHaveURL('/zh/install');
  await expect(page.getByRole('heading', { name: '没有 Skill 时' })).toBeFocused();
});
