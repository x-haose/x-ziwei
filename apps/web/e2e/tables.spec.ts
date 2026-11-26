import { type Page, expect, test } from './test';

/**
 * 窄屏上的表格保持行列：同一行的单元格上沿对齐（不被拆成一格一行）；表格放不下时只在自己的容器里横向滚动，
 * 页面本身不横向溢出。
 */
async function checkTables(page: Page, where: string) {
  const r = await page.evaluate(() => {
    const tables = [...document.querySelectorAll('table')];
    return {
      count: tables.length,
      brokenRows: tables.flatMap((t) =>
        [...t.querySelectorAll('tr')]
          .filter((tr) => {
            const tops = [...tr.children].map((c) => c.getBoundingClientRect().top);
            return Math.max(...tops) - Math.min(...tops) > 1;
          })
          .map((tr) => tr.textContent),
      ),
      notTable: tables.filter((t) => getComputedStyle(t.querySelector('td')!).display !== 'table-cell').length,
      unscrollable: tables.filter((t) => {
        const wrap = t.parentElement!;
        return t.scrollWidth > wrap.clientWidth + 1 && getComputedStyle(wrap).overflowX !== 'auto';
      }).length,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(r.count, `${where} 没有表格`).toBeGreaterThan(0);
  expect(r.brokenRows, `${where} 单元格不在同一行`).toEqual([]);
  expect(r.notTable, where).toBe(0);
  expect(r.unscrollable, `${where} 表格越出容器却不能滚动`).toBe(0);
  expect(r.pageOverflow, `${where} 页面横向溢出`).toBe(0);
}

test.use({ viewport: { width: 375, height: 800 } });

test('375 宽：提示词全文渲染态的表格保持行列', async ({ page }) => {
  await page.goto('/zh/chart#cal=solar&d=2000-8-16&t=2&g=f');
  await expect(page.getByRole('button', { name: /^命宫，/ })).toBeVisible();
  await page.getByRole('tab', { name: '提示词' }).click();
  await page.getByRole('button', { name: /^查看全文/ }).click();
  await expect(page.getByRole('dialog', { name: '提示词全文' }).getByRole('radio', { name: '渲染' })).toBeChecked();
  await checkTables(page, '提示词全文');
});

test('375 宽：看盘的大限与流年一览保持行列，页面不横向溢出', async ({ page }) => {
  await page.goto('/zh/chart#cal=solar&d=2000-8-16&t=2&g=f');
  await expect(page.getByRole('button', { name: /^命宫，/ })).toBeVisible();
  const views = page.getByRole('radiogroup', { name: '看盘的内容' });
  await views.getByRole('radio', { name: '大限' }).click();
  await checkTables(page, '看盘大限');
  await views.getByRole('radio', { name: '流年' }).click();
  await checkTables(page, '看盘流年');
});

for (const path of ['/zh/tools', '/en/api', '/zh/knowledge/format', '/zh/self-host']) {
  test(`375 宽：帮助页 ${path} 的表格保持行列`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await checkTables(page, path);
  });
}
