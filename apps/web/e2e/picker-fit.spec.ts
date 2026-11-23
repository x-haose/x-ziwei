import { type Locator, expect, test } from './test';

/**
 * 选择器弹层在矮窗口里：弹层整个在视口内、内容区能滚到最后一项、选项文字不溢出各自的边框；
 * 时辰弹层的时段名与钟点各自不折行。
 */

const TRIGGERS = [/^出生年份/, /^出生月份/, /^出生日/, /^出生时辰/, /^选流年/];

/** 弹层（桌面是 Popover，手机是底部面板）即对话框的父元素，React Aria 给它写入按可用空间算出的最大高度。 */
async function checkDialog(dialog: Locator, name: string) {
  const r = await dialog.evaluate((el) => {
    const shell = el.parentElement!;
    const rect = (e: Element) => {
      const b = e.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, left: b.left, right: b.right };
    };
    const lines = (e: Element) => {
      const range = document.createRange();
      range.selectNodeContents(e);
      return new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size;
    };
    const options = [...el.querySelectorAll('[role="option"]')] as HTMLElement[];
    options.at(-1)!.scrollIntoView({ block: 'nearest' });
    return {
      shell: rect(shell),
      dialog: rect(el),
      viewport: { w: window.innerWidth, h: window.innerHeight },
      last: rect(options.at(-1)!),
      overflowing: options.filter((o) => o.scrollWidth > o.clientWidth + 1).map((o) => o.textContent),
      wrapped: [...el.querySelectorAll('[role="option"] b, [role="option"] small')].filter((e) => lines(e) > 1).map((e) => e.textContent),
    };
  });
  expect(r.shell.top, `${name} 上沿`).toBeGreaterThanOrEqual(0);
  expect(r.shell.left, `${name} 左沿`).toBeGreaterThanOrEqual(0);
  expect(r.shell.bottom, `${name} 下沿`).toBeLessThanOrEqual(r.viewport.h);
  expect(r.shell.right, `${name} 右沿`).toBeLessThanOrEqual(r.viewport.w);
  expect(r.dialog.bottom, `${name} 内容越出弹层下沿`).toBeLessThanOrEqual(r.shell.bottom + 0.5);
  expect(r.last.top, `${name} 最后一项`).toBeGreaterThanOrEqual(r.shell.top);
  expect(r.last.bottom, `${name} 最后一项`).toBeLessThanOrEqual(r.shell.bottom + 0.5);
  expect(r.overflowing, `${name} 选项文字越出选项`).toEqual([]);
  expect(r.wrapped, `${name} 选项文字折行`).toEqual([]);
}

for (const [width, height] of [
  [1440, 700],
  [1280, 600],
  [375, 560],
] as const) {
  test(`${width}×${height}：年、月、日、时辰、流年弹层都在视口内，可滚到最后一项`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/zh/chart#cal=solar&d=2000-8-16&p=night&h=2&g=f');
    await expect(page.getByRole('button', { name: /^命宫，/ })).toBeVisible();
    await page.locator('button[aria-expanded="false"]').filter({ hasText: '修改' }).click();
    for (const name of TRIGGERS) {
      const trigger = page.getByRole('button', { name });
      await trigger.scrollIntoViewIfNeeded();
      await trigger.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await checkDialog(dialog, String(name));
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    }
  });
}
