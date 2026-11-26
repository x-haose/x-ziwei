import { type Birth, encodeBirth } from '../app/birth/birth';
import { expect, test } from './test';

/**
 * 生辰只在地址的 # 之后，不进任何会被上报的地方。统计脚本会上报页面元素的选择器（现在只在 LCP、CLS 里），
 * 所以排盘页上任何元素的 id 都不能带生辰的任何一项。
 */

const BIRTH: Birth = { cal: 'solar', year: 2000, month: 8, leap: false, day: 16, time: { kind: 'hour', index: 2 }, gender: 'f' };
/** 地址片段的每一项（原样与百分号编码后），加上标题里写出的年份、日期与时辰。 */
const FIELDS = [...new Set(encodeBirth(BIRTH).split('&').flatMap((f) => [f, encodeURIComponent(f)])), '2000', '8-16', '寅时'];

test('排盘页的看盘各页、提示词全文（渲染与原文）里没有任何元素的 id 带生辰', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/zh/chart#${encodeBirth(BIRTH)}`);
  const birthIds = () => page.evaluate((f) => [...document.querySelectorAll('[id]')].map((e) => e.id).filter((id) => f.some((x) => id.includes(x))), FIELDS);
  const read = page.getByRole('tabpanel', { name: '看盘' });
  await expect(read.getByRole('heading', { level: 3 })).toHaveText('命宫');
  expect(await birthIds()).toEqual([]);
  for (const v of ['格局', '大限', '流年']) {
    await read.getByRole('radiogroup', { name: '看盘的内容' }).getByRole('radio', { name: v }).click();
    expect(await birthIds()).toEqual([]);
  }
  await page.getByRole('tab', { name: '提示词' }).click();
  await page.getByRole('button', { name: /^查看全文/ }).click();
  const dialog = page.getByRole('dialog', { name: '提示词全文' });
  await expect(dialog.getByRole('heading', { name: '命盘 2000-8-16 寅时 女' })).toBeVisible();
  expect(await birthIds()).toEqual([]);
  await dialog.getByRole('radio', { name: '原文' }).click();
  expect(await birthIds()).toEqual([]);
});
