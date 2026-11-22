import { defineConfig, devices } from '@playwright/test';

/**
 * 端到端测试跑构建产物（`build/client`），由 `e2e/serve.ts` 按静态部署的方式提供。
 * 先 `pnpm build` 再跑。
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4173', locale: 'zh-CN' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node e2e/serve.ts',
    url: 'http://localhost:4173/zh',
    reuseExistingServer: !process.env.CI,
  },
});
