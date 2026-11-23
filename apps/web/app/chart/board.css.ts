import { createVar, fallbackVar, globalStyle, keyframes, style } from '@vanilla-extract/css';
import { media } from '../styles/media';
import { color, font, motion, size, stroke } from '../styles/tokens.css';

/** 盘的外框尺寸与外圈刻度带宽度，由放置它的页面按断点设定。 */
export const boardWidth = createVar();
export const boardHeight = createVar();
export const ringBand = createVar();

/** 外圈刻度带宽度，页面没给时为 0（不画外圈）。 */
const band = fallbackVar(ringBand, '0px');

/**
 * 盘的根元素。`data-density`（full / medium / compact）与 `data-short` 由组件按实测格宽写入，
 * 规则见设计规范第 7 节。
 */
export const board = style({
  position: 'relative',
  flex: 'none',
  width: boardWidth,
  height: boardHeight,
  padding: band,
  transition: `opacity ${motion.base}`,
});

const compact = (sel: string) => `${board}[data-density="compact"] ${sel}`;
const medium = (sel: string) => `${board}[data-density="medium"] ${sel}`;

export const grid = style({
  display: 'grid',
  gridTemplate: 'repeat(4, 1fr) / repeat(4, 1fr)',
  gap: stroke.hair,
  width: '100%',
  height: '100%',
  background: color.line2,
  border: `${stroke.hair} solid ${color.line2}`,
});

/**
 * 宫格。状态用 data 属性：`data-sel` 选中、`data-rel` 三方四正其余三宫、`data-now` 当前大限所在宫；
 * `data-fold` 是宫内收起的级数（见 `board.tsx` 的收起顺序）。
 */
export const cell = style({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  minHeight: 0,
  overflow: 'hidden',
  padding: '9px 9px 8px',
  background: color.bg,
  textAlign: 'left',
  transition: `background ${motion.fast}`,
  selectors: {
    '&:is(button):hover': { background: color.bg2 },
    '&:is(button):active': { background: color.bg3 },
    '&[data-rel]': { background: color.bg2 },
    '&[data-sel]': { background: color.bg3 },
    '&:focus-visible': { outlineOffset: -3 },
  },
});
globalStyle(compact(cell), { padding: '6px 5px 5px' });

export const middle = style({ gridArea: '2 / 2 / 4 / 4', background: color.bg });

/** 空状态里每宫只写地支。 */
export const ghost = style({
  margin: 'auto',
  fontFamily: font.serif,
  fontSize: size.branch,
  fontWeight: 500,
  color: color.fg3,
});
globalStyle(compact(ghost), { fontSize: size.branchCompact });

/* ── 选中宫的四角角线 ── */

const k = createVar();
const corner = (x: string, y: string) =>
  `linear-gradient(${color.accent}, ${color.accent}) ${x} ${y} / ${k} 1px no-repeat, linear-gradient(${color.accent}, ${color.accent}) ${x} ${y} / 1px ${k} no-repeat`;

export const bracket = style({
  vars: { [k]: '11px' },
  position: 'absolute',
  inset: 4,
  pointerEvents: 'none',
  opacity: 0,
  transition: `opacity ${motion.base}`,
  background: [corner('left', 'top'), corner('right', 'top'), corner('left', 'bottom'), corner('right', 'bottom')].join(','),
  selectors: { [`${cell}[data-sel] &`]: { opacity: 1 } },
});
globalStyle(compact(bracket), { inset: 2, vars: { [k]: '8px' } });

/* ── 星列：一颗星一列，竖排 ── */

export const stars = style({ display: 'flex', alignItems: 'flex-start', gap: 2, minHeight: 0 });
globalStyle(compact(stars), { gap: 3 });

