/**
 * `scripts/fonts/plugin.ts` 提供的虚拟模块（各字段的含义见 `scripts/fonts/build.ts` 的 `FontManifest`）：
 * 内联进 `<head>` 的关键 @font-face 规则、其余切片的样式表地址、首屏预载的字体文件。地址均为站点根路径下的绝对路径。
 */
declare module 'virtual:xzw-fonts' {
  const fonts: { readonly critical: string; readonly rest: string; readonly preload: readonly string[] };
  export default fonts;
}
