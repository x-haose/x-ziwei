import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

/** 金标里的一张盘：每宫的地支、宫名与主星（见文件里的 source）。 */
const gold = JSON.parse(readFileSync(path.join(import.meta.dirname, 'fixtures', 'gold-chart.json'), 'utf8')) as {
  params: { solar_date: string; time_index: number; gender: string };
  lunarDate: string;
  palaces: { branch: string; name: string; majors: string[] }[];
};

const SAMPLE = '/zh/chart#cal=solar&d=2000-8-16&t=2&g=f';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('真实排盘：十二宫主星落宫与金标一致', async ({ page }) => {
  const g = gold.params.gender === '女' ? 'f' : 'm';
  await page.goto(`/zh/chart#cal=solar&d=${gold.params.solar_date}&t=${gold.params.time_index}&g=${g}`);
  for (const p of gold.palaces) {
    const stars = p.majors.length ? p.majors.join('、') : '无主星';
    await expect(page.getByRole('button', { name: new RegExp(`^${p.name}，.${p.branch}，主星${stars}$`) })).toBeVisible();
  }
  await expect(page.getByText(`农历 ${gold.lunarDate}`)).toBeVisible();
});

test('内核加载中显示进度：进度条随下载推进', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 20, downloadThroughput: 400 * 1024, uploadThroughput: -1 });
  await page.goto(SAMPLE);
  const bar = page.getByRole('progressbar', { name: '排盘内核加载中' });
  await expect(bar).toBeVisible();
  await expect.poll(async () => Number(await bar.getAttribute('aria-valuenow')), { timeout: 15000 }).toBeGreaterThan(0);
  await expect(page.getByText(/^\d+ \/ \d+ KB$/)).toBeVisible();
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await expect(page.getByRole('button', { name: /^命宫，壬午，主星紫微$/ })).toBeVisible({ timeout: 20000 });
});

test('内核加载失败明确报错并可重试', async ({ page }) => {
  let fail = true;
  await page.route('**/*.wasm', async (route) => {
    if (fail) await route.abort();
    else await route.continue();
  });
  await page.goto(SAMPLE);
  await expect(page.getByText('排盘内核加载失败')).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: '重试' }).click();
  await expect(page.getByRole('button', { name: /^命宫，壬午，主星紫微$/ })).toBeVisible();
});

