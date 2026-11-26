import * as kernel from 'x-iztro';
import { closePrompt, expect, openPromptRaw, side, test, type Page } from './test';

/** 排盘页的阅读（设计规范第 21 节）：按主题的五步、时间、盘上的高亮、术语、问 AI、手机底栏。 */

const SAMPLE = '/zh/chart#cal=solar&d=2000-8-16&t=2&g=f';

const step = (page: Page, n: number) => side(page).getByRole('list', { name: /分五步读$/ }).getByRole('listitem').nth(n - 1);
const cell = (page: Page, i: number) => page.locator(`[data-index="${i}"]`);

test('第一次打开：总论、一生，盘只有本命层，选中命宫，停在第 1 步', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(SAMPLE);
  const read = side(page);
  await expect(read.getByRole('heading', { level: 2 })).toHaveText('总论');
  await expect(page.getByRole('group', { name: '主题' }).getByRole('button', { pressed: true })).toHaveText('总论');
  await expect(page.getByRole('group', { name: '时间' }).getByRole('button', { pressed: true })).toHaveText(/^一生/);
  await expect(read).toContainText('一生（本命盘）');
  await expect(read).toContainText('看命宫连同它的三方四正，另看身宫、福德宫。');
  await expect(step(page, 1)).toHaveAttribute('data-on', '');
  await expect(step(page, 1)).toContainText('你的命宫在午，主星是紫微（庙）；同宫的辅星有文曲（陷）。');
  // 「怎么看」取自解读方法。
  await expect(step(page, 1)).toContainText('先看这个主题的本宫坐什么主星、亮度如何；本宫没有主星时，借对宫的主星来看。');
  await expect(page.getByRole('button', { name: /^命宫，/ })).toHaveAttribute('aria-pressed', 'true');
  // 盘上不叠运限层：宫里没有「大X」「年X」。
  await expect(cell(page, 4)).not.toContainText(/[大年]命/);
  await expect(read).toContainText('盘面由排盘程序算出；释义摘自知识包「iztro-docs」。');
  // 运限选择收着。
  await expect(page.getByRole('radiogroup', { name: '运限层' })).toBeHidden();
});

