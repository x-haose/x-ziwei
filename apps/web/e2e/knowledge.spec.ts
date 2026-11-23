import { readFileSync } from 'node:fs';
import { type Page, expect, test } from './test';

/** 知识包页：导入、组合、导出、删除与各种不可用的状态，以及排盘页的释义随组合变化。 */

const SAMPLE = '/zh/chart#cal=solar&d=2000-8-16&t=2&g=f';

const overlay = (id: string, name: string, intro: string) => ({
  schema: 1,
  id,
  version: '2026-11-20',
  language: 'zh-CN',
  extends: 'iztro-docs',
  source: { name },
  stars: { ziweiMaj: { intro } },
});

/** 打开知识包页，等内核与本机包库就绪（「选择文件」可用）。 */
async function openPage(page: Page) {
  await page.goto('/zh/knowledge');
  await expect(page.getByRole('button', { name: '选择文件' })).toBeEnabled({ timeout: 20000 });
}

async function paste(page: Page, json: unknown) {
  await page.getByRole('tab', { name: '粘贴 JSON' }).click();
  await page.getByRole('textbox', { name: '粘贴知识包 JSON' }).fill(typeof json === 'string' ? json : JSON.stringify(json, null, 2));
  await page.getByRole('button', { name: '校验并导入' }).click();
}

const row = (page: Page, id: string) => page.getByRole('listitem').filter({ has: page.getByText(id, { exact: true }) });

test('粘贴导入覆盖包，叠加到当前生效；本机的包与生效卡片随之更新', async ({ page }) => {
  await openPage(page);
  await paste(page, overlay('my-notes', '我的笔记', '笔记：紫微看格局。'));
  const result = page.locator('[aria-live="polite"]').filter({ hasText: '已导入' });
  await expect(result).toContainText('已导入「我的笔记」');
  await expect(result).toContainText('iztro-docs，改 1 条星曜');
  await expect(row(page, 'my-notes')).toContainText('改 1 条星曜，其余条目沿用 iztro-docs。');
  await page.getByRole('button', { name: '叠加到当前生效' }).click();
  await expect(result).toContainText('已在生效');
  const use = page.getByRole('region', { name: '当前生效' });
  await expect(use).toContainText('覆盖 1');
  await expect(use).toContainText('iztro-docs + 我的笔记');
  await page.reload();
  await expect(page.getByRole('region', { name: '当前生效' })).toContainText('iztro-docs + 我的笔记');
});

test('导入失败逐条列出位置与改法：JSON 语法、内核拒绝、本机包库的规则', async ({ page }) => {
  await openPage(page);
  await paste(page, '{\n  "schema": 1,\n  "id": \n}');
  const result = page.locator('[aria-live="polite"]').filter({ hasText: '没能导入' });
  await expect(result).toContainText('1 处要改');
  await expect(result).toContainText('JSON 第 4 行第 1 列');
  await page.getByRole('button', { name: '重新选择' }).click();

  await paste(page, { schema: 1, id: 'iztro-docs', extends: 'nowhere', stars: { ziweiMaj: 3 } });
  await expect(result).toContainText('2 处要改');
  await expect(result).toContainText('id 不能是 iztro-docs');
  await expect(result).toContainText('指向的包 nowhere 不在本机');
  await page.getByRole('button', { name: '重新选择' }).click();

  await paste(page, { schema: 1, id: 'bad', extends: 'iztro-docs', stars: { ziweiMaj: 3 } });
  await expect(result).toContainText('排盘内核');
  await expect(result).toContainText('expected struct StarEntry');

  await page.getByRole('tab', { name: '选文件' }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'pack.txt', mimeType: 'text/plain', buffer: Buffer.from('{}') });
  await expect(result).toContainText('不是 .json 文件');
  await expect(row(page, 'bad')).toHaveCount(0);
});

test('叠加顺序决定排盘页的释义与提示词出处；排盘页的「更换」立即改组合', async ({ page }) => {
  await openPage(page);
  await paste(page, overlay('a', '甲', '甲说紫微。'));
  await expect(page.getByText('已导入「甲」')).toBeVisible();
  await paste(page, overlay('b', '乙', '乙说紫微。'));
  await expect(page.getByText('已导入「乙」')).toBeVisible();
  await page.getByRole('button', { name: '把 甲 叠加到最后' }).click();
  await page.getByRole('button', { name: '把 乙 叠加到最后' }).click();
  await expect(page.getByRole('region', { name: '当前生效' })).toContainText('iztro-docs + 甲 + 乙');

  const preview = page.getByRole('region', { name: '提示词预览' });
  await page.goto(SAMPLE);
  await expect(page.getByRole('button', { name: /^命宫，/ })).toBeVisible();
  await page.getByRole('radio', { name: '原文' }).click();
  await expect(preview).toContainText('乙说紫微。');
  await expect(preview).not.toContainText('甲说紫微。');
  await expect(preview).toContainText('释义摘自知识包 iztro-docs 2026-08-19 + a 2026-11-20 + b 2026-11-20');

  await page.goto('/zh/knowledge');
  await page.getByRole('button', { name: '乙 前移' }).click();
  await expect(page.getByRole('region', { name: '当前生效' })).toContainText('iztro-docs + 乙 + 甲');
  await page.goto(SAMPLE);
  await page.getByRole('radio', { name: '原文' }).click();
  await expect(preview).toContainText('甲说紫微。');

  await page.getByRole('button', { name: /^释义：iztro-docs \+ 乙 \+ 甲/ }).click();
  await page.getByRole('dialog', { name: '释义用哪套知识包' }).getByRole('option', { name: 'iztro-docs，默认包' }).click();
  await expect(preview).not.toContainText('甲说紫微。');
  await expect(preview).toContainText('释义摘自知识包 iztro-docs 2026-08-19（');
});

