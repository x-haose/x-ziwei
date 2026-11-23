import { statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { reactRouter } from '@react-router/dev/vite';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { fumadocsMdx } from 'fumadocs-mdx/vite';
import remarkCjkFriendly from 'remark-cjk-friendly';
import { defineConfig } from 'vite';
import { fontsPlugin } from './scripts/fonts/plugin.ts';
import { rehypeCodeMeta } from './scripts/mdx/rehype-code-meta.ts';

const wasm = createRequire(import.meta.url).resolve('x-iztro/x_iztro.wasm');

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  define: { __XIZTRO_WASM_BYTES__: JSON.stringify(statSync(wasm).size) },
  // 帮助页的 MDX 直接读仓库里的 site/content（内容单一来源），开发服务器要能访问应用目录之外的这个目录。
  server: { fs: { allow: [root, fileURLToPath(new URL('../../site/content', import.meta.url))] } },
  // 编译后的 MDX 位于 site/content，裸导入会从那里向上找 node_modules（可能是 site/ 自己的旧版本，
  // CI 里则根本没有）；这些包一律从本应用解析。
  resolve: { dedupe: ['react', 'react-dom', 'fumadocs-core', 'fumadocs-mdx'] },
  plugins: [
    fontsPlugin({ root }),
    fumadocsMdx({
      globalOptions: {
        mdxOptions: {
          // 代码块不做语法着色：设计规范只有一种强调色，代码一律单色。
          rehypeCodeOptions: false,
          rehypePlugins: (v) => [rehypeCodeMeta, ...v],
          remarkPlugins: (v) => [...v, remarkCjkFriendly],
        },
      },
    }),
    vanillaExtractPlugin(),
    reactRouter(),
  ],
});
