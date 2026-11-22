/** `scripts/fonts/plugin.ts` 提供的虚拟模块：字体样式表与首屏预载文件，均为站点根路径下的绝对路径。 */
declare module 'virtual:xzw-fonts' {
  const fonts: { readonly css: string; readonly preload: readonly string[] };
  export default fonts;
}
