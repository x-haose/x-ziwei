import { createGlobalTheme, createThemeContract, globalStyle } from '@vanilla-extract/css';
import { media } from './media';

/**
 * 设计令牌，取值与用途见 `docs/design/DESIGN.md`。
 *
 * `color` 与 `rubbing` 两组随主题变化：明暗两套各自给全部取值，漏写任何一项都编译不过。
 * 其余各组与主题无关，只在 `:root` 上定义一次。组件里的颜色、字号、时长一律引用这里，不写字面值。
 */
export const color = createThemeContract({
  /** 页面底、宫格底、中宫文字块底。 */
  bg: null,
  /** 悬停底、三方四正相关宫底。 */
  bg2: null,
  /** 选中宫底、按下底、禁用按钮底。 */
  bg3: null,
  /** 提示词预览框、代码块的底：深色比页面更深一级，浅色比纸更亮一级。 */
  well: null,
  /** 主文字、主星、连线、主按钮底。 */
  fg: null,
  /** 次级文字、辅星、宫名常态。 */
  fg2: null,
  /** 标签、亮度、杂耀、刻度数字、禁用文字；对 bg 与 bg3 都不低于 4.5:1。 */
  fg3: null,
  /** 分隔线、宫内页脚线（fg 的 14% 不透明度）。 */
  line: null,
  /** 宫格线、输入框边、分段控件边。 */
  line2: null,
  /** 外圈刻度、当前层宫名框、幽灵按钮边。 */
  line3: null,
  /** 唯一的强调色（深色赭红、浅色砖红），用途清单见设计规范第 6 节，别处不用。 */
  accent: null,
  /** 强调色实心块上的字。 */
  accentFg: null,
  /** 主按钮与分段控件选中项的底。 */
  btn: null,
  /** 主按钮与分段控件选中项的字。 */
  btnFg: null,
  /** 主按钮悬停底。 */
  btnHover: null,
  /** 底部面板背后的半透明遮罩。 */
  scrim: null,
});

/**
 * 首页拓片图在两套主题里的合成方式：同一张「石白线、纯黑底」的灰度图，
 * 深色用 screen 叠在墨底上成白线；浅色先反相再 multiply，成为印在纸上的墨线。
 */
export const rubbing = createThemeContract({
  blend: null,
  filter: null,
  opacity: null,
});

const darkInk = 'oklch(0.885 0.022 85';
const lightInk = 'oklch(0.25 0.025 262';

createGlobalTheme(':root[data-theme="dark"]', color, {
  bg: 'oklch(0.19 0.017 262)',
  bg2: 'oklch(0.215 0.018 262)',
  bg3: 'oklch(0.245 0.02 262)',
  well: 'oklch(0.165 0.015 262)',
  fg: `${darkInk})`,
  fg2: 'oklch(0.75 0.02 85)',
  fg3: 'oklch(0.645 0.016 85)',
  line: `${darkInk} / 0.14)`,
  line2: `${darkInk} / 0.3)`,
  line3: `${darkInk} / 0.55)`,
  accent: 'oklch(0.665 0.15 40)',
  accentFg: 'oklch(0.19 0.017 262)',
  btn: `${darkInk})`,
  btnFg: 'oklch(0.19 0.017 262)',
  btnHover: 'oklch(0.95 0.015 85)',
  scrim: 'oklch(0.19 0.017 262 / 0.55)',
});

createGlobalTheme(':root[data-theme="light"]', color, {
  bg: 'oklch(0.948 0.011 95)',
  bg2: 'oklch(0.928 0.013 95)',
  bg3: 'oklch(0.905 0.016 92)',
  well: 'oklch(0.968 0.008 95)',
  fg: `${lightInk})`,
  fg2: 'oklch(0.4 0.022 262)',
  fg3: 'oklch(0.49 0.02 262)',
  line: `${lightInk} / 0.14)`,
  line2: `${lightInk} / 0.28)`,
  line3: `${lightInk} / 0.5)`,
  accent: 'oklch(0.505 0.15 33)',
  accentFg: 'oklch(0.968 0.008 95)',
  btn: `${lightInk})`,
  btnFg: 'oklch(0.968 0.008 95)',
  btnHover: 'oklch(0.33 0.03 262)',
  scrim: 'oklch(0.948 0.011 95 / 0.55)',
});

createGlobalTheme(':root[data-theme="dark"]', rubbing, { blend: 'screen', filter: 'none', opacity: '0.9' });
createGlobalTheme(':root[data-theme="light"]', rubbing, { blend: 'multiply', filter: 'invert(1)', opacity: '0.78' });

globalStyle(':root[data-theme="dark"]', { colorScheme: 'dark' });
globalStyle(':root[data-theme="light"]', { colorScheme: 'light' });

/**
 * 字体栈。CSS 里的族名对应 `scripts/fonts` 生成的 @font-face：
 * 思源宋保持原名；思源黑的许可证保留了字体名「Source」，切片后改名为 XZW Sans SC。
 * 列在后面的系统字体只在切片下载完成之前顶替（font-display: swap），不承担正式显示。
 */
export const font = createThemeContract({
  /** 中文衬线：星名、宫名、干支、四柱、标题。 */
  serif: null,
  /** 界面与长文：西文与数字用 Geist，中文落到思源黑。 */
  sans: null,
  /** 数字、岁数、刻度：Geist 比例字，中文回落思源黑。 */
  num: null,
  /** 只用于代码。 */
  mono: null,
});

