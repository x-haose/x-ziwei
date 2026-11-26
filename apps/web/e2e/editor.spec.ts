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
  await expect(page.getByRole('textbox', { name: '正文' })).toBeFocused();
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
