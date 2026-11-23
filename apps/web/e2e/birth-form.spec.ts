import { expect, test } from './test';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/zh/chart');
  await page.waitForLoadState('networkidle');
});

test('年份：回车打开、焦点落在第一项、直接键入跳到该年、回车选中并把焦点还给触发钮', async ({ page }) => {
  const trigger = page.getByRole('button', { name: '出生年份' });
  await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: '出生年份' });
  await expect(dialog).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(dialog.getByRole('listbox', { name: '1990 年代的年份' })).toBeVisible();
  await expect(dialog.getByRole('option', { name: '1990' })).toBeFocused();
  await page.keyboard.type('198');
  await expect(dialog.getByText('键入：198_')).toBeVisible();
  await expect(dialog.getByRole('listbox', { name: '1980 年代的年份' })).toBeVisible();
  await page.keyboard.type('7');
  await expect(dialog.getByRole('option', { name: '1987' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(trigger).toHaveAccessibleName('出生年份 1987');
  await expect(trigger).toBeFocused();
});

test('年份：PageDown 翻年代，页头切到年代总览再选回', async ({ page }) => {
  await page.getByRole('button', { name: '出生年份' }).click();
  const dialog = page.getByRole('dialog', { name: '出生年份' });
  await page.keyboard.press('PageDown');
  await expect(dialog.getByRole('listbox', { name: '2000 年代的年份' })).toBeVisible();
  await dialog.getByRole('button', { name: '2000 年代，点选切到年代总览' }).click();
  await dialog.getByRole('option', { name: '1950–1959' }).click();
  await expect(dialog.getByRole('listbox', { name: '1950 年代的年份' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: '出生年份' })).toBeFocused();
});

test('日：年月没选时不可用；月历按星期排，方向键按网格移动', async ({ page }) => {
  const day = page.getByRole('button', { name: '出生日' });
  await expect(day).toBeDisabled();
  await page.getByRole('button', { name: '出生年份' }).click();
  await page.getByRole('option', { name: '1990' }).click();
  await page.getByRole('button', { name: '出生月份' }).click();
  await expect(page.getByRole('option', { name: /^2 月/ })).toContainText('28 天');
  await page.getByRole('option', { name: /^8 月/ }).click();
  await expect(day).toBeEnabled();
  await day.click();
  const dialog = page.getByRole('dialog', { name: '1990 年 8 月' });
  // 1990-08-01 是星期三：第一项从第 3 列起
  await expect(dialog.getByRole('option', { name: '1', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(dialog.getByRole('option', { name: '8', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(dialog.getByRole('option', { name: '31', exact: true })).toBeFocused();
  await page.keyboard.press(' ');
  await expect(day).toHaveAccessibleName('出生日 31');
});

test('提交空表单：各字段报错并把焦点移到第一个出错的字段', async ({ page }) => {
  await expect(page.getByRole('radio', { name: '农历' })).toBeEnabled();
  await page.getByRole('button', { name: '排盘', exact: true }).click();
  const year = page.getByRole('button', { name: '出生年份' });
  await expect(year).toBeFocused();
  await expect(year).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('选出生年份')).toBeVisible();
  await expect(page.getByText('选时辰；不确定就选下方的大概时段')).toBeVisible();
  await expect(page.getByText('选性别')).toBeVisible();
});

test('改月份让已选的日失效时，立即报出', async ({ page }) => {
  await page.getByRole('button', { name: '出生年份' }).click();
  await page.keyboard.type('2001');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '出生月份' }).click();
  await page.getByRole('option', { name: /^1 月/ }).click();
  await page.getByRole('button', { name: '出生日' }).click();
  await page.getByRole('option', { name: '31', exact: true }).click();
  await page.getByRole('button', { name: '出生月份' }).click();
  await page.getByRole('option', { name: /^2 月/ }).click();
  await expect(page.getByText('2001 年 2 月只有 28 天')).toBeVisible();
  await expect(page.getByRole('button', { name: '出生日' })).toHaveAttribute('aria-invalid', 'true');
});

test('填好提交：生辰写进地址 # 之后并记进最近排过；带生辰的链接打开即预填', async ({ page }) => {
  await page.getByRole('button', { name: '出生年份' }).click();
  await page.keyboard.type('2000');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '出生月份' }).click();
  await page.getByRole('option', { name: /^8 月/ }).click();
  await page.getByRole('button', { name: '出生日' }).click();
  await page.getByRole('option', { name: '16', exact: true }).click();
  await expect(page.getByText('对应农历 二〇〇〇年七月十七')).toBeVisible();
  await page.getByRole('button', { name: '出生时辰' }).click();
  await page.getByRole('option', { name: /^夜里/ }).click();
  await expect(page.getByText('时辰未定，按所填日期排 4 张候选盘：早子（00:00–00:59）、丑（01:00–02:59）、寅（03:00–04:59）、晚子（23:00–23:59）')).toBeVisible();
  await page.getByRole('radio', { name: '女' }).click();
  await page.getByRole('button', { name: '排盘', exact: true }).click();
  await expect(page).toHaveURL('/zh/chart#cal=solar&d=2000-8-16&p=night&h=1&g=f');
  await expect(page.getByRole('radiogroup', { name: '候选时辰' }).getByRole('radio')).toHaveCount(4);
  // 表单收起后焦点落在生辰摘要上，不丢到页面开头。
  await expect(page.getByRole('button', { name: /2000-8-16 丑时/ })).toBeFocused();

  await page.goto('/zh/chart');
  await expect(page.getByRole('button', { name: /2000-8-16 夜里（时辰未定）/ })).toBeVisible();

  await page.goto('/zh/chart#cal=solar&d=1987-2-3&t=12&g=m');
  await page.getByRole('button', { name: /修改/ }).click();
  await expect(page.getByRole('button', { name: '出生年份 1987' })).toBeVisible();
  await expect(page.getByRole('button', { name: '出生时辰' })).toContainText('晚子时');
  await expect(page.getByRole('radio', { name: '男' })).toBeChecked();
});

test('农历：闰月单独一格，小月的三十不可选，换算出公历', async ({ page }) => {
  await page.getByRole('radio', { name: '农历' }).click();
  await page.getByRole('button', { name: '出生年份' }).click();
  await expect(page.getByRole('option', { name: '1990' })).toContainText('庚午');
  await page.keyboard.type('2020');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '出生月份' }).click();
  await expect(page.getByText('2020 年有闰四月')).toBeVisible();
  const months = (await page.getByRole('option').allTextContents()).map((m) => m.replace(/\d+ 天$/, ''));
  expect(months.indexOf('闰四月')).toBe(months.indexOf('四月') + 1);
  await page.getByRole('option', { name: '闰四月' }).click();
  await page.getByRole('button', { name: '出生日' }).click();
  await expect(page.getByText('这个月是小月，只有 29 天')).toBeVisible();
  await expect(page.getByRole('option', { name: /^三十/ })).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('option', { name: '初三' }).click();
  await expect(page.getByText('对应公历 2020-5-25')).toBeVisible();
  await page.getByRole('button', { name: '出生时辰' }).click();
  await page.getByRole('option', { name: /^寅时/ }).click();
  await page.getByRole('radio', { name: '女' }).click();
  await page.getByRole('button', { name: '排盘', exact: true }).click();
  await expect(page).toHaveURL('/zh/chart#cal=lunar&d=2020-4-3&leap=1&t=2&g=f');
  await expect(page.getByRole('button', { name: /农历二〇二〇年闰四月初三 寅时/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^命宫，/ })).toBeVisible();
});

