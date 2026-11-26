import type { APIRequestContext } from '@playwright/test';
import { type Page, expect, test } from './test';

/**
 * 排盘页的对话（设计规范第 19 节）。浏览器经代理直连本地的假厂商（见 playwright.config.ts 与 fake-vendor.ts），
 * 走真实的 fetch、跨域与 SSE 流式；问题里的标记（[slow]、[401] 等）决定假厂商怎么答。不请求真实厂商。
 */

const CHART = '/zh/chart#cal=solar&d=2000-8-16&t=2&g=f';

interface Seed {
  provider: 'deepseek' | 'openai' | 'anthropic' | 'compatible';
  key: string;
  baseURL?: string | null;
  model?: string;
  conversations?: unknown[];
}

/** 打开页面前往本机对话库写入设置（与对话）：省去每个用例都走一遍设置表单。 */
async function seed(page: Page, s: Seed) {
  await page.goto('/zh/install');
  await page.evaluate(
    ({ settings, conversations }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('xzw-chat', 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore('state');
          req.result.createObjectStore('conversations', { keyPath: 'id' });
        };
        req.onsuccess = () => {
          const tx = req.result.transaction(['state', 'conversations'], 'readwrite');
          tx.objectStore('state').put(settings, 'settings');
          for (const c of conversations) tx.objectStore('conversations').put(c);
          tx.oncomplete = () => {
            req.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
    {
      settings: {
        provider: s.provider,
        key: s.key,
        baseURL: s.baseURL ?? null,
        model: s.model ?? 'deepseek-flash',
        models: [
          { id: 'deepseek-flash', tools: s.provider === 'compatible' ? null : true, context: 128000 },
          { id: 'tiny-context', tools: s.provider === 'compatible' ? null : true, context: 3000 },
        ],
      },
      conversations: s.conversations ?? [],
    },
  );
}

/** 打开排盘页，在阅读末尾「在这页问」打开对话（≥1024 在右栏），清掉预填的问题。 */
async function openChat(page: Page) {
  await page.goto(CHART);
  await page.getByRole('button', { name: /^在这页问/ }).click();
  await expect(page.getByRole('textbox', { name: '问这张盘' })).toBeEnabled({ timeout: 20000 });
  await page.getByRole('textbox', { name: '问这张盘' }).fill('');
}

/** 没有 Key 时打开对话：右栏是设置表单。 */
async function openSetup(page: Page) {
  await page.goto(CHART);
  await page.getByRole('button', { name: /^在这页问/ }).click();
}

async function ask(page: Page, text: string) {
  await page.getByRole('textbox', { name: '问这张盘' }).fill(text);
  await page.getByRole('button', { name: '发送' }).click();
}

/** 假厂商收到的、最后一问含 `marker` 的请求。 */
async function vendorRequests(request: APIRequestContext, marker: string) {
  const all = (await (await request.get('http://127.0.0.1:9480/__requests')).json()) as {
    path: string;
    headers: Record<string, string>;
    body: { messages?: { role: string; content: unknown }[]; tools?: unknown[]; system?: unknown };
  }[];
  return all.filter((r) => JSON.stringify(r.body.messages ?? []).includes(marker));
}

const answer = (page: Page) => page.getByRole('log');

test('没有 Key 时对话页签是设置表单；检查通过即保存，模型取列表里第一个能查盘的', async ({ page }) => {
  await openSetup(page);
  await expect(page.getByRole('heading', { name: '用自己的 API Key 对话' })).toBeVisible();
  await page.getByLabel('API Key').fill('sk-bad');
  await page.getByRole('button', { name: '检查并保存' }).click();
  await expect(page.getByText('Key 无效（401）：DeepSeek 不认这个 Key。')).toBeVisible();
  await expect(page.getByRole('heading', { name: '用自己的 API Key 对话' })).toBeVisible();

  await page.getByLabel('API Key').fill('sk-good-1');
  await page.getByRole('button', { name: '检查并保存' }).click();
  await expect(page.getByRole('button', { name: /选择模型/ })).toContainText('deepseek-flash');
  await expect(page.getByText('直连 api.deepseek.com，费用按你的 DeepSeek 账号计')).toBeVisible();

  // 刷新后 Key 还在，只露首尾。
  await page.reload();
  await page.getByRole('button', { name: '在这页问 deepseek-flash' }).click();
  await page.getByRole('button', { name: '设置' }).click();
  const drawer = page.getByRole('dialog', { name: '模型与 Key' });
  await expect(drawer).toContainText('sk-…od-1');
  await drawer.getByRole('button', { name: '删除 Key' }).click();
  await expect(page.getByRole('status').filter({ hasText: '已删除这台设备上的 Key' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: '用自己的 API Key 对话' })).toBeVisible();
});

test('限流时先保存 Key，取到模型列表之前不能发问', async ({ page }) => {
  await openSetup(page);
  await page.getByLabel('API Key').fill('sk-rate');
  await page.getByRole('button', { name: '检查并保存' }).click();
  await expect(page.getByText('还没有可用的模型：取到 DeepSeek 的模型列表之后才能对话。')).toBeVisible();
  await page.getByRole('button', { name: /选择模型/ }).click();
  await expect(page.getByText('还没有取到模型列表')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('textbox', { name: '问这张盘' }).fill('能问吗');
  await expect(page.getByRole('button', { name: '发送' })).toBeDisabled();
});

test('兼容服务：Base URL 必须是 https；能否调用工具以第一次对话为准', async ({ page, request }) => {
  await openSetup(page);
  // React Aria 的单选框输入是隐藏的，点它的标签。
  await page.getByText('兼容 OpenAI 的服务').click();
  await page.getByRole('textbox', { name: 'Base URL' }).fill('http://llm.example.test/v1');
  await page.getByLabel('API Key').fill('sk-compat');
  await page.getByRole('button', { name: '检查并保存' }).click();
  await expect(page.getByText('浏览器页面只能直连 https 地址，http 与本机地址不行')).toBeVisible();
  await page.getByRole('textbox', { name: 'Base URL' }).fill('https://llm.example.test/v1/');
  await page.getByRole('button', { name: '检查并保存' }).click();
  await expect(page.getByText('直连 llm.example.test，费用按你在服务商的账号计')).toBeVisible();
  await page.getByRole('button', { name: /选择模型/ }).click();
  await expect(page.getByRole('option', { name: 'deepseek-flash，第一次对话时确定' })).toBeVisible();
  await page.keyboard.press('Escape');
  await ask(page, '兼容服务今年怎样');
  await expect(answer(page)).toContainText('自己拿主意的力量很足。');
  const [first] = await vendorRequests(request, '兼容服务今年怎样');
  expect(first!.path).toBe('/v1/chat/completions');
  await page.getByRole('button', { name: /选择模型/ }).click();
  await expect(page.getByRole('option', { name: 'deepseek-flash，可查盘' })).toBeVisible();
});

test('发问：先查盘（查了什么可展开、可在盘上看），再流式回答；上下文行随问题发出', async ({ page, request }) => {
  await seed(page, { provider: 'deepseek', key: 'sk-good' });
  await openChat(page);
  await expect(page.getByRole('heading', { name: '问这张盘' })).toBeVisible();
  await ask(page, '今年适合换工作吗 [table]');
  const log = answer(page);
  await expect(log).toContainText('能动，但更适合在现在的专业里往上走一步。');
  await expect(log.getByRole('table')).toBeVisible();
  await expect(log).toContainText('DeepSeek deepseek-flash');

  const toggle = page.getByRole('button', { name: '查了 1 项：2026 年运限' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(log).toContainText(/大限（..，\d+–\d+ 岁）、流年（丙午）、各月/);
  await page.getByRole('button', { name: '在盘上看' }).click();
  await expect(page.getByRole('status').filter({ hasText: '盘上已换到 2026 年流年' })).toBeVisible();

  const [first, second] = await vendorRequests(request, '今年适合换工作吗 [table]');
  expect(first!.body.tools).toHaveLength(7);
  const user = first!.body.messages!.find((m) => m.role === 'user')!;
  expect(user.content).toMatch(/^<page>2000-8-16 寅时 女，看的是一生（本命盘）、.+。<\/page>\n\n今年适合换工作吗 \[table\]$/);
  // 第二次请求带着浏览器里算出的工具结果。
  expect(JSON.stringify(second!.body.messages)).toContain('流月一览 2026');
});

test('停止保留已生成的部分；重试替换这条回答', async ({ page }) => {
  await seed(page, { provider: 'deepseek', key: 'sk-good' });
  await openChat(page);
  await ask(page, '慢慢说 [slow][plain]');
  const log = answer(page);
  await expect(log).toContainText('第 2 段。');
  await expect(page.getByRole('button', { name: '新对话' })).toBeDisabled();
  await page.getByRole('button', { name: '停止' }).click();
  await expect(log).toContainText('已停止');
  await expect(log).not.toContainText('第 30 段。');
  await log.getByRole('button', { name: '重试' }).click();
  await expect(log).toContainText('第 30 段。', { timeout: 15000 });
  await expect(log).not.toContainText('已停止');
});

test('编辑上一问：重新发送后之后的回答按新问题重来；Esc 取消', async ({ page }) => {
  await seed(page, { provider: 'deepseek', key: 'sk-good' });
  await openChat(page);
  await ask(page, '原来的问题 [plain]');
  const log = answer(page);
  await expect(log).toContainText('自己拿主意的力量很足。');
  await log.getByRole('button', { name: '编辑' }).click();
  const box = page.getByRole('textbox', { name: '编辑上一问' });
  await expect(box).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(box).toHaveCount(0);
  await log.getByRole('button', { name: '编辑' }).click();
  await box.fill('改过的问题 [slow][plain]');
  await page.getByRole('button', { name: '重新发送' }).click();
  await expect(log).toContainText('改过的问题');
  await expect(log).not.toContainText('原来的问题');
  await expect(log).toContainText('第 1 段。');
});

test('出错：401、429、连不上各有标题、原因与动作，问题保留', async ({ page }) => {
  await seed(page, { provider: 'deepseek', key: 'sk-good' });
  await openChat(page);
  const alert = page.getByRole('alert');
  await ask(page, '试试 [401]');
  await expect(alert).toContainText('DeepSeek 拒绝了这个 Key（401）');
  await expect(alert.getByRole('button', { name: '去设置' })).toBeVisible();
  await expect(answer(page)).toContainText('试试 [401]');

  await page.getByRole('button', { name: '新对话' }).click();
  await ask(page, '试试 [429]');
  await expect(alert).toContainText('DeepSeek 暂时不接受请求（429）');
  await alert.getByRole('button', { name: '复制给别的 AI' }).click();
  await expect(page.getByRole('textbox', { name: '你想问什么' })).toBeFocused();
  await page.getByRole('button', { name: /^在这页问/ }).click();

  await page.getByRole('button', { name: '新对话' }).click();
  await ask(page, '试试 [cors]');
  await expect(alert).toContainText('连不上 api.deepseek.com');
  await expect(alert).toContainText('不允许网页直接访问（跨域），也可能是厂商在限流');
});

test('对话接口的 401 不带跨域头时（OpenAI），按模型列表接口复核成 Key 无效', async ({ page }) => {
  await seed(page, { provider: 'openai', key: 'sk-hidden401' });
  await openChat(page);
  await ask(page, '你好');
  await expect(page.getByRole('alert')).toContainText('OpenAI 拒绝了这个 Key（401）');
});

test('模型不支持工具调用：可换成能查盘的模型，或不用工具继续（盘面以文本附在提问前）', async ({ page, request }) => {
  await seed(page, { provider: 'deepseek', key: 'sk-good' });
  await openChat(page);
  await ask(page, '查不了 [notools]');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('deepseek-flash 不支持工具调用');
  await expect(alert.getByRole('button', { name: '换成 tiny-context' })).toBeVisible();
  await alert.getByRole('button', { name: '不用工具继续' }).click();
  await expect(answer(page)).toContainText('自己拿主意的力量很足。');
  await expect(page.getByText(/无工具模式.*deepseek-flash 不能调用工具/)).toBeVisible();
  const last = (await vendorRequests(request, '查不了 [notools]')).at(-1)!;
  expect(last.body.tools).toBeUndefined();
  expect(JSON.stringify(last.body.messages)).toContain('<chart>');
  await page.getByRole('button', { name: /选择模型/ }).click();
  await expect(page.getByRole('option', { name: 'deepseek-flash，不支持工具调用' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '换成 tiny-context' }).click();
  await expect(page.getByText(/无工具模式/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /选择模型/ })).toContainText('tiny-context');
});

test('长对话：放不下的早期消息不再发送，记录里画分隔线并常驻说明', async ({ page, request }) => {
  const long = '紫'.repeat(400);
  const now = Date.now();
  const messages = Array.from({ length: 6 }, (_, i) =>
    i % 2 === 0
      ? { id: `u${i}`, role: 'user', text: `${long}${i}`, context: '上下文', at: now }
      : { id: `a${i}`, role: 'assistant', provider: 'deepseek', service: 'DeepSeek', model: 'tiny-context', text: long, calls: [], status: 'done', error: null, at: now },
  );
  await seed(page, {
    provider: 'deepseek',
    key: 'sk-good',
    model: 'tiny-context',
    conversations: [{ id: 'long', title: '很长', chart: 'cal=solar&d=2000-8-16&t=2&g=f', birth: '2000-8-16 寅时 女', createdAt: now, updatedAt: now, messages, noTools: false }],
  });
  await openChat(page);
  await page.getByRole('button', { name: '记录' }).click();
  await page.getByRole('button', { name: /^很长/ }).click();
  await ask(page, '接着说 [plain]');
  await expect(answer(page)).toContainText('自己拿主意的力量很足。');
  await expect(answer(page)).toContainText(/以上 \d+ 条不再发给模型，仍存在本机/);
  await expect(page.getByText(/对话已经很长/)).toBeVisible();
  const [req] = await vendorRequests(request, '接着说 [plain]');
  expect(req!.body.messages!.filter((m) => m.role === 'user')).toHaveLength(1);
});

test('记录：打开、标出当前、删除要确认；删的是当前对话时切到最近的一段', async ({ page }) => {
  await seed(page, { provider: 'deepseek', key: 'sk-good' });
  await openChat(page);
  await ask(page, '第一段对话 [plain]');
  await expect(answer(page)).toContainText('自己拿主意的力量很足。');
  await page.getByRole('button', { name: '新对话' }).click();
  await expect(page.getByRole('heading', { name: '问这张盘' })).toBeVisible();
  await ask(page, '第二段对话 [plain]');
  await expect(answer(page)).toContainText('自己拿主意的力量很足。');

  await page.getByRole('button', { name: '记录' }).click();
  const drawer = page.getByRole('dialog', { name: '对话记录' });
  await expect(drawer).toContainText('2 段');
  await expect(drawer.getByRole('button', { name: /第二段对话.*当前/ })).toBeVisible();
  await drawer.getByRole('button', { name: /^第一段对话/ }).click();
  await expect(answer(page)).toContainText('第一段对话');

  await page.getByRole('button', { name: '记录' }).click();
  await drawer.getByRole('button', { name: '删除「第一段对话 [plain]」' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('删除后无法恢复。');
  await expect(confirm.getByRole('button', { name: '取消' })).toBeFocused();
  await confirm.getByRole('button', { name: '删除' }).click();
  await expect(drawer).toContainText('1 段');
  await page.keyboard.press('Escape');
  // 删的是当前对话：切到这张盘上最近的一段。
  await expect(answer(page)).toContainText('第二段对话');
});

test('Anthropic：请求带允许网页直连的请求头，走 Messages 协议查盘与回答', async ({ page, request }) => {
  await seed(page, { provider: 'anthropic', key: 'sk-ant-good', model: 'deepseek-flash' });
  await openChat(page);
  await ask(page, 'Anthropic 今年');
  await expect(answer(page)).toContainText('自己拿主意的力量很足。');
  await expect(page.getByRole('button', { name: '查了 1 项：2026 年运限' })).toBeVisible();
  const [first] = await vendorRequests(request, 'Anthropic 今年');
  expect(first!.path).toBe('/v1/messages');
  expect(first!.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  expect(first!.headers['x-api-key']).toBe('sk-ant-good');
});

test('手机：「在这页问」打开全屏面板并预填问题，Esc 收起，没发出的草稿还在', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, { provider: 'deepseek', key: 'sk-good' });
  await page.goto(CHART);
  await page.getByRole('button', { name: /^在这页问/ }).click();
  const sheet = page.getByRole('dialog', { name: '对话' });
  await expect(sheet).toContainText('2000-8-16 寅时 女');
  const input = sheet.getByRole('textbox', { name: '问这张盘' });
  await expect(input).toBeFocused();
  await expect(sheet.getByRole('button', { name: '在盘上看' })).toHaveCount(0);
  await expect(input).toHaveValue('从「总论」看，这张盘怎么样？');
  await input.fill('手机上问 [plain]');
  await sheet.getByRole('button', { name: '发送' }).click();
  await expect(sheet.getByRole('log')).toContainText('自己拿主意的力量很足。');
  await input.fill('还没发的草稿');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await page.getByRole('button', { name: /^在这页问/ }).click();
  await expect(page.getByRole('dialog', { name: '对话' }).getByRole('textbox', { name: '问这张盘' })).toHaveValue('还没发的草稿');
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
});


test('存储不可用：对话写明原因，复制给别的 AI 照常可用', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
  });
  await openSetup(page);
  await expect(page.getByText('这个浏览器不让本页存数据')).toBeVisible();
  await page.getByRole('button', { name: '‹ 回到「总论」' }).click();
  await expect(page.getByRole('link', { name: 'DeepSeek' })).toBeVisible();
});

test('模型输出里的图片不加载（显示为链接）、原始 HTML 不渲染；站外链接点了才新开页且不带来源', async ({ page }) => {
  const outside: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('evil.example')) outside.push(r.url());
  });
  await seed(page, { provider: 'deepseek', key: 'sk-good' });
  await openChat(page);
  await ask(page, '给我看图 [image][plain]');
  const log = answer(page);
  const image = log.getByRole('link', { name: '泄露' });
  await expect(image).toHaveAttribute('href', 'https://evil.example/leak.png?q=%E5%AF%B9%E8%AF%9D%E5%86%85%E5%AE%B9');
  await expect(image).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(log.getByRole('link', { name: '出处' })).toHaveAttribute('target', '_blank');
  await expect(log.locator('img')).toHaveCount(0);
  await expect(log).not.toContainText('<img');
  expect(outside).toEqual([]);
});

test('从首页站内跳转进排盘页（沿用首页的 CSP）后，对话照样能连厂商', async ({ page }) => {
  await seed(page, { provider: 'deepseek', key: 'sk-good' });
  await page.goto('/zh');
  await page.getByRole('link', { name: /在线排盘/ }).first().click();
  await expect(page).toHaveURL(/\/zh\/chart$/);
  await page.evaluate(() => {
    location.hash = 'cal=solar&d=2000-8-16&t=2&g=f';
  });
  await page.getByRole('button', { name: /^在这页问/ }).click();
  await expect(page.getByRole('textbox', { name: '问这张盘' })).toBeEnabled({ timeout: 20000 });
  await ask(page, '站内跳转后 [plain]');
  await expect(answer(page)).toContainText('自己拿主意的力量很足。');
});

test('全站的 CSP 一致（只有内联脚本与样式的哈希不同）：connect-src 只放 https，图片只同源，不用的能力一律关闭', async ({ request }) => {
  const policies = await Promise.all(
    ['/zh', '/zh/chart', '/zh/knowledge', '/zh/install', '/en/chart', '/no-such-page'].map(async (path) => {
      const html = await (await request.get(path)).text();
      const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/)![1]!;
      return csp.replace(/ 'sha256-[^']+'/g, '');
    }),
  );
  expect(new Set(policies).size).toBe(1);
  const directives = policies[0]!.split('; ');
  for (const d of ["connect-src 'self' https:", "img-src 'self'", "object-src 'none'", "frame-src 'none'", "base-uri 'none'", "form-action 'none'"]) {
    expect(directives).toContain(d);
  }
});

