import { expect, side, test, type Page } from './test';

/** 知识包编辑器（设计规范第 20 节）：从看盘直达、第一屏、校验与保存、知识包页的入口与草稿区。 */

const SAMPLE = '/zh/chart#cal=solar&d=2000-8-16&t=2&g=f';

async function rewriteZiwei(page: Page) {
  await page.goto(SAMPLE);
  await side(page).getByRole('link', { name: '改写这一条：紫微' }).click();
  await expect(page.getByRole('heading', { level: 2, name: /^紫微/ })).toBeVisible();
}

test('从看盘「改写这一条」直达：写进叠在默认包上的新包；离开时保存并用上，回到看盘就用上改写', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await rewriteZiwei(page);
  // 生辰只在 # 之后，不进查询串。
  expect(new URL(page.url()).search).not.toMatch(/2000|8-16|cal=|d=/);
  await expect(page.getByText(/^写进新包「我的释义」（my-pack）：叠在 iztro-docs 上面/)).toBeVisible();
  await expect(page.getByText('沿用 iztro-docs', { exact: true })).toBeVisible();
  // 左栏：宫位行写地支加「宫」，四化行写段名。
  const list = page.getByRole('complementary', { name: '条目' });
  await expect(list.getByRole('button', { name: /^命宫\s*午宫/ })).toBeVisible();
  await expect(list.getByRole('button', { name: /^禄\s*四化/ })).toBeVisible();
  await page.getByRole('button', { name: '改写' }).first().click();
  const body = page.getByRole('textbox', { name: '正文' });
  await expect(body).toBeFocused();
  await body.fill('我改写的紫微。');
  await expect(page.getByText(/^草稿已存 \d\d:\d\d，还没进包库$/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^改 / })).toHaveCount(0);

  await page.getByRole('link', { name: '‹ 看盘' }).click();
  const leave = page.getByRole('alertdialog', { name: '这个包还没进包库' });
  await expect(leave.getByRole('button', { name: '继续编辑' })).toBeFocused();
  await leave.getByRole('button', { name: '保存并用上，回到看盘' }).click();
  await expect(page).toHaveURL(SAMPLE);
  await expect(side(page)).toContainText('我改写的紫微。');
  await expect(side(page)).toContainText('释义摘自知识包「iztro-docs + 我的释义」');

  // 再改写一次：生效组合最上面是自己保存过的包，直接改它。
  await side(page).getByRole('link', { name: '改写这一条：紫微' }).click();
  await expect(page.getByText(/^写进新包/)).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: '正文' })).toHaveValue('我改写的紫微。');
  await expect(page.getByText('与包库一致')).toBeVisible();
});

test('校验沿用内核：正文里的 HTML 标签必须改，保存不可用并写明原因；点问题跳到那个字段', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await rewriteZiwei(page);
  const save = page.getByRole('button', { name: '保存到包库' });
  await expect(save).toBeDisabled();
  await expect(page.getByText('还没有写任何条目。')).toBeVisible();
  await page.getByRole('button', { name: '改写' }).first().click();
  await page.getByRole('textbox', { name: '正文' }).fill('紫微<b>帝王</b>。');
  await expect(page.getByRole('button', { name: /^\d+ 处必须改/ })).toBeVisible();
  await expect(save).toBeDisabled();
  await expect(page.getByText(/^还有 \d+ 处必须改，改好才能保存到包库；草稿已自动存在本机。$/)).toBeVisible();
  await page.getByRole('tab', { name: /^问题/ }).click();
  await page.locator('button[data-level="error"]').first().click();
  const body = page.getByRole('textbox', { name: '正文' });
  await expect(body).toBeFocused();
  // 选中正文里出问题的那一段。
  expect(await body.evaluate((el: HTMLTextAreaElement) => el.value.slice(el.selectionStart, el.selectionEnd))).toBe('<b>');
  await page.getByRole('textbox', { name: '正文' }).fill('紫微帝王。');
  await expect(save).toBeEnabled();
});

