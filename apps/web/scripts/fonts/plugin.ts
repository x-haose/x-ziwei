import type { Plugin } from 'vite';
import { buildFonts, type FontManifest } from './build.ts';
import { criticalText } from './critical.ts';

const ID = 'virtual:xzw-fonts';
const RESOLVED = `\0${ID}`;

/**
 * 在 Vite 启动（开发服务器与构建）时生成字体切片，并以虚拟模块 `virtual:xzw-fonts`
 * 把样式表与预载文件的地址交给页面（类型见 `app/virtual-fonts.d.ts`）。
 *
 * 切片写进 `public/fonts/`，由 Vite 原样拷进产物；输入没变时直接复用上次的结果。
 * 一次构建里客户端与预渲染两轮共用同一个结果。
 */
export function fontsPlugin({ root }: { root: string }): Plugin {
  let manifest: Promise<FontManifest> | null = null;
  const ensure = () => (manifest ??= buildFonts({ root, critical: criticalText() }));
  return {
    name: 'xzw-fonts',
    async buildStart() {
      await ensure();
    },
    resolveId(id) {
      return id === ID ? RESOLVED : null;
    },
    async load(id) {
      if (id !== RESOLVED) return null;
      const { css, preload } = await ensure();
      return `export default ${JSON.stringify({ css, preload })};`;
    },
  };
}
