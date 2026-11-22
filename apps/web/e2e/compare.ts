import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

/**
 * 与对照稿并排截图：左边是 `docs/design/mockup.html` 的对应状态，右边是构建产物，
 * 宽度 375 与 1440、明暗两套，写进 `e2e/shots/`。用于逐项走查，不做像素断言。
 *
 * 先 `pnpm build`，再 `node e2e/compare.ts`（会自己起静态服务器）。
 */
const here = import.meta.dirname;
const mockup = `file://${path.resolve(here, '../../../docs/design/mockup.html')}?clean`;
const out = path.join(here, 'shots');
mkdirSync(out, { recursive: true });

const TARGETS = [
  { name: 'home', app: '/zh', mock: '#home' },
  { name: 'chart-empty', app: '/zh/chart', mock: '#chart' },
  { name: 'doc', app: '/zh/method', mock: '#doc/install' },
];

const { spawn } = await import('node:child_process');
const server = spawn(process.execPath, [path.join(here, 'serve.ts')], { stdio: 'ignore', env: { ...process.env, PORT: '4174' } });
await new Promise((r) => setTimeout(r, 500));

const browser = await chromium.launch();
try {
  for (const width of [375, 1440]) {
    for (const scheme of ['light', 'dark'] as const) {
      const context = await browser.newContext({ viewport: { width, height: width < 700 ? 812 : 900 }, colorScheme: scheme });
      const page = await context.newPage();
      for (const t of TARGETS) {
        const shots: Buffer[] = [];
        for (const url of [`${mockup}${t.mock}`, `http://localhost:4174${t.app}`]) {
          await page.goto(url, { waitUntil: 'networkidle' });
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(400);
          shots.push(await page.screenshot({ fullPage: width < 700 }));
        }
        const sheet = await context.newPage();
        await sheet.setContent(
          `<body style="margin:0;display:flex;gap:24px;background:#f0f;align-items:flex-start">${shots
            .map((b) => `<img src="data:image/png;base64,${b.toString('base64')}" style="display:block">`)
            .join('')}</body>`,
        );
        await sheet.setViewportSize({ width: width * 2 + 24, height: 400 });
        await sheet.screenshot({ path: path.join(out, `${t.name}-${width}-${scheme}.png`), fullPage: true });
        await sheet.close();
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(out);
