import { readFileSync } from 'node:fs';
import path from 'node:path';
import { closePrompt, expect, layerTab, openPromptRaw, side, test } from './test';

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
  await expect(page.getByRole('button', { name: '重试' })).toBeVisible();
  // 右栏不再说「加载中」，指向盘面上的重试。
  const read = side(page);
  await expect(read.getByRole('heading', { name: '排盘程序没有装上' })).toBeVisible();
  await expect(read).toContainText('点盘面上的「重试」重新加载');
  fail = false;
  await page.getByRole('button', { name: '重试' }).click();
  await expect(page.getByRole('button', { name: /^命宫，壬午，主星紫微$/ })).toBeVisible();
});

test('运限：「选别的」里换大限、流年、流月，盘上只叠这一层，阅读写明盘上是哪一段；点盘上的宫读以它为本宫的主题', async ({ page }) => {
  await page.goto(SAMPLE);
  const read = side(page);
  await expect(page.getByRole('button', { name: /^命宫，/ })).toBeVisible();
  const when = page.getByRole('group', { name: '时间' });

  await (await layerTab(page, '大限')).click();
  await page.getByRole('button', { name: '33–42 岁　子女' }).click();
  await expect(page.getByRole('button', { name: '33–42 岁　子女' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('盘上是33–42 岁这十年')).toBeVisible();
  await expect(when.getByRole('button', { pressed: true })).toHaveCount(0);
  await expect(read).toContainText('33–42 岁这个大限（2032–2041 年）的命宫在卯，就是本命的子女宫。');
  // 盘上只叠这一层：宫里只有「大」开头的层宫名。
  await expect(page.locator('[data-index="4"]')).toContainText('大田');
  await expect(page.locator('[data-index="4"]')).not.toContainText(/年./);

  await (await layerTab(page, '流年')).click();
  await expect(page.getByRole('button', { name: '2032 年，虚岁 33', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '下一年' }).click();
  await expect(page.getByRole('button', { name: '2033 年，虚岁 34', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('流年 癸丑　2033　虚岁 34')).toBeVisible();
  await expect(read).toContainText('2033 年（虚岁 34）');

  await (await layerTab(page, '流月')).click();
  await page.getByRole('button', { name: '三月', exact: true }).click();
  await expect(page.getByRole('button', { name: '三月', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/^流月 .{2}　2033 三月　虚岁 34$/)).toBeVisible();

  await (await layerTab(page, '本命')).click();
  await expect(when.getByRole('button', { name: /^一生/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /^财帛，/ }).click();
  await expect(read.getByRole('heading', { level: 2 })).toHaveText('财运');
  await expect(read.getByRole('heading', { level: 2 })).toBeFocused();
  await expect(page.getByRole('button', { name: /^财帛，/ })).toHaveAttribute('aria-pressed', 'true');
});

test('流月含闰月：2020 年的闰四月拆成前后两段，闰月的一段也列流月格局', async ({ page }) => {
  await page.goto(SAMPLE);
  await (await layerTab(page, '流年')).click();
  await page.getByRole('button', { name: /^选流年/ }).click();
  const dialog = page.getByRole('dialog', { name: '流年' });
  await dialog.getByRole('button', { name: '上一页' }).click();
  await dialog.getByRole('option', { name: '2020 年，虚岁 21' }).click();
  await (await layerTab(page, '流月')).click();
  await expect(page.getByRole('button', { name: '闰四月（初一至十五）' })).toBeVisible();
  await page.getByRole('button', { name: '闰四月（十六至月末）' }).click();
  const read = side(page);
  await expect(read).toContainText('2020 年闰四月下');
  // 按该段首日起运限：杀破狼在这一段的流月成立。
  await expect(read.getByRole('listitem').nth(3)).toContainText(/杀破狼：.*流月成立。/);
});

test('问 AI：复制的材料是解读方法、主题原文、所选运限与问题；整张盘的完整提示词在页脚；复制链接', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(SAMPLE);
  await expect(page.getByRole('button', { name: /^命宫，/ })).toBeVisible();
  await page.getByRole('textbox', { name: '你想问什么' }).fill('今年适合换工作吗');
  let preview = await openPromptRaw(page, 'topic');
  await expect(page.getByRole('dialog', { name: '「总论」的提示词' })).toBeVisible();
  await expect(preview).toContainText('你在陪用户聊紫微斗数');
  await expect(preview).toContainText('## 看一个主题');
  await expect(preview).toContainText('# 我的问题\n\n今年适合换工作吗');
  await expect(preview).not.toContainText('# 运限');
  await closePrompt(page);

  await page.getByRole('button', { name: /^今年/ }).click();
  await expect(page.getByText(/^会复制：解读方法、「总论」这几宫的盘面与释义、2026 年（虚岁 27）的运限和你的问题，共 [\d,]+ 字。/)).toBeVisible();
  preview = await openPromptRaw(page, 'topic');
  await expect(preview).toContainText('# 运限');
  await closePrompt(page);

  // 选这十年：附所选大限的运限（写到大限为止），不附全部大限的一览。
  await page.getByRole('button', { name: /^这十年/ }).click();
  preview = await openPromptRaw(page, 'topic');
  await expect(preview).toContainText('## 大限 · 命宫: 本命夫妻 (庚辰)');
  await expect(preview).not.toContainText('# 大限一览');
  await expect(preview).not.toContainText('## 流年');
  await closePrompt(page);

  preview = await openPromptRaw(page, 'chart');
  await expect(page.getByRole('dialog', { name: '整张盘的完整提示词' })).toBeVisible();
  await expect(preview).toContainText('# 命盘 2000-8-16 寅时 女');
  await expect(preview).toContainText('# 运限');
  await expect(preview).toContainText('# 流月一览');
  await closePrompt(page);
  await expect(page.getByRole('button', { name: '整张盘的完整提示词' })).toBeFocused();

  await page.getByRole('button', { name: '复制这张盘的链接' }).click();
  await expect(page.getByRole('status').filter({ hasText: '链接已复制' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${new URL(page.url()).origin}${SAMPLE}`);
});

test('只知道大概时间：夜里有四个候选，所选候选写进地址，换候选不清空主题与问题，材料写明时辰未定', async ({ page }) => {
  await page.goto('/zh/chart#cal=solar&d=2000-8-16&p=night&h=1&g=f');
  await expect(page.getByRole('button', { name: /^命宫，/ })).toBeVisible();
  const cands = page.getByRole('radiogroup', { name: '候选时辰' });
  await expect(cands.getByRole('radio')).toHaveText(['早子', '丑', '寅', '晚子']);
  await expect(cands.getByRole('radio', { name: '丑' })).toBeChecked();
  await page.getByRole('group', { name: '主题' }).getByRole('button', { name: '事业' }).click();
  await page.getByRole('textbox', { name: '你想问什么' }).fill('今年适合换工作吗');
  await cands.getByRole('radio', { name: '寅' }).click();
  await expect(page).toHaveURL('/zh/chart#cal=solar&d=2000-8-16&p=night&h=2&g=f');
  await expect(page.getByRole('button', { name: /^命宫，壬午，主星紫微$/ })).toBeVisible();
  // 换候选是换一张盘，选的主题与写的问题留着。
  await expect(side(page).getByRole('heading', { level: 2 })).toHaveText('事业');
  await expect(page.getByRole('textbox', { name: '你想问什么' })).toHaveValue('今年适合换工作吗');
  await expect(await openPromptRaw(page, 'topic')).toContainText(
    '时辰未定：出生在所填日期的夜里（00:00–04:59、23:00–23:59），候选 早子（00:00–00:59）、丑（01:00–02:59）、寅（03:00–04:59）、晚子（23:00–23:59）；这张盘按寅时排。',
  );
  await closePrompt(page);
});

test('问 AI：选在流月层时材料附那一段流月的运限', async ({ page }) => {
  await page.goto(SAMPLE);
  await expect(page.getByRole('button', { name: /^命宫，/ })).toBeVisible();
  await (await layerTab(page, '流月')).click();
  await page.getByRole('button', { name: '三月', exact: true }).click();
  const preview = await openPromptRaw(page, 'topic');
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
