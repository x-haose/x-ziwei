import { defineConfig, devices } from '@playwright/test';

/**
 * 端到端测试跑构建产物（`build/client`），由 `wrangler dev` 在本机按部署形态提供（Worker 与 Workers 静态资源）。
 * 先按测试站构建（`XZW_SITE=beta pnpm build`）再跑。
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
    command: 'wrangler dev --port 4173',
    url: 'http://localhost:4173/zh',
    // 不复用已在跑的服务：wrangler dev 在启动时读入产物，复用上一次留下的进程会拿旧产物测试；端口被占时直接报错。
    reuseExistingServer: false,
    env: { WRANGLER_SEND_METRICS: 'false' },
  },
});