test('地址里的生辰不合法时明确提示', async ({ page }) => {
  await page.goto('/zh/chart#cal=solar&d=2001-2-30&t=2&g=f');
  await expect(page.getByRole('status').filter({ hasText: '链接里的生辰不完整，请重新填写' })).toBeVisible();
});

test('手机上选择器是底部面板', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: '出生时辰' }).click();
  const dialog = page.getByRole('dialog', { name: '出生时辰' });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box && Math.round(box.y + box.height)).toBeGreaterThanOrEqual(800);
  expect(box && Math.round(box.width)).toBe(375);
});

test('选择器的无障碍名称包含当前值', async ({ page }) => {
  await page.getByRole('button', { name: '出生年份' }).click();
  await page.keyboard.type('1987');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: '出生年份 1987' })).toBeVisible();
});

test('可排范围按公历判断：农历日期换算到公历 2101 年时报错，不能提交', async ({ page }) => {
  await page.getByRole('radio', { name: '农历' }).click();
  await page.getByRole('button', { name: '出生年份' }).click();
  await page.keyboard.type('2100');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '出生月份' }).click();
  await page.getByRole('option', { name: /^腊月/ }).click();
  await page.getByRole('button', { name: '出生日' }).click();
  await page.getByRole('option', { name: '十五' }).click();
  await page.getByRole('button', { name: '排盘', exact: true }).click();
  await expect(page.getByText('超出可排范围：公历 1900–2100 年')).toBeVisible();
  await expect(page.getByRole('button', { name: /^出生年份/ })).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL('/zh/chart');
});

test('内核没装好时，排一次盘不会删掉本机已有的农历记录', async ({ page }) => {
  await page.route('**/*.wasm', (route) => route.abort());
  const lunarHash = 'cal=lunar&d=2020-4-3&leap=1&t=2&g=f';
  await page.evaluate((h) => localStorage.setItem('xzw-recent', JSON.stringify([{ hash: h, ts: 1 }])), lunarHash);
  await page.reload();
  await expect(page.getByText('农历记录，排盘内核装好后显示')).toBeVisible();
  await page.getByRole('button', { name: '出生年份' }).click();
  await page.keyboard.type('2000');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '出生月份' }).click();
  await page.getByRole('option', { name: /^8 月/ }).click();
  await page.getByRole('button', { name: '出生日' }).click();
  await page.getByRole('option', { name: '16', exact: true }).click();
  await page.getByRole('button', { name: '出生时辰' }).click();
  await page.getByRole('option', { name: /^寅时/ }).click();
  await page.getByRole('radio', { name: '女' }).click();
  await page.getByRole('button', { name: '排盘', exact: true }).click();
  await expect(page).toHaveURL(/#cal=solar/);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('xzw-recent')!) as { hash: string }[]);
  expect(stored.map((s) => s.hash)).toEqual(['cal=solar&d=2000-8-16&t=2&g=f', lunarHash]);
});