test('导出的内容与导入的一致；默认包导出内核内置的全文', async ({ page }) => {
  await openPage(page);
  const pack = overlay('my-notes', '我的笔记', '笔记：紫微看格局。');
  await paste(page, pack);
  await expect(page.getByText('已导入「我的笔记」')).toBeVisible();
  const [mine] = await Promise.all([page.waitForEvent('download'), row(page, 'my-notes').getByRole('button', { name: '导出' }).click()]);
  expect(mine.suggestedFilename()).toBe('my-notes-2026-11-20.json');
  expect(JSON.parse(readFileSync((await mine.path())!, 'utf8'))).toEqual(pack);
  const [builtin] = await Promise.all([page.waitForEvent('download'), row(page, 'iztro-docs').getByRole('button', { name: '导出' }).click()]);
  const full = JSON.parse(readFileSync((await builtin.path())!, 'utf8')) as Record<string, Record<string, unknown>>;
  expect(full.id).toBe('iztro-docs');
  expect(Object.keys(full.stars!)).toHaveLength(162);
});

test('查看抽屉：按段浏览、搜索，覆盖包的条目标「覆盖」；Esc 关闭后焦点回到「查看」', async ({ page }) => {
  await openPage(page);
  await paste(page, overlay('my-notes', '我的笔记', '笔记：紫微看格局。'));
  await expect(page.getByText('已导入「我的笔记」')).toBeVisible();
  const view = row(page, 'my-notes').getByRole('button', { name: '查看' });
  await view.click();
  const drawer = page.getByRole('dialog', { name: '我的笔记' });
  await expect(drawer.getByRole('button', { name: '关闭' })).toBeFocused();
  await expect(drawer.getByRole('tab', { name: /格局/ })).toBeDisabled();
  await expect(drawer).toContainText('覆盖');
  await drawer.getByRole('button', { name: /紫微|ziweiMaj/ }).click();
  await expect(drawer).toContainText('笔记：紫微看格局。');
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(view).toBeFocused();

  await row(page, 'iztro-docs').getByRole('button', { name: '查看' }).click();
  const builtin = page.getByRole('dialog', { name: 'iztro-docs' });
  await builtin.getByRole('searchbox').fill('ziweiMaj');
  await expect(builtin).toContainText('找到 1 条');
});

test('删除正在生效的包：确认框写明删后的组合，删后生效组合随之改变', async ({ page }) => {
  await openPage(page);
  await paste(page, overlay('my-notes', '我的笔记', '笔记：紫微看格局。'));
  await page.getByRole('button', { name: '叠加到当前生效' }).click();
  await row(page, 'my-notes').getByRole('button', { name: '删除' }).click();
  const dialog = page.getByRole('alertdialog', { name: '删除「我的笔记」？' });
  await expect(dialog).toContainText('它正在生效，删除后从叠加里移除，剩下 iztro-docs。');
  await expect(dialog.getByRole('button', { name: '取消' })).toBeFocused();
  await dialog.getByRole('button', { name: '删除' }).click();
  await expect(row(page, 'my-notes')).toHaveCount(0);
  await expect(page.getByRole('region', { name: '当前生效' })).not.toContainText('我的笔记');
  await page.reload();
  await expect(page.getByText('还没有导入的包。')).toBeVisible();
});

test('存储不可用：页头提示，导入关闭，只列默认包', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
  });
  await page.goto('/zh/knowledge');
  await expect(page.getByText('这个浏览器不让本页存数据')).toBeVisible();
  await expect(page.getByText('存储不可用，这里只列默认包。')).toBeVisible();
  await expect(page.getByRole('button', { name: '选择文件' })).toBeDisabled();
  await expect(page.getByText('存储不可用，导入已关闭')).toBeVisible();
  await page.goto(SAMPLE);
  await expect(page.getByRole('button', { name: /^释义：iztro-docs/ })).toBeVisible();
});

test('存满了：浏览器拒绝写入时写明原因，库不变', async ({ page }) => {
  await openPage(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Storage.overrideQuotaForOrigin', { origin: new URL(page.url()).origin, quotaSize: 1 });
  await paste(page, overlay('my-notes', '我的笔记', '笔记：紫微看格局。'.repeat(20)));
  const result = page.locator('[aria-live="polite"]').filter({ hasText: '没能导入' });
  await expect(result).toContainText('存储空间满了');
  await expect(row(page, 'my-notes')).toHaveCount(0);
});

test('内核未装好：放置区与粘贴按钮写明在加载，默认包照常显示', async ({ page }) => {
  await page.route('**/*.wasm', () => undefined);
  await page.goto('/zh/knowledge');
  await expect(page.getByText('排盘内核加载中，加载完才能校验')).toBeVisible();
  await expect(row(page, 'iztro-docs')).toContainText('162');
  await page.getByRole('tab', { name: '粘贴 JSON' }).click();
  await expect(page.getByRole('button', { name: /^内核加载中 \d+%$/ })).toBeDisabled();
});
