import { type BrowserContext, type Locator, type Page, expect, test as base } from '@playwright/test';

export { expect, type Locator, type Page } from '@playwright/test';

/** 把 Cloudflare Web Analytics 的统计脚本换成空脚本、上报一律返回 204：测试不依赖外网，也不往统计里写数据。 */
export async function stubAnalytics(context: BrowserContext): Promise<void> {
  await context.route('https://static.cloudflareinsights.com/**', (r) => r.fulfill({ contentType: 'text/javascript', body: '' }));
  await context.route('https://cloudflareinsights.com/**', (r) => r.fulfill({ status: 204 }));
}

/** 各用例共用的 `test`：默认的浏览器上下文已换掉统计脚本（见 `stubAnalytics`）；用例自建的上下文要自己调用。 */
export const test = base.extend<{ stubbedAnalytics: void }>({
  stubbedAnalytics: [
    async ({ context }, use) => {
      await stubAnalytics(context);
      await use();
    },
    { auto: true },
  ],
});

/** 运限层的分段控件里的一项（「本命」「大限」「流年」「流月」）；看盘的子页签也有「大限」「流年」，不混用。 */
export function layerTab(page: Page, name: string): Locator {
  return page.getByRole('radiogroup', { name: '运限层' }).getByRole('radio', { name });
}

/** 打开提示词全文并切到原文，返回正文区；用完按 Esc 关闭（`closePrompt`）。 */
export async function openPromptRaw(page: Page): Promise<Locator> {
  await page.getByRole('tab', { name: '提示词' }).click();
  await page.getByRole('button', { name: /^查看全文/ }).click();
  const dialog = page.getByRole('dialog', { name: '提示词全文' });
  await dialog.getByRole('radio', { name: '原文' }).click();
  await expect(dialog.getByRole('radio', { name: '原文' })).toBeChecked();
  return dialog.getByRole('document', { name: '提示词全文' });
}

export async function closePrompt(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '提示词全文' })).toHaveCount(0);
}