export const star = style({ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' });
globalStyle(compact(star), { flexDirection: 'row', alignItems: 'flex-start', gap: 1 });

export const starMajor = style({});
export const starMinor = style({});
/** 运星（当前层的流耀）。 */
export const starFlow = style({});

export const column = style({ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 21 });
globalStyle(`${starMinor} ${column}`, { width: 18 });
globalStyle(`${starFlow} ${column}`, { width: 16 });
globalStyle(compact(column), { width: 17 });

export const starName = style({
  writingMode: 'vertical-rl',
  textOrientation: 'upright',
  fontFamily: font.serif,
  lineHeight: 1,
  letterSpacing: '0.04em',
});
globalStyle(`${starMajor} ${starName}`, { fontSize: size.star, fontWeight: 600, color: color.fg });
globalStyle(`${starMinor} ${starName}`, { fontSize: size.small, fontWeight: 500, color: color.fg2 });
globalStyle(`${starFlow} ${starName}`, { fontSize: size.aux, fontWeight: 500, color: color.fg3 });
globalStyle(compact(`${starMajor} ${starName}`), { fontSize: size.starCompact });
globalStyle(compact(`${starMinor} ${starName}`), { fontSize: size.aux });

export const brightness = style({
  marginTop: 4,
  fontFamily: font.serif,
  fontSize: size.label,
  lineHeight: 1,
  color: color.fg3,
});
globalStyle(compact(brightness), { marginTop: 3 });

export const huaStack = style({ display: 'flex', flexDirection: 'column', alignItems: 'center' });

/** 四化块：生年实心、大限灰框、流年强调色框、流月只有下划线（不只靠颜色区分）。 */
export const hua = style({
  display: 'block',
  width: 15,
  height: 15,
  marginTop: 3,
  fontStyle: 'normal',
  fontFamily: font.serif,
  fontSize: size.label,
  lineHeight: '15px',
  textAlign: 'center',
  fontWeight: 600,
  flex: 'none',
});
globalStyle(compact(hua), { width: 14, height: 14, lineHeight: '14px', margin: '0 0 2px' });

export const huaNatal = style({ background: color.accent, color: color.accentFg });
export const huaDecadal = style({ boxShadow: `inset 0 0 0 ${stroke.hair} ${color.fg2}`, color: color.fg });
export const huaYearly = style({ boxShadow: `inset 0 0 0 ${stroke.hair} ${color.accent}`, color: color.accent });
export const huaMonthly = style({ boxShadow: `inset 0 calc(-1 * ${stroke.hair}) 0 ${color.accent}`, color: color.accent });

/* ── 右上的层宫名 ── */

export const layerNames = style({
  position: 'absolute',
  top: 9,
  right: 9,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 3,
});

export const layerName = style({
  padding: '3px 4px',
  fontFamily: font.serif,
  fontSize: size.label,
  lineHeight: 1,
  fontWeight: 500,
  color: color.fg3,
});

export const layerNameActive = style({ color: color.fg, boxShadow: `inset 0 0 0 ${stroke.hair} ${color.line3}` });

/* ── 杂耀、紧凑盘的横排辅星 ── */

export const adjectives = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0 7px',
  marginTop: 'auto',
  paddingTop: 6,
  fontFamily: font.serif,
  fontSize: size.label,
  lineHeight: 1.55,
  color: color.fg3,
});

export const minorRow = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0 5px',
  marginTop: 'auto',
  fontFamily: font.serif,
  fontSize: size.label,
  lineHeight: 1.35,
  color: color.fg2,
});
globalStyle(`${board}[data-short] ${minorRow}`, { display: 'none' });

/** 横排辅星后的亮度字。 */
export const minorBrightness = style({ fontSize: size.label, color: color.fg3 });

/* ── 页脚：宫名、身/因、干支、大限岁数 ── */

export const foot = style({
  display: 'flex',
  alignItems: 'flex-end',
  gap: 6,
  marginTop: 5,
  paddingTop: 5,
  borderTop: `${stroke.hair} solid ${color.line}`,
});
globalStyle(medium(foot), { marginTop: 'auto' });
globalStyle(compact(foot), { marginTop: 4, paddingTop: 3, borderTop: 0, gap: 3 });
globalStyle(`${minorRow} + ${foot}`, { marginTop: 2 });
globalStyle(`${board}[data-short] ${foot}`, { marginTop: 'auto' });

export const palaceName = style({
  fontFamily: font.serif,
  fontSize: size.body,
  fontWeight: 600,
  lineHeight: 1.2,
  color: color.fg2,
  whiteSpace: 'nowrap',
  selectors: {
    [`${cell}[data-rel] &`]: { color: color.fg },
    [`${cell}[data-sel] &`]: { color: color.accent },
  },
});
globalStyle(compact(palaceName), { fontSize: size.aux });