test('上下文超长：错误块说明并由用户选择少发较早的消息再试，记录里画出分隔线', async ({ page }) => {
  const now = Date.now();
  const messages = [
    { id: 'u0', role: 'user', text: '早先的问题', context: '上下文', at: now },
    { id: 'a1', role: 'assistant', provider: 'deepseek', service: 'DeepSeek', model: 'deepseek-flash', text: '早先的回答', calls: [], status: 'done', error: null, at: now },
  ];
  await seed(page, {
    provider: 'deepseek',
    key: 'sk-good',
    conversations: [{ id: 'ctx', title: '超长', chart: 'cal=solar&d=2000-8-16&t=2&g=f', birth: '2000-8-16 寅时 女', createdAt: now, updatedAt: now, messages, noTools: false }],
  });
  await openChat(page);
  await page.getByRole('button', { name: '记录' }).click();
  await page.getByRole('button', { name: /^超长/ }).click();
  await ask(page, '接着问 [toolong][plain]');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('对话太长，DeepSeek 放不下（400）');
  await alert.getByRole('button', { name: '较早的消息不再发给模型，重试' }).click();
  await expect(answer(page)).toContainText('自己拿主意的力量很足。');
  await expect(answer(page)).toContainText('以上 2 条不再发给模型，仍存在本机');
  await expect(answer(page)).toContainText('早先的问题');
});

test('一轮结束却没有正文：说明查了几次仍没回答，可以重试', async ({ page }) => {
  await seed(page, { provider: 'deepseek', key: 'sk-good' });
  await openChat(page);
  await ask(page, '空的 [empty]');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('查了 1 次仍没给出回答');
  await expect(alert.getByRole('button', { name: '重试' })).toBeVisible();
});