test('切主题：右栏换成这个主题、从第 1 步开始；空宫借对宫，盘上高亮本宫与对宫', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(SAMPLE);
  const read = side(page);
  await page.getByRole('group', { name: '主题' }).getByRole('button', { name: '田宅' }).click();
  await expect(read.getByRole('heading', { level: 2 })).toHaveText('田宅');
  await expect(step(page, 1)).toContainText('你的田宅宫在酉，没有主星（空宫）；同宫的辅星有地空和擎羊（陷）。对宫子女宫的主星是太阳（庙）和天梁（庙）。');
  await expect(step(page, 1)).toContainText('太阳（子女宫）');
  await expect(page.getByRole('button', { name: /^田宅，/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(cell(page, 1)).toHaveAttribute('data-rel', '');
  // 只取本宫的主题。
  await page.getByRole('group', { name: '主题' }).getByRole('button', { name: '性格' }).click();
  await expect(step(page, 2)).toContainText('「性格」只看命宫、迁移宫、福德宫和身宫（在官禄宫）这几宫本身，不看各自的三方四正。');
});

test('切时间：这十年、今年只叠那一层并停在第 5 步；一生的第 5 步可直接切过去', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(SAMPLE);
  const read = side(page);
  const when = page.getByRole('group', { name: '时间' });
  await when.getByRole('button', { name: /^今年/ }).click();
  await expect(read).toContainText('2026 年（虚岁 27）');
  await expect(step(page, 5)).toHaveAttribute('data-on', '');
  await expect(step(page, 5)).toContainText('2026 年（丙午）你虚岁 27，流年命宫在午，就是本命的命宫。');
  await expect(step(page, 3)).toContainText('流年（丙午）的四化：');
  await expect(cell(page, 4)).toContainText('年命');
  await expect(cell(page, 4)).not.toContainText('大');

  await when.getByRole('button', { name: /^一生/ }).click();
  await expect(step(page, 1)).toHaveAttribute('data-on', '');
  await step(page, 5).getByRole('button', { name: '看这十年的总论' }).click();
  await expect(read).toContainText('23–32 岁这十年（现在）');
  await expect(when.getByRole('button', { name: /^这十年/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(step(page, 5).getByRole('heading')).toBeFocused();
  await expect(cell(page, 2)).toContainText('大命');
});

test('高视口：切到今年、这十年停在第 5 步，滚到底也是第 5 步', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1300 });
  await page.goto(SAMPLE);
  const when = page.getByRole('group', { name: '时间' });
  await when.getByRole('button', { name: /^今年/ }).click();
  await expect(step(page, 5)).toHaveAttribute('data-on', '');
  await page.mouse.move(1150, 700);
  await page.mouse.wheel(0, 4000);
  await expect(step(page, 5)).toHaveAttribute('data-on', '');
  await when.getByRole('button', { name: /^这十年/ }).click();
  await expect(step(page, 5)).toHaveAttribute('data-on', '');
  await expect(side(page)).toContainText('23–32 岁这十年（现在）');
});

test('步骤高亮：「盘上看」切换焦点宫与高亮宫；右栏滚到哪一步，盘就跟到哪一步', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(SAMPLE);
  await step(page, 2).getByRole('button', { name: '盘上看', exact: true }).click();
  await expect(step(page, 2).getByRole('button', { name: '盘上看', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(step(page, 2)).toHaveAttribute('data-on', '');
  // 第 2 步：命宫为焦点，三方四正与身宫、福德宫铺底色。
  await expect(page.getByRole('button', { name: /^命宫，/ })).toHaveAttribute('aria-pressed', 'true');
  for (const i of [10, 0, 8, 6]) await expect(cell(page, i)).toHaveAttribute('data-rel', '');
  await expect(cell(page, 2)).not.toHaveAttribute('data-rel', '');
  // 第 5 步（一生）：焦点是大限命宫（本命夫妻宫）。
  await page.mouse.move(1150, 600);
  await page.mouse.wheel(0, 4000);
  await expect(step(page, 5)).toHaveAttribute('data-on', '');
  await expect(page.getByRole('button', { name: /^夫妻，/ })).toHaveAttribute('aria-pressed', 'true');
});

test('术语：点开看生效组合里的解释，Esc 关闭后焦点回到术语；亮度字链到标题为「亮度」的条目', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(SAMPLE);
  const read = side(page);
  const term = read.getByRole('button', { name: '三方四正' }).first();
  await term.click();
  const pop = page.getByRole('dialog', { name: '三方四正' });
  await expect(pop).toContainText('三合位');
  await page.keyboard.press('Escape');
  await expect(pop).toHaveCount(0);
  await expect(term).toBeFocused();
  await read.getByRole('button', { name: '庙', exact: true }).first().click();
  await expect(page.getByRole('dialog', { name: '亮度' })).toContainText('庙');
  await page.keyboard.press('Escape');
});

test('问 AI：复制的材料含内核按主题取材的原文，五个网站的链接；就这一步问 AI 填好问题', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await context.route('https://chat.deepseek.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<title>stub</title>' }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(SAMPLE);
  const read = side(page);
  await page.getByRole('group', { name: '主题' }).getByRole('button', { name: '事业' }).click();
  const sites = read.getByRole('region', { name: '问 AI' }).getByRole('link');
  await expect(sites).toHaveText(['DeepSeek', '豆包', 'Kimi', 'ChatGPT', 'Claude']);
  expect(await sites.evaluateAll((a) => a.map((x) => [x.getAttribute('href'), x.getAttribute('target'), x.getAttribute('rel')]))).toEqual(
    ['https://chat.deepseek.com/', 'https://www.doubao.com/chat/', 'https://www.kimi.com/', 'https://chatgpt.com/', 'https://claude.ai/new'].map((h) => [h, '_blank', 'noopener noreferrer']),
  );
  const popup = page.waitForEvent('popup');
  await sites.first().click();
  expect((await popup).url()).toBe('https://chat.deepseek.com/');
  await expect(page.getByRole('status').filter({ hasText: /^已复制 [\d,]+ 字，在 DeepSeek 里粘贴后发送$/ })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());

  await kernel.init();
  const chart = kernel.astro.bySolar('2000-8-16', 2, 'female');
  const topicText = chart.topicToText('career', { knowledge: kernel.KnowledgePack.builtin('zh-CN'), knowledgeDepth: 'summary' });
  expect(copied.startsWith('你在陪用户聊紫微斗数')).toBe(true);
  expect(copied).toContain(topicText);
  expect(copied).toMatch(/# 我的问题\n\n请按解读方法，从「事业」看看这张盘。$/);

  const q = read.getByRole('textbox', { name: '你想问什么' });
  await q.fill('我先写的问题');
  await step(page, 2).getByRole('button', { name: '就这一步问 AI' }).click();
  await expect(q).toHaveValue('我先写的问题\n从「三方四正」这一步看我的事业，该怎么理解？');
  await expect(q).toBeFocused();
});

test('在这页问：有 Key 时右栏换成对话、预填问题，「回到…」回到阅读', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/zh/install');
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('xzw-chat', 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore('state').put({ provider: 'deepseek', key: 'sk-good', baseURL: null, model: 'deepseek-flash', models: [{ id: 'deepseek-flash', tools: true, context: 128000 }] }, 'settings');
          req.result.createObjectStore('conversations', { keyPath: 'id' });
        };
        req.onsuccess = () => {
          req.result.close();
          resolve();
        };
        req.onerror = () => reject(req.error);
      }),
  );
  await page.goto(SAMPLE);
  const read = side(page);
  await expect(read).toContainText('你填过 DeepSeek 的 Key，可以直接在这页问。');
  await read.getByRole('button', { name: '在这页问 deepseek-flash' }).click();
  await expect(read.getByRole('textbox', { name: '问这张盘' })).toHaveValue('从「总论」看，这张盘怎么样？');
  await expect(read.getByRole('textbox', { name: '问这张盘' })).toBeFocused();
  await read.getByRole('button', { name: '‹ 回到「总论」' }).click();
  await expect(read.getByRole('heading', { level: 2 })).toHaveText('总论');
  await expect(read.getByRole('button', { name: '在这页问 deepseek-flash' })).toBeFocused();
  // 点盘上的宫：对话开着时先回到阅读。
  await read.getByRole('button', { name: /^在这页问/ }).click();
  await page.getByRole('button', { name: /^官禄，/ }).click();
  await expect(read.getByRole('heading', { level: 2 })).toHaveText('事业');
});

