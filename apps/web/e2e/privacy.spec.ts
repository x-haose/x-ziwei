import { type Birth, encodeBirth } from '../app/birth/birth';
import { expect, test } from './test';

/**
 * 生辰只在地址的 # 之后，不进任何会被上报的地方。统计脚本会上报页面元素的选择器（现在只在 LCP、CLS 里），
 * 所以排盘页上任何元素的 id 都不能带生辰的任何一项。
 */

const BIRTH: Birth = { cal: 'solar', year: 2000, month: 8, leap: false, day: 16, time: { kind: 'hour', index: 2 }, gender: 'f' };
/** 地址片段的每一项（原样与百分号编码后），加上标题里写出的年份、日期与时辰。 */
const FIELDS = [...new Set(encodeBirth(BIRTH).split('&').flatMap((f) => [f, encodeURIComponent(f)])), '2000', '8-16', '寅时'];

test('排盘页的阅读各主题与时间、术语浮层、两种全文视图（渲染与原文）里没有任何元素的 id 带生辰', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/zh/chart#${encodeBirth(BIRTH)}`);
  const birthIds = () => page.evaluate((f) => [...document.querySelectorAll('[id]')].map((e) => e.id).filter((id) => f.some((x) => id.includes(x))), FIELDS);
  const read = page.getByRole('region', { name: '用这张盘' });
  await expect(read.getByRole('heading', { level: 2 })).toHaveText('总论');
  expect(await birthIds()).toEqual([]);
  for (const name of ['事业', '性格', '田宅']) {
    await page.getByRole('group', { name: '主题' }).getByRole('button', { name }).click();
    expect(await birthIds()).toEqual([]);
  }
  for (const name of [/^这十年/, /^今年/]) {
    await page.getByRole('group', { name: '时间' }).getByRole('button', { name }).click();
    expect(await birthIds()).toEqual([]);
  }
  await read.getByRole('button', { name: '三方四正' }).first().click();
  await expect(page.getByRole('dialog', { name: '三方四正' })).toBeVisible();
  expect(await birthIds()).toEqual([]);
  await page.keyboard.press('Escape');
  for (const open of ['看全文', '整张盘的完整提示词']) {
    await page.getByRole('button', { name: open }).click();
    const dialog = page.getByRole('dialog', { name: /提示词$/ });
    await expect(dialog.getByRole('document')).toContainText('命盘 2000-8-16 寅时 女');
    expect(await birthIds()).toEqual([]);
    await dialog.getByRole('radio', { name: '原文' }).click();
    expect(await birthIds()).toEqual([]);
    await page.keyboard.press('Escape');
  }
});

test('从看盘进编辑器：生辰只在 # 之后（不进查询串），编辑器里也没有元素的 id 带生辰', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/zh/chart#${encodeBirth(BIRTH)}`);
  await page.getByRole('region', { name: '用这张盘' }).getByRole('link', { name: '改写这一条：紫微' }).click();
  await expect(page.getByRole('heading', { level: 2, name: /^紫微/ })).toBeVisible();
  const url = new URL(page.url());
  for (const f of FIELDS) expect(url.pathname + url.search, `查询串里带了 ${f}`).not.toContain(f);
  expect(url.hash).toBe(`#${encodeBirth(BIRTH)}`);
  const ids = await page.evaluate((f) => [...document.querySelectorAll('[id]')].map((e) => e.id).filter((id) => f.some((x) => id.includes(x))), FIELDS);
  expect(ids).toEqual([]);
});
