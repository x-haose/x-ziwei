/** subset-font 2.9.0 本身不带类型；这里只声明构建脚本用到的部分，语义见该包 README。 */
declare module 'subset-font' {
  interface SubsetFontOptions {
    targetFormat?: 'sfnt' | 'woff' | 'woff2';
    /** 在 HarfBuzz 默认保留的 nameID 0–6 之外再保留的 nameID。 */
    preserveNameIds?: number[];
    /** 保留全部字形（不按文本取子集）；此时 `text` 必须省略。 */
    keepAllGlyphs?: boolean;
  }
  function subsetFont(buffer: Buffer, text: string | undefined, options?: SubsetFontOptions): Promise<Buffer>;
  export default subsetFont;
}
