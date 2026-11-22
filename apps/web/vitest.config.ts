import { defineConfig } from 'vitest/config';

/** 单测只覆盖纯函数，不经 Vite 插件（字体生成、样式编译都不需要）。 */
export default defineConfig({
  test: {
    include: ['app/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