createGlobalTheme(':root', font, {
  serif: '"Noto Serif SC", "Songti SC", serif',
  sans: '"Geist", "XZW Sans SC", "PingFang SC", sans-serif',
  num: '"Geist", "XZW Sans SC", sans-serif',
  mono: '"Geist Mono", "XZW Sans SC", monospace',
});

/**
 * 字号（px），按用途命名。对应设计规范第 3 节的字号阶梯，以及内容页（第 14 节）、首页（第 15 节）
 * 与命盘上的专用字号。`body` 在手机上是 16px，其余各档与屏宽无关，响应式的差异写在用到它的组件里。
 */
export const size = createThemeContract({
  /** 字段标签、亮度、杂耀、四化块、刻度数字。 */
  label: null,
  /** 次级说明、中宫日期、换算结果、错误信息。 */
  aux: null,
  /** 导航、勾选项、提示词预览、桌面辅星。 */
  small: null,
  /** 代码，行内与代码块共用；等宽字不小于 14.5px。 */
  code: null,
  /** 界面正文、宫名、按钮；手机 16px。 */
  body: null,
  /** 内容页的提示框标题、手机首页导航项。 */
  emphasis: null,
  /** 盘上主星；顶栏字标。 */
  star: null,
  /** 紧凑盘的主星；纵向首页上拓片旁的「紫微垣」。 */
  starCompact: null,
  /** 首页导言、内容页导语、内容页上一篇/下一篇的标题、中宫五行局。 */
  lede: null,
  /** 生辰摘要、「提示词」标题、首页导航项、内容页三级标题。 */
  subtitle: null,
  /** 手机首页字标。 */
  markNarrow: null,
  /** 中宫四柱。 */
  pillar: null,
  /** 空状态宫格里的地支。 */
  branch: null,
  /** 紧凑盘空状态宫格里的地支。 */
  branchCompact: null,
  /** 中宫状态标题（「尚未排盘」）。 */
  boardState: null,
  /** 紧凑盘的中宫状态标题。 */
  boardStateCompact: null,
  /** 内容页手机二级标题。 */
  proseH2Narrow: null,
  /** 首页字标。 */
  markHome: null,
  /** 内容页二级标题。 */
  proseH2: null,
  /** 左栏选中宫名。 */
  reading: null,
  /** 内容页手机标题。 */
  docTitleNarrow: null,
  /** 内容页标题。 */
  docTitle: null,
  /** 内容页正文。 */
  prose: null,
  /** 首页标题，随屏宽在 44–74px 之间。 */
  display: null,
  /** 首页标题在 1024–1279px。 */
  displayMid: null,
  /** 首页标题在 1024px 以下，37–56px。 */
  displayNarrow: null,
});

createGlobalTheme(':root', size, {
  label: '12px',
  aux: '13px',
  small: '14px',
  code: '14.5px',
  body: '15px',
  emphasis: '16px',
  star: '17px',
  starCompact: '15px',
  prose: '17px',
  lede: '18px',
  subtitle: '19px',
  markNarrow: '20px',
  pillar: '21px',
  branch: '22px',
  branchCompact: '18px',
  boardState: '18px',
  boardStateCompact: '15px',
  proseH2Narrow: '22px',
  markHome: '24px',
  proseH2: '25px',
  reading: '26px',
  docTitleNarrow: '32px',
  docTitle: '40px',
  display: 'clamp(44px, 2rem + 2.6vw, 74px)',
  displayMid: '56px',
  displayNarrow: 'clamp(37px, 6.4vw, 56px)',
});

globalStyle(':root', {
  '@media': { [media.s]: { vars: { [size.body]: '16px' } } },
});

/** 间距与尺寸（px）。 */
export const space = createThemeContract({
  /** 页边：手机 16px，其余 24px。 */
  pad: null,
  /** 栏间。 */
  gap: null,
  /** 区块之间。 */
  section: null,
  /** 可点元素的最小边长。 */
  hit: null,
  /** 主按钮高。 */
  button: null,
});

createGlobalTheme(':root', space, {
  pad: '24px',
  gap: '28px',
  section: '20px',
  hit: '44px',
  button: '48px',
});

globalStyle(':root', {
  '@media': { [media.s]: { vars: { [space.pad]: '16px' } } },
});

/** 线条（px）。所有结构线都是 1px；2px 只用于错误提示与警示框左侧的强调色竖线、内容页侧栏与目录的当前项左线。 */
export const stroke = createThemeContract({
  hair: null,
  rule: null,
});

createGlobalTheme(':root', stroke, {
  hair: '1px',
  rule: '2px',
});

/** 动效时长与缓动，全站同一条曲线。减少动态效果时由全局样式关闭全部动画与过渡。 */
export const motion = createThemeContract({
  /** 悬停、按下、颜色变化。 */
  fast: null,
  /** 角线、底星与标签淡入、提示、主题切换。 */
  base: null,
  /** 星官连线描线。 */
  draw: null,
  ease: null,
});

createGlobalTheme(':root', motion, {
  fast: '120ms',
  base: '200ms',
  draw: '480ms',
  ease: 'cubic-bezier(0.3, 0.6, 0.2, 1)',
});