test('全文视图：目录、渲染与原文、复制；Esc 关闭后焦点回到「看全文」', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(SAMPLE);
  const open = side(page).getByRole('button', { name: '看全文' });
  await open.click();
  const dialog = page.getByRole('dialog', { name: '「总论」的提示词' });
  const toc = dialog.getByRole('navigation', { name: '提示词的段落' });
  await expect(toc.getByRole('button', { name: '怎么聊' })).toHaveAttribute('aria-current', 'location');
  await expect(page.locator('main')).toHaveCSS('visibility', 'hidden');
  await dialog.getByRole('radio', { name: '原文' }).click();
  await dialog.getByRole('button', { name: '复制提示词' }).click();
  await expect(dialog.getByRole('button', { name: '已复制' })).toBeVisible();
  expect((await page.evaluate(() => navigator.clipboard.readText())).startsWith('你在陪用户聊紫微斗数')).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
});

test('手机：生辰 → 盘 → 看什么 → 看哪段时间 → 阅读；底栏选主题、跳到问 AI；小盘点了回到大盘', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(SAMPLE);
  const board = page.getByRole('button', { name: /^命宫，/ });
  await expect(board).toBeVisible();
  const top = async (loc: ReturnType<typeof page.locator>) => (await loc.boundingBox())!.y;
  const topics = page.getByRole('region', { name: '看什么' });
  const when = page.getByRole('region', { name: '看哪段时间' });
  expect(await top(board)).toBeLessThan(await top(topics));
  expect(await top(topics)).toBeLessThan(await top(when));
  expect(await top(when)).toBeLessThan(await top(side(page)));
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  // 宽屏的「盘上看」与「问 AI」在手机上由小盘与底栏承担。
  await expect(step(page, 1).getByRole('button', { name: '盘上看', exact: true })).toBeHidden();

  await page.getByRole('button', { name: /^看什么/ }).click();
  await page.getByRole('dialog', { name: '看什么' }).getByRole('option', { name: '婚恋' }).click();
  await expect(side(page).getByRole('heading', { level: 2 })).toHaveText('婚恋');
  await expect(side(page).getByRole('heading', { level: 2 })).toBeFocused();

  const mini = step(page, 2).getByRole('button', { name: /^到盘上看这一步的宫：/ });
  await mini.click();
  await expect(step(page, 2)).toHaveAttribute('data-on', '');
  await expect(board).toBeInViewport();

  await page.getByRole('button', { name: '问 AI', exact: true }).last().click();
  await expect(side(page).getByRole('textbox', { name: '你想问什么' })).toBeFocused();
  await expect(side(page).getByRole('textbox', { name: '你想问什么' })).toBeInViewport();
});

test('未排盘：右栏写怎么开始；整张盘的完整提示词在全文视图里可按原文读', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/zh/chart');
  await expect(side(page).getByRole('heading', { name: '排盘后在这里读' })).toBeVisible();
  await page.goto(SAMPLE);
  const raw = await openPromptRaw(page, 'chart');
  await expect(raw).toContainText('# 我的问题');
  await closePrompt(page);
});
