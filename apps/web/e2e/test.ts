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

/** 运限层的分段控件里的一项（「本命」「大限」「流年」「流月」）。运限选择收在「选别的大限、年份或流月」后面，没展开时先展开。 */
export async function layerTab(page: Page, name: string): Promise<Locator> {
  const more = page.getByRole('button', { name: '选别的大限、年份或流月' });
  if ((await more.getAttribute('aria-expanded')) !== 'true') await more.click();
  return page.getByRole('radiogroup', { name: '运限层' }).getByRole('radio', { name });
}

/** 右栏（阅读，或开着的对话）。 */
export function side(page: Page): Locator {
  return page.getByRole('region', { name: '用这张盘' });
}

/** 打开提示词全文并切到原文，返回正文区；用完按 Esc 关闭（`closePrompt`）。`chart` 是页脚的整张盘，`topic` 是问 AI 的「看全文」。 */
export async function openPromptRaw(page: Page, which: 'chart' | 'topic' = 'chart'): Promise<Locator> {
  if (which === 'chart') await page.getByRole('button', { name: '整张盘的完整提示词' }).click();
  else await page.getByRole('button', { name: '看全文' }).click();
  const dialog = page.getByRole('dialog', { name: /提示词$/ });
  await dialog.getByRole('radio', { name: '原文' }).click();
  await expect(dialog.getByRole('radio', { name: '原文' })).toBeChecked();
  return dialog.getByRole('document');
}

export async function closePrompt(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /提示词$/ })).toHaveCount(0);
}

/** 在阅读末尾「在这页问」打开对话（≥1024 在右栏，更窄是全屏面板）。 */
export async function openChat(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^在这页问/ }).click();
}