export const palaceTag = style({
  alignSelf: 'center',
  padding: '2px 3px',
  fontFamily: font.serif,
  fontSize: size.label,
  lineHeight: 1,
  color: color.fg2,
  boxShadow: `inset 0 0 0 ${stroke.hair} ${color.line2}`,
});

export const stemBranch = style({
  marginLeft: 'auto',
  fontFamily: font.serif,
  fontSize: size.aux,
  lineHeight: 1.2,
  color: color.fg2,
  whiteSpace: 'nowrap',
});
globalStyle(compact(stemBranch), { fontSize: size.label, color: color.fg3 });

export const decadalAges = style({
  minWidth: 38,
  fontFamily: font.num,
  fontSize: size.label,
  lineHeight: 1.2,
  color: color.fg3,
  textAlign: 'right',
  whiteSpace: 'nowrap',
  selectors: { [`${cell}[data-now] &`]: { color: color.accent } },
});

/** 紧凑盘页脚右端的当前层宫名。 */
export const footLayer = style({
  marginLeft: 'auto',
  padding: '2px 3px',
  fontFamily: font.serif,
  fontSize: size.label,
  lineHeight: 1,
  fontWeight: 500,
  color: color.fg,
  boxShadow: `inset 0 0 0 ${stroke.hair} ${color.line3}`,
});

/* 宫内收起：量出重叠时逐级收起，收起的内容在读数区都列出。 */
globalStyle(`${cell}[data-fold] ${starFlow}`, { display: 'none' });
globalStyle(`${cell}[data-fold="2"] ${layerName}:not(${layerNameActive}), ${cell}[data-fold="3"] ${layerName}:not(${layerNameActive}), ${cell}[data-fold="4"] ${layerName}:not(${layerNameActive})`, { display: 'none' });
globalStyle(`${cell}[data-fold="3"] ${adjectives}, ${cell}[data-fold="4"] ${adjectives}`, { display: 'none' });
globalStyle(`${cell}[data-fold="4"] ${minorRow}`, { display: 'none' });

/* ── 外圈刻度 ── */

export const overlay = style({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  overflow: 'visible',
  pointerEvents: 'none',
});

export const tick = style({
  opacity: 0,
  transition: 'opacity 250ms',
  selectors: { [`${overlay}[data-on] &`]: { opacity: 1 } },
});

globalStyle(`${tick} line`, { stroke: color.line3, strokeWidth: 1, shapeRendering: 'crispEdges' });
globalStyle(`${tick} text`, { fontFamily: font.num, fontSize: size.label, fill: color.fg3 });

/** 所选大限的十道刻度与起始岁数、标出的虚岁刻度：强调色。 */
export const tickAccent = style({});
globalStyle(`${tickAccent} line`, { stroke: color.accent });
globalStyle(`${tickAccent} text`, { fill: color.accent });

/** 内核加载中：刻度按进度依次点亮为强调色。 */
export const loading = style({});
globalStyle(`${loading} ${tick}`, { opacity: 0.35, transition: 'opacity 150ms' });
globalStyle(`${loading} ${tick}[data-lit]`, { opacity: 1 });
globalStyle(`${loading} ${tick}[data-lit] line`, { stroke: color.accent });

/** 外圈刻度带的点选区：点下即选中该大限。 */
export const ringHit = style({
  pointerEvents: 'all',
  fill: 'transparent',
  cursor: 'pointer',
  transition: `fill ${motion.fast}`,
  selectors: { '&:hover': { fill: color.bg2 } },
});

/* ── 星官连线 ── */

const draw = keyframes({ to: { strokeDashoffset: 0 } });
const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 0.8 } });
const pop = keyframes({ from: { opacity: 0, transform: 'scale(0.4)' }, to: { opacity: 1, transform: 'none' } });

export const lineLength = createVar();

export const skyLine = style({ stroke: color.fg, strokeWidth: 1, fill: 'none', opacity: 0.8 });
export const skyLineOpposite = style({ strokeDasharray: '3 4' });

/** 选宫或换层时：三角按「本宫→三合→三合→本宫」依次描出，对宫虚线淡入。 */
export const drawn = style({
  selectors: {
    [`&:not(${skyLineOpposite})`]: {
      strokeDasharray: lineLength,
      strokeDashoffset: lineLength,
      animation: `${draw} ${motion.draw} ${motion.ease} forwards`,
    },
    [`&${skyLineOpposite}`]: { animation: `${fade} ${motion.draw} ${motion.ease} forwards` },
  },
});

