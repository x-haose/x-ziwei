import type { Element, Root } from 'hast';

/**
 * 把围栏代码块的标题（```json title="Cursor"）交给 `pre`：写成 `pre` 的 `title` 属性，
 * MDX 渲染时作为 props 传给代码块组件。语言写成 `data-language`。
 *
 * 代码块不经语法着色插件，元信息在 mdast 转 hast 时留在 `code` 元素的 `data.meta` 上。
 */
export function rehypeCodeMeta() {
  return (tree: Root) => {
    const visit = (node: Root | Element) => {
      for (const child of node.children) {
        if (child.type !== 'element') continue;
        if (child.tagName === 'pre') {
          const code = child.children.find((c): c is Element => c.type === 'element' && c.tagName === 'code');
          const meta = (code?.data as { meta?: string } | undefined)?.meta ?? '';
          const title = /title="([^"]*)"/.exec(meta)?.[1];
          if (title !== undefined) child.properties.title = title;
          const cls = code?.properties.className;
          const lang = Array.isArray(cls) ? cls.map(String).find((c) => c.startsWith('language-'))?.slice(9) : undefined;
          if (lang) child.properties.dataLanguage = lang;
          continue;
        }
        visit(child);
      }
    };
    visit(tree);
  };
}
