import { type BrowserContext, test as base } from '@playwright/test';

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