export const baseStar = style({ fill: color.bg, stroke: color.fg3, strokeWidth: 1 });

export const dot = style({
  fill: color.fg,
  stroke: color.bg,
  strokeWidth: 3,
  paintOrder: 'stroke',
  transformBox: 'fill-box',
  transformOrigin: 'center',
});
export const dotSelf = style({ fill: color.accent });

export const popIn = style({ animation: `${pop} ${motion.base} ${motion.ease} both` });

export const label = style({ transformBox: 'fill-box', transformOrigin: 'center' });
globalStyle(`${label} rect`, { fill: color.bg });
globalStyle(`${label} text`, { fontFamily: font.serif, fontSize: size.aux, fontWeight: 500, fill: color.fg2 });
globalStyle(compact(`${label} text`), { fontSize: size.label });
export const labelSelf = style({});
globalStyle(`${labelSelf} text`, { fill: color.accent });

/* ── 中宫文字层 ── */

/** 盖在网格中宫之上；每块自带底色，连线从块后穿过。 */
export const centre = style({
  position: 'absolute',
  inset: `calc(${band} + (100% - 2 * ${band}) / 4)`,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  textAlign: 'center',
  pointerEvents: 'none',
});
globalStyle(compact(centre), { gap: 8 });
globalStyle(`${centre} > *`, { background: color.bg, padding: '2px 8px' });
globalStyle(compact(`${centre} > *`), { padding: '1px 5px' });

export const centreDate = style({ fontSize: size.aux, lineHeight: 1.6, color: color.fg2 });
export const centreDateMain = style({ fontWeight: 400, color: color.fg });

export const pillars = style({ display: 'flex', gap: 16 });
globalStyle(`${centre} > ${pillars}`, { padding: '4px 10px' });
globalStyle(compact(pillars), { gap: 9 });
globalStyle(compact(`${centre} > ${pillars}`), { padding: '3px 6px' });

export const pillar = style({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 });
export const pillarLabel = style({ fontSize: size.label, lineHeight: 1, color: color.fg3 });
export const pillarValue = style({
  writingMode: 'vertical-rl',
  textOrientation: 'upright',
  fontFamily: font.serif,
  fontSize: size.pillar,
  fontWeight: 500,
  lineHeight: 1,
  letterSpacing: '0.08em',
});
globalStyle(compact(pillarValue), { fontSize: size.emphasis });

export const elements = style({ display: 'flex', alignItems: 'baseline', gap: 12, fontSize: size.aux, color: color.fg2 });
globalStyle(compact(elements), { fontSize: size.label, gap: 8 });
export const elementsMain = style({ fontFamily: font.serif, fontSize: size.lede, fontWeight: 600, color: color.fg });
globalStyle(compact(elementsMain), { fontSize: size.starCompact });
export const elementsStar = style({ fontFamily: font.serif, fontStyle: 'normal', fontSize: size.small, color: color.fg });
globalStyle(compact(elementsStar), { fontSize: size.aux });

export const layerLine = style({ fontSize: size.aux, color: color.fg2 });

export const state = style({ display: 'grid', justifyItems: 'center', gap: 10 });
globalStyle(`${centre} > ${state}`, { padding: '8px 12px' });
export const stateTitle = style({ fontFamily: font.serif, fontWeight: 500, fontSize: size.boardState, color: color.fg });
globalStyle(compact(stateTitle), { fontSize: size.boardStateCompact });
export const stateHint = style({ fontSize: size.aux, color: color.fg2 });
globalStyle(compact(stateHint), { fontSize: size.label });

/** 提示语按屏宽二选一：手机上生辰表单在盘的上方，其余在左侧。 */
export const hintWide = style({ '@media': { [media.s]: { display: 'none' } } });
export const hintNarrow = style({ display: 'none', '@media': { [media.s]: { display: 'inline' } } });

/** 出错状态里的重试按钮要能点（中宫层默认不接收指针）。 */
export const stateAction = style({ pointerEvents: 'auto' });

export const bar = style({ position: 'relative', width: 180, height: 1, background: color.line2 });
globalStyle(compact(bar), { width: 120 });
export const barFill = style({ position: 'absolute', left: 0, top: -1, height: 3, background: color.accent });
