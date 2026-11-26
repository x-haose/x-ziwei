import { defineConfig, devices } from '@playwright/test';

/** 假厂商的 CONNECT 代理端口（与 `e2e/fake-vendor-main.ts` 一致）。 */
const FAKE_VENDOR_PROXY = 9480;

/**
 * 端到端测试跑构建产物（`build/client`），由 `wrangler dev` 在本机按部署形态提供（Worker 与 Workers 静态资源）。
 * 先按测试站构建（`XZW_SITE=beta pnpm build`）再跑。
 *
 * 对话用例对着本地的假厂商（`e2e/fake-vendor-main.ts`）：chromium 项目的浏览器经它的 CONNECT 代理访问外部主机，
 * 只有各厂商的主机名会接到假厂商，其余一律拒绝，测试不会请求真实厂商。
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4173', locale: 'zh-CN' },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], ignoreHTTPSErrors: true, launchOptions: { proxy: { server: `http://127.0.0.1:${FAKE_VENDOR_PROXY}`, bypass: 'localhost' } } },
      testIgnore: '*.external.spec.ts',
    },
    // 依赖外网的用例（线上统计脚本），带有限重试，CI 里单独一步跑。
    { name: 'external', use: { ...devices['Desktop Chrome'] }, testMatch: '*.external.spec.ts', retries: 2 },
  ],
  webServer: [
    {
      command: 'wrangler dev --port 4173',
      url: 'http://localhost:4173/zh',
      // 不复用已在跑的服务：wrangler dev 在启动时读入产物，复用上一次留下的进程会拿旧产物测试；端口被占时直接报错。
      reuseExistingServer: false,
      env: { WRANGLER_SEND_METRICS: 'false' },
    },
    { command: 'node e2e/fake-vendor-main.ts', url: `http://127.0.0.1:${FAKE_VENDOR_PROXY}/__health`, reuseExistingServer: false },
  ],
});
