import { closePrompt, expect, layerTab, openPromptRaw, test } from './test';

/** 排盘页的「看盘 | 对话 | 提示词」三个页签（设计规范第 21 节）：看盘的内容取自内核，提示词全文视图，窄屏布局。 */

const SAMPLE = '/zh/chart#cal=solar&d=2000-8-16&t=2&g=f';

test('首次打开是看盘；页签切换后记住上次选的', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(SAMPLE);
  await expect(page.getByRole('tab', { name: '看盘', selected: true })).toBeVisible();
  const read = page.getByRole('tabpanel', { name: '看盘' });
  await expect(read.getByRole('heading', { level: 3 })).toHaveText('命宫');
  await page.getByRole('tab', { name: '提示词' }).click();
  await expect(page.getByRole('button', { name: /^查看全文/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('tab', { name: '提示词', selected: true })).toBeVisible({ timeout: 20000 });
  // 左栏只放输入：没有旧的读数区，释义标记在运限下面。
  await expect(page.getByLabel('选中宫的读数')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^释义：iztro-docs/ })).toBeVisible();
});

test('看盘：宫位的四化、主星释义、三方四正都随所选的宫与层变化；宫干飞出与三方四正可点', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(SAMPLE);
  const read = page.getByRole('tabpanel', { name: '看盘' });
  const title = read.getByRole('heading', { level: 3 });
  await expect(title).toHaveText('命宫');
  await expect(read).toContainText('壬午');
  await expect(read).toContainText('流年 2026流年命宫');
  await expect(read).toContainText('紫微化权→本宫（自化）');
  await expect(read).toContainText('帝王星');
  await read.getByRole('button', { name: '全文' }).first().click();
  await expect(read.getByRole('button', { name: '收起' })).toHaveAttribute('aria-expanded', 'true');

  // 宫干飞出的宫名可点：盘上选中那一宫，看盘停在宫位。
  await read.getByRole('button', { name: '子女' }).first().click();
  await expect(title).toHaveText('子女');
  await expect(page.getByRole('button', { name: /^子女，/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(read).toContainText('太阳');
  // 点盘上的宫只改看盘的内容，不切走页签（≥1024）。
  await page.getByRole('tab', { name: '提示词' }).click();
  await page.getByRole('button', { name: /^财帛，/ }).click();
  await expect(page.getByRole('tab', { name: '提示词', selected: true })).toBeVisible();
  await page.getByRole('tab', { name: '看盘' }).click();
  await expect(title).toHaveText('财帛');
  await expect(read).toContainText('武曲 × 天相');

  // 本命层时不列各层宫名。
  await layerTab(page, '本命').click();
  await page.getByRole('button', { name: /^命宫，/ }).click();
  await expect(read).not.toContainText('流年 2026');
  await expect(read).toContainText('生年四化没有落在这一宫');
});

test('看盘：格局按层分组；大限、流年一览点一行即切换盘上的运限', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(SAMPLE);
  const read = page.getByRole('tabpanel', { name: '看盘' });
  const views = read.getByRole('radiogroup', { name: '看盘的内容' });
  await views.getByRole('radio', { name: '格局' }).click();
  await expect(read).toContainText('府相朝垣');
  await expect(read.getByRole('heading', { name: /^大限 23–32 岁/ })).toBeVisible();

  await views.getByRole('radio', { name: '大限' }).click();
  await expect(read.getByRole('row', { name: /23–32.*现在/ })).toBeVisible();
  await read.getByRole('button', { name: '43–52' }).click();
  await expect(layerTab(page, '大限')).toBeChecked();
  await expect(page.getByRole('button', { name: /^财帛，/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status').filter({ hasText: '盘上：43–52 岁大限' })).toBeVisible();
  await expect(read.getByRole('button', { name: '43–52' })).toBeFocused();

  await views.getByRole('radio', { name: '流年' }).click();
  await expect(read).toContainText('43–52 岁大限 戊寅，2042–2051');
  await read.getByRole('button', { name: '上一个大限' }).click();
  await expect(read).toContainText('33–42 岁');
  await read.getByRole('button', { name: '2035' }).click();
  await expect(layerTab(page, '流年')).toBeChecked();
  await expect(page.getByText(/^流年 ..　2035　虚岁 36$/)).toBeVisible();
});

test('看盘底部「在对话里问」：切到对话页签并预填问题，不自动发送', async ({ page }) => {
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
  await page.getByRole('tabpanel', { name: '看盘' }).getByRole('button', { name: '在对话里问命宫' }).click();
  await expect(page.getByRole('tab', { name: '对话', selected: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '问这张盘' })).toHaveValue('这张盘的命宫怎么看');
  await expect(page.getByRole('log')).toContainText('问这张盘');
});

test('提示词全文：目录、渲染与原文、复制；Esc 关闭后焦点回到「查看全文」', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(SAMPLE);
  await page.getByRole('tab', { name: '提示词' }).click();
  await expect(page.getByText(/^会发送：解读方法、本命盘、2026 年运限、我的问题；释义按 iztro-docs。$/)).toBeVisible();
  const open = page.getByRole('button', { name: /^查看全文/ });
  await expect(open).toContainText(/\d[\d,]* 字/);
  await open.click();
  const dialog = page.getByRole('dialog', { name: '提示词全文' });
  const toc = dialog.getByRole('navigation', { name: '提示词的段落' });
  await expect(toc.getByRole('button', { name: '怎么聊' })).toHaveAttribute('aria-current', 'location');
  // 背后的页面不渲染。
  await expect(page.locator('main')).toHaveCSS('visibility', 'hidden');
  await toc.getByRole('button', { name: /^命盘 2000-8-16 寅时 女$/ }).click();
  await expect(toc.getByRole('button', { name: /^命盘 2000-8-16 寅时 女$/ })).toHaveAttribute('aria-current', 'location');
  await dialog.getByRole('radio', { name: '原文' }).click();
  await expect(dialog.getByRole('document')).toContainText('# 命盘 2000-8-16 寅时 女');
  await dialog.getByRole('button', { name: '复制提示词' }).click();
  await expect(dialog.getByRole('button', { name: '已复制' })).toBeVisible();
  expect((await page.evaluate(() => navigator.clipboard.readText())).startsWith('你在陪用户聊紫微斗数')).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
  await expect(page.locator('main')).toHaveCSS('visibility', 'visible');
});

test('窄屏：输入在上、盘在中、右栏在盘下；底栏三个按钮；在提示词页签点盘上的宫切到看盘', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(SAMPLE);
  const board = page.getByRole('button', { name: /^命宫，/ });
  await expect(board).toBeVisible();
  const top = async (loc: ReturnType<typeof page.locator>) => (await loc.boundingBox())!.y;
  const layer = page.getByRole('region', { name: '运限' });
  const side = page.getByRole('region', { name: '用这张盘' });
  expect(await top(layer)).toBeLessThan(await top(board));
  expect(await top(board)).toBeLessThan(await top(side));
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);

  const bar = page.getByRole('button', { name: '提示词', exact: true }).last();
  await bar.click();
  await expect(page.getByRole('tab', { name: '提示词', selected: true })).toBeVisible();
  await page.getByRole('button', { name: /^财帛，/ }).click();
  await expect(page.getByRole('tab', { name: '看盘', selected: true })).toBeVisible();
  await expect(page.getByRole('tabpanel', { name: '看盘' }).getByRole('heading', { level: 3 })).toHaveText('财帛');

  // 提示词全文在手机上：目录收进头部的按钮。
  await page.getByRole('tab', { name: '提示词' }).click();
  const raw = await openPromptRaw(page);
  await expect(raw).toContainText('# 我的问题');
  const dialog = page.getByRole('dialog', { name: '提示词全文' });
  const tocButton = dialog.getByRole('button', { name: /^目录/ });
  await expect(tocButton).toHaveAttribute('aria-expanded', 'false');
  await tocButton.click();
  await dialog.getByRole('navigation', { name: '提示词的段落' }).getByRole('button', { name: '我的问题' }).click();
  await expect(tocButton).toHaveAttribute('aria-expanded', 'false');
  await expect(tocButton).toContainText('我的问题');
  await closePrompt(page);
});

test('平板宽：同样单列，盘下是右栏，底栏有三个按钮', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1000 });
  await page.goto(SAMPLE);
  const board = page.getByRole('button', { name: /^命宫，/ });
  await expect(board).toBeVisible();
  const side = page.getByRole('region', { name: '用这张盘' });
  expect((await side.boundingBox())!.y).toBeGreaterThan((await board.boundingBox())!.y);
  for (const name of ['看盘', '对话', '提示词']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
});