test('第一屏：写进的包、从一张盘、从一个主题、空白开始；新建空白包没有对照，写一条后能保存', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(SAMPLE);
  await expect(side(page).getByRole('heading', { level: 2 })).toHaveText('总论');
  await page.goto('/zh/knowledge/write');
  await expect(page.getByRole('heading', { level: 1, name: '写自己的释义' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^写进/ })).toContainText('新包（叠在 iztro-docs 上）');
  await expect(page.getByText(/^这张盘用到 \d+ 条：改写了 0 条，其余 \d+ 条沿用 iztro-docs。$/)).toBeVisible();

  await page.getByRole('region', { name: '从一个主题开始' }).getByRole('button', { name: /^事业/ }).click();
  await expect(page.getByRole('radiogroup', { name: '列哪些条目' }).getByRole('radio', { name: '事业' })).toBeChecked();
  await expect(page.getByRole('complementary', { name: '条目' }).getByRole('button', { name: /^事业/ })).toBeVisible();

  await page.goto('/zh/knowledge/write');
  await page.getByRole('button', { name: /^新建空白知识包/ }).click();
  const dialog = page.getByRole('dialog', { name: '新建知识包' });
  await dialog.getByRole('button', { name: '开始编辑' }).click();
  await expect(dialog.getByText('要写名称')).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: '名称' })).toBeFocused();
  await dialog.getByRole('textbox', { name: '名称' }).fill('我的门派');
  await dialog.getByRole('textbox', { name: '标识' }).fill('iztro-docs');
  await dialog.getByRole('button', { name: '开始编辑' }).click();
  await expect(dialog.getByText('不能用 iztro-docs')).toBeVisible();
  await dialog.getByRole('textbox', { name: '标识' }).fill('my-school');
  await dialog.getByRole('button', { name: '开始编辑' }).click();
  await expect(page.getByText('这是一份新知识包')).toBeVisible();
  await page.getByRole('complementary', { name: '条目' }).getByRole('button', { name: /^紫微/ }).click();
  await expect(page.getByText('这一条还没写。')).toBeVisible();
  await page.getByRole('button', { name: '写这一条' }).click();
  await page.locator('[data-field="intro"]').getByRole('button', { name: '写这一项' }).click();
  await page.getByRole('textbox', { name: '正文' }).fill('门派说紫微。');
  await page.getByRole('button', { name: '保存到包库' }).click();
  await expect(page.getByRole('status').filter({ hasText: '已保存「我的门派」' })).toBeVisible();
  await expect(page.getByText('它现在还没生效。')).toBeVisible();
  await page.getByRole('button', { name: '加入生效组合' }).click();
  await expect(page.getByText('它现在还没生效。')).toHaveCount(0);
});

test('知识包页：「写自己的释义」入口；用户包可编辑，没保存的草稿列在草稿区，可丢弃', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await rewriteZiwei(page);
  await page.getByRole('button', { name: '改写' }).first().click();
  await page.getByRole('textbox', { name: '正文' }).fill('草稿里的紫微。');
  await expect(page.getByText(/^草稿已存/)).toBeVisible();
  await page.getByRole('link', { name: '‹ 看盘' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '留作草稿，离开' }).click();
  await expect(page).toHaveURL(SAMPLE);

  await page.goto('/zh/knowledge');
  await expect(page.getByRole('link', { name: '写自己的释义' })).toHaveAttribute('href', '/zh/knowledge/write');
  const drafts = page.getByRole('region', { name: '草稿' });
  await expect(drafts).toContainText('我的释义');
  await expect(drafts).toContainText('还没进包库');
  await drafts.getByRole('button', { name: '继续编辑' }).click();
  await expect(page.getByRole('heading', { level: 2, name: /^紫微|这一条/ }).or(page.getByText('从左边挑一条改写'))).toBeVisible();
  await page.getByRole('link', { name: '‹ 知识包' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '留作草稿，离开' }).click();
  await drafts.getByRole('button', { name: '丢弃' }).click();
  const confirm = page.getByRole('alertdialog', { name: '丢弃草稿「我的释义」？' });
  await expect(confirm.getByRole('button', { name: '取消' })).toBeFocused();
  await confirm.getByRole('button', { name: '丢弃' }).click();
  await expect(drafts).toHaveCount(0);
});

test('内核没装好：编辑器左栏只有包信息，中栏写明在加载并有进度条，装好后照常编辑', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await rewriteZiwei(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 20, downloadThroughput: 300 * 1024, uploadThroughput: -1 });
  await page.reload();
  await expect(page.getByRole('progressbar', { name: '排盘内核加载中' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: '条目' }).getByRole('button')).toHaveText([/^包信息/]);
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await expect(page.getByRole('heading', { level: 2, name: /^紫微/ })).toBeVisible({ timeout: 20000 });
});

test('改完立刻保存：待写的草稿先写下，保存后过一会儿草稿仍与包库一致，不被自动写入改回新包', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await rewriteZiwei(page);
  await page.getByRole('button', { name: '改写' }).first().click();
  await page.getByRole('textbox', { name: '正文' }).fill('立刻保存的紫微。');
  await page.getByRole('button', { name: '保存到包库' }).click();
  await expect(page.getByText(/^已保存到包库 \d\d:\d\d$/)).toBeVisible();
  await page.waitForTimeout(2000);
  await expect(page.getByText(/^已保存到包库 \d\d:\d\d$/)).toBeVisible();
  await page.goto('/zh/knowledge');
  await expect(page.getByRole('region', { name: '草稿' })).toHaveCount(0);
  await page.getByRole('group', { name: /我的释义/ }).getByRole('button', { name: '编辑' }).click();
  await expect(page.getByText('与包库一致')).toBeVisible();
  await expect(page.getByRole('button', { name: '保存到包库' })).toBeDisabled();
});