test('运限：大限、流年、流月切换，选宫跳到该层命宫，读数随之更新', async ({ page }) => {
  await page.goto(SAMPLE);
  const board = page.getByRole('button', { name: /^命宫，/ });
  await expect(board).toBeVisible();

  await page.getByRole('radio', { name: '大限' }).click();
  await page.getByRole('button', { name: '33–42 岁　子女' }).click();
  await expect(page.getByRole('button', { name: '33–42 岁　子女' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /^子女，/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('选中宫的读数')).toContainText('大限命宫');

  await page.getByRole('radio', { name: '流年' }).click();
  await expect(page.getByRole('button', { name: '2032 年，虚岁 33', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '下一年' }).click();
  await expect(page.getByRole('button', { name: '2033 年，虚岁 34', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('流年 癸丑　2033　虚岁 34')).toBeVisible();

  await page.getByRole('radio', { name: '流月' }).click();
  await page.getByRole('button', { name: '三月', exact: true }).click();
  await expect(page.getByRole('button', { name: '三月', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/^流月 .{2}　2033 三月　虚岁 34$/)).toBeVisible();

  await page.getByRole('radio', { name: '本命' }).click();
  await expect(page.getByRole('button', { name: /^命宫，壬午/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /^财帛，/ }).click();
  await expect(page.getByLabel('选中宫的读数')).toContainText('武曲');
});

test('流月含闰月：2020 年的闰四月拆成前后两段', async ({ page }) => {
  await page.goto(SAMPLE);
  await page.getByRole('radio', { name: '流年' }).click();
  await page.getByRole('button', { name: /^选流年/ }).click();
  const dialog = page.getByRole('dialog', { name: '流年' });
  await dialog.getByRole('button', { name: '上一页' }).click();
  await dialog.getByRole('option', { name: '2020 年，虚岁 21' }).click();
  await page.getByRole('radio', { name: '流月' }).click();
  await expect(page.getByRole('button', { name: '闰四月（初一至十五）' })).toBeVisible();
  await page.getByRole('button', { name: '闰四月（十六至月末）' }).click();
  await expect(page.getByText(/2020 闰四月下/)).toBeVisible();
});

test('提示词：内核文本、方法正文与问题，复制原文与链接', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(SAMPLE);
  await expect(page.getByRole('button', { name: /^命宫，/ })).toBeVisible();
  await page.getByRole('textbox', { name: '你的问题' }).fill('今年适合换工作吗');
  await page.getByRole('radio', { name: '原文' }).click();
  await expect(page.getByRole('radio', { name: '原文' })).toBeChecked();
  const preview = page.getByRole('region', { name: '提示词预览' });
  await expect(preview).toContainText('你在陪用户聊紫微斗数');
  await expect(preview).toContainText('# 命盘 2000-8-16 寅时 女');
  await expect(preview).toContainText('# 运限');
  await expect(preview).toContainText('# 我的问题');

  await page.locator('label').filter({ hasText: '大限一览' }).click();
  await expect(page.getByRole('checkbox', { name: '大限一览' })).toBeChecked();
  await expect(preview).toContainText('# 大限一览');
  await page.locator('label').filter({ hasText: /^2022–2031 流年$/ }).click();
  await expect(preview).toContainText('# 流年一览 2022-2031');

  await page.getByRole('button', { name: '复制提示词' }).click();
  await expect(page.getByRole('status').filter({ hasText: '已在剪贴板' })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.startsWith('你在陪用户聊紫微斗数')).toBe(true);
  expect(copied).toMatch(/# 我的问题\n\n今年适合换工作吗$/);
  expect(copied).toContain('# 大限一览');

  await page.getByRole('button', { name: '复制链接' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${new URL(page.url()).origin}${SAMPLE}`);
});

test('只知道大概时间：夜里有四个候选，所选候选写进地址，提示词写明时辰未定', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/zh/chart#cal=solar&d=2000-8-16&p=night&h=1&g=f');
  await expect(page.getByRole('button', { name: /^命宫，/ })).toBeVisible();
  const cands = page.getByRole('radiogroup', { name: '候选时辰' });
  await expect(cands.getByRole('radio')).toHaveText(['早子', '丑', '寅', '晚子']);
  await expect(cands.getByRole('radio', { name: '丑' })).toBeChecked();
  await cands.getByRole('radio', { name: '寅' }).click();
  await expect(page).toHaveURL('/zh/chart#cal=solar&d=2000-8-16&p=night&h=2&g=f');
  await expect(page.getByRole('button', { name: /^命宫，壬午，主星紫微$/ })).toBeVisible();
  await page.getByRole('radio', { name: '原文' }).click();
  await expect(page.getByRole('radio', { name: '原文' })).toBeChecked();
  await expect(page.getByRole('region', { name: '提示词预览' })).toContainText(
    '时辰未定：出生在所填日期的夜里（00:00–04:59、23:00–23:59），候选 早子（00:00–00:59）、丑（01:00–02:59）、寅（03:00–04:59）、晚子（23:00–23:59）；这张盘按寅时排。',
  );
  await page.getByRole('button', { name: '复制链接' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/#cal=solar&d=2000-8-16&p=night&h=2&g=f$/);
});

test('提示词：选在流月层时勾选项写到流月；按年时附流月一览', async ({ page }) => {
  await page.goto(SAMPLE);
  await expect(page.getByRole('button', { name: /^命宫，/ })).toBeVisible();
  await page.getByRole('radio', { name: '原文' }).click();
  await expect(page.getByRole('radio', { name: '原文' })).toBeChecked();
  const preview = page.getByRole('region', { name: '提示词预览' });
  await expect(page.getByRole('checkbox', { name: /^\d{4} 年运限$/ })).toBeChecked();
  await expect(preview).toContainText('# 流月一览');
  await page.getByRole('radio', { name: '流月' }).click();
  await page.getByRole('button', { name: '三月', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /^\d{4} 年三月运限$/ })).toBeChecked();
  await expect(preview).toContainText('## 流月');
  await expect(preview).not.toContainText('# 流月一览');
});

test('首页示例盘由内核排出，引线连到命宫的紫微', async ({ page }) => {
  await page.goto('/zh');
  const link = page.getByRole('link', { name: /打开这张示例盘/ });
  await expect(link.locator('[data-star="ziweiMaj"]')).toBeVisible();
  await expect(page.getByText('命宫主星紫微，名出紫微垣')).toBeVisible();
  await expect(page.getByText(/^iztro-docs \d{4}-\d{2}-\d{2}$/)).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(SAMPLE);
});
