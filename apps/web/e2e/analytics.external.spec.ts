import { type Birth, encodeBirth } from '../app/birth/birth';
import { expect, test } from './test';

/**
 * 依赖外网的用例：用 Cloudflare 线上的统计脚本（没有版本号，随时可能更新）复验上报里不带生辰。
 * 单独成 Playwright 项目 external（见 playwright.config.ts），带有限重试，CI 里与其他用例分开跑。
 * 失败时先看报的是哪一种：统计脚本不可达（外网问题），还是上报里带了 # 之后的内容（真问题）。
 */

const BEACON = 'https://static.cloudflareinsights.com/beacon.min.js';

/** 用例里打开过的盘：时段候选两张（p=、h=）与一张带闰月、确定时辰的农历盘（leap=1、t=）。 */
const NIGHT: Birth = { cal: 'solar', year: 2000, month: 8, leap: false, day: 16, time: { kind: 'period', period: 'night', pick: 1 }, gender: 'f' };
const NIGHT_PICKED: Birth = { ...NIGHT, time: { kind: 'period', period: 'night', pick: 2 } };
const LEAP: Birth = { cal: 'lunar', year: 2020, month: 4, leap: true, day: 3, time: { kind: 'hour', index: 2 }, gender: 'm' };

test('统计上报只有路径：生辰在 # 之后，首次载入、换候选、前端跳转、后退与另开一张盘都不进上报', async ({ context, page, request }) => {
  const res = await request.get(BEACON).catch((err: unknown) => {
    throw new Error(`外网不可达：取不到统计脚本 ${BEACON}（${String(err)}）`);
  });
  if (!res.ok()) throw new Error(`外网不可达：统计脚本 ${BEACON} 返回 HTTP ${res.status()}`);
  const script = await res.text();
  // 用线上的统计脚本（覆盖默认的空脚本），上报照旧拦下、不发出。
  await context.route('https://static.cloudflareinsights.com/**', (r) => r.fulfill({ contentType: 'text/javascript', body: script }));
  const reports: string[] = [];
  await context.route('https://cloudflareinsights.com/**', (r) => {
    reports.push(r.request().postData() ?? '');
    return r.fulfill({ status: 204 });
  });
  await page.goto(`/zh/chart#${encodeBirth(NIGHT)}`);
  await expect(page.getByRole('button', { name: /^命宫，/ })).toBeVisible();
  await page.getByRole('radiogroup', { name: '候选时辰' }).getByRole('radio', { name: '寅' }).click();
  await page.getByRole('link', { name: '装进 AI' }).first().click();
  await expect(page).toHaveURL(/\/zh\/install$/);
  await page.goBack();
  await expect(page).toHaveURL(`/zh/chart#${encodeBirth(NIGHT_PICKED)}`);
  await page.goto('/zh/install');
  await page.goto(`/zh/chart#${encodeBirth(LEAP)}`);
  await expect(page.getByRole('button', { name: /^命宫，/ })).toBeVisible();
  await expect.poll(() => reports.length, { message: '统计脚本没有发出上报（脚本行为变了？）' }).toBeGreaterThanOrEqual(4);
  // 每张盘的地址片段（原样与百分号编码后）及其中每一项都不能出现。「#」本身会出现在统计脚本记下的页面元素选择器里（如 `#react-aria-…`），
  // 地址里有没有 # 由下面逐条核对。
  const fragments = [NIGHT, NIGHT_PICKED, LEAP].map(encodeBirth);
  const needles = [...new Set([...fragments, ...fragments.flatMap((f) => f.split('&'))].flatMap((f) => [f, encodeURIComponent(f)]))];
  for (const r of reports) for (const n of needles) expect(r.includes(n), `上报里带了 # 之后的内容（生辰）：${n}`).toBe(false);
  const locations = reports.flatMap((r) => [...r.matchAll(/"(?:location|referrer|path)":"([^"]*)"/g)].map((m) => m[1]));
  expect(locations.length).toBeGreaterThan(0);
  for (const l of locations) expect(l, '上报的地址不只是路径').toMatch(/^(http:\/\/localhost:4173)?\/zh\/(chart|install)$/);
});