test('改完立刻离开：先把待写的写下再离开，草稿里有这次的改动；一条都没写的新包离开不拦', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await rewriteZiwei(page);
  await page.getByRole('link', { name: '‹ 看盘' }).click();
  await expect(page).toHaveURL(SAMPLE);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);

  await side(page).getByRole('link', { name: '改写这一条：紫微' }).click();
  await page.getByRole('button', { name: '改写' }).first().click();
  await page.getByRole('textbox', { name: '正文' }).fill('马上离开前写的紫微。');
  await page.getByRole('link', { name: '‹ 看盘' }).click();
  const leave = page.getByRole('alertdialog', { name: '这个包还没进包库' });
  await expect(leave).toContainText(/草稿已存在本机（\d\d:\d\d）/);
  await leave.getByRole('button', { name: '留作草稿，离开' }).click();
  await side(page).getByRole('link', { name: '改写这一条：紫微' }).click();
  await expect(page.getByRole('textbox', { name: '正文' })).toHaveValue('马上离开前写的紫微。');
});

test('删掉正在编辑的包：草稿留着并写明包已删除；重新导入同标识的包后，旧草稿不能打开来覆盖它', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await rewriteZiwei(page);
  await page.getByRole('button', { name: '改写' }).first().click();
  await page.getByRole('textbox', { name: '正文' }).fill('先存的紫微。');
  await page.getByRole('button', { name: '保存到包库' }).click();
  await expect(page.getByText(/^已保存到包库/)).toBeVisible();
  await page.getByRole('textbox', { name: '正文' }).fill('后改的紫微。');
  await expect(page.getByText(/^草稿已存 .*包库里还是旧版本$/)).toBeVisible();

  await page.goto('/zh/knowledge');
  await page.getByRole('group', { name: /我的释义/ }).getByRole('button', { name: '删除' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: /删除/ }).last().click();
  const drafts = page.getByRole('region', { name: '草稿' });
  await expect(drafts).toContainText('这个包已被删除');
  await drafts.getByRole('button', { name: '继续编辑' }).click();
  await expect(page.getByText(/已被删除：这份草稿不能再存回去/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '保存到包库' })).toBeDisabled();
  await page.getByRole('link', { name: '‹ 知识包' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '留作草稿，离开' }).click();

  await page.getByRole('tab', { name: '粘贴 JSON' }).click();
  await page.getByRole('textbox', { name: '粘贴知识包 JSON' }).fill(JSON.stringify({ schema: 1, id: 'my-pack', version: 'imported', language: 'zh-CN', extends: 'iztro-docs', source: { name: '导入的包' }, stars: { ziweiMaj: { intro: '导入的紫微。' } } }));
  await page.getByRole('button', { name: '校验并导入' }).click();
  await expect(page.getByText('已导入「导入的包」')).toBeVisible();
  await page.getByRole('group', { name: /导入的包/ }).getByRole('button', { name: '编辑' }).click();
  await expect(page.getByRole('status').filter({ hasText: /草稿区里有一份编辑「导入的包」的草稿/ })).toBeVisible();
  await expect(page).toHaveURL(/\/zh\/knowledge$/);
});

test('地址里的条目不对时写明原因、给回第一屏的入口，不打开条目', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [q, reason] of [
    ['entry=foo/bar', '段不是'],
    ['entry=stars/notAStar', '这一段里没有这个标识'],
    ['entry=stars/ziweiMaj/x', '段不是'],
    ['entry=stars/ziweiMaj&combo=wenquMin', '组合的对方要是另一颗主星'],
  ] as const) {
    await page.goto(`/zh/knowledge/write?${q}`);
    const alert = page.getByRole('alert');
    await expect(alert).toContainText(`地址里的条目不对：${reason}`);
    await expect(alert.getByRole('link', { name: '回到「写自己的释义」' })).toBeVisible();
  }
});

test('两个标签页改同一份草稿：后写的那页报冲突，不覆盖先写的', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await rewriteZiwei(page);
  const other = await context.newPage();
  await other.setViewportSize({ width: 1440, height: 900 });
  await other.goto(page.url());
  await other.getByRole('button', { name: '改写' }).first().click();
  await other.getByRole('textbox', { name: '正文' }).fill('另一页写的紫微。');
  await expect(other.getByText(/^草稿已存/)).toBeVisible();
  await page.getByRole('button', { name: '改写' }).first().click();
  await page.getByRole('textbox', { name: '正文' }).fill('这一页写的紫微。');
  await expect(page.getByText('别的标签页改过这份草稿，这一页的改动没存下')).toBeVisible();
  await expect(page.getByRole('button', { name: '另存为新包' }).first()).toBeVisible();
});

test('本机存储不可用：看盘没有「改写这一条」，编辑器写明原因而不是一直显示加载中', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(SAMPLE);
  await expect(side(page).getByRole('heading', { level: 2 })).toHaveText('总论');
  await expect(side(page).getByRole('link', { name: /^改写这一条/ })).toHaveCount(0);
  await page.goto('/zh/knowledge/edit?draft=x&from=knowledge');
  await expect(page.getByRole('alert')).toContainText('这个浏览器不让本页存数据');
});
