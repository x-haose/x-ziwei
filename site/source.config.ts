import { defineConfig, defineDocs } from 'fumadocs-mdx/config';

/**
 * 内容页的来源。
 *
 * `includeProcessedMarkdown` 让每一页在构建期保留一份处理后的 Markdown 原文，
 * 供 `/llms.txt`、`/llms-full.txt` 与每页 `.md` 端点复用，无需运行期重新解析 MDX。
 */
export const docs = defineDocs({
  dir: 'content',
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      themes: {
        light: 'github-light',
        dark: 'github-dark-default',
      },
    },
  },
});
