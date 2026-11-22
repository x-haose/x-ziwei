/**
 * 断点（设计规范第 4、14、15 节）。排盘页四档：S <700、M 700–1023、L 1024–1359、XL ≥1360；
 * 首页另在 1280 分档，内容页在 820 与 1200 分档。字符串可直接用于 vanilla-extract 的 `@media`
 * 与 `matchMedia`。
 */
export const media = {
  /** 手机：单列，选择器改为底部面板。 */
  s: 'screen and (max-width: 699px)',
  /** 平板及以下。 */
  mDown: 'screen and (max-width: 1023px)',
  /** 排盘页 L 档及以下。 */
  lDown: 'screen and (max-width: 1359px)',
  /** 首页的中间档：拓片缩小、命盘露出近三行。 */
  homeMid: 'screen and (min-width: 1024px) and (max-width: 1279px)',
  /** 内容页去掉右侧目录。 */
  docNoToc: 'screen and (max-width: 1199px)',
  /** 内容页单栏。 */
  docSingle: 'screen and (max-width: 819px)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
} as const;
