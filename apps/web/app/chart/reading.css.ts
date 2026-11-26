import { globalStyle, style } from '@vanilla-extract/css';
import { media } from '../styles/media';
import { color, font, motion, size, space, stroke } from '../styles/tokens.css';

/** 看盘（设计规范 21.4）。 */

const ring = (c: string) => `inset 0 0 0 ${stroke.hair} ${c}`;
const hair = (c: string) => `${stroke.hair} solid ${c}`;

export const reading = style({ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0 });

/** 子页签在看盘区内吸顶；看盘区在栏内滚动（<1024 随页面滚动）。 */
export const scroller = style({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  scrollbarWidth: 'thin',
  scrollbarColor: `${color.line2} transparent`,
  '@media': { [media.mDown]: { overflowY: 'visible' } },
});

export const views = style({ position: 'sticky', top: 0, zIndex: 2, background: color.bg, flex: 'none' });

globalStyle(`${views} > button`, { minHeight: 40, fontSize: size.small });

export const body = style({ padding: '0 0 24px' });

export const head = style({
  display: 'flex',
  alignItems: 'baseline',
  flexWrap: 'wrap',
  gap: '4px 10px',
  padding: '16px 0 8px',
  borderBottom: hair(color.line2),
});

export const headName = style({
  fontFamily: font.serif,
  fontWeight: 600,
  fontSize: 28,
  lineHeight: 1.2,
  color: color.accent,
  selectors: { '&:focus': { outline: 'none' } },
});

export const headGz = style({ fontFamily: font.serif, fontSize: size.emphasis, color: color.fg2 });

export const headAges = style({ marginLeft: 'auto', fontFamily: font.num, fontSize: size.aux, color: color.fg3 });

export const tag = style({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '3px 5px',
  fontFamily: font.sans,
  fontWeight: 400,
  fontSize: size.label,
  lineHeight: 1,
  color: color.fg2,
  boxShadow: ring(color.line3),
  alignSelf: 'center',
});

export const layerNames = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px 20px',
  padding: '8px 0',
  borderBottom: hair(color.line),
  fontSize: size.small,
});

export const layerKind = style({ marginRight: 8, fontSize: size.aux, color: color.fg3 });

export const layerName = style({ fontFamily: font.serif, fontWeight: 600 });

export const section = style({ padding: '12px 0 8px', borderBottom: hair(color.line) });

export const sectionTitle = style({
  display: 'flex',
  alignItems: 'baseline',
  flexWrap: 'wrap',
  gap: '4px 10px',
  marginBottom: 4,
  fontFamily: font.serif,
  fontWeight: 600,
  fontSize: size.body,
});

export const sectionAside = style({ fontFamily: font.serif, fontWeight: 400, fontSize: size.small, color: color.fg2 });

/** 四化两行：标签列 64px ｜ 内容，内容折行时与上一行对齐。 */
export const huaRow = style({
  display: 'grid',
  gridTemplateColumns: '64px minmax(0, 1fr)',
  alignItems: 'baseline',
  gap: '0 8px',
  padding: '2px 0',
  fontSize: size.small,
  lineHeight: 1.7,
  color: color.fg2,
});

export const huaLabel = style({ fontSize: size.label, color: color.fg3 });

export const huaItems = style({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 14px' });

export const huaItem = style({ display: 'inline-flex', alignItems: 'center', gap: 6 });

/** 四化块在行内：沿用盘上的样式（第 6 节），去掉竖排时的上距。 */
export const tile = style({ display: 'inline-block', margin: '0 0 0 2px' });

export const palaceLink = style({
  position: 'relative',
  fontFamily: font.serif,
  fontWeight: 600,
  lineHeight: 1.5,
  color: color.fg,
  boxShadow: `inset 0 calc(-1 * ${stroke.hair}) 0 ${color.line3}`,
  selectors: {
    '&::after': { content: '""', position: 'absolute', inset: '-10px -4px' },
    '&:hover': { color: color.accent, boxShadow: `inset 0 calc(-1 * ${stroke.hair}) 0 ${color.accent}` },
    '&:focus-visible': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: 2 },
  },
});

export const none = style({ fontSize: size.small, lineHeight: 1.7, color: color.fg3 });

export const star = style({ padding: '8px 0', borderTop: hair(color.line), selectors: { '&:first-child': { borderTop: 0, paddingTop: 2 } } });

export const starHead = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 6px' });

export const starName = style({ marginRight: 2, fontFamily: font.serif, fontWeight: 600, fontSize: size.star });

export const starNameSmall = style([starName, { fontSize: size.body }]);

export const brightness = style({ fontSize: size.aux, color: color.fg2 });

/** 摘要层释义：14px 次级色。 */
export const note = style({ marginTop: 2, fontSize: size.small, lineHeight: 1.75, color: color.fg2 });

globalStyle(`${note} p`, { margin: 0 });
globalStyle(`${note} > div`, { fontSize: size.small, lineHeight: 1.75, color: color.fg2 });

export const noteNone = style({ marginTop: 2, fontSize: size.small, color: color.fg3 });

export const more = style({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  height: 32,
  fontSize: size.aux,
  color: color.fg2,
  selectors: {
    '&::after': { content: '""', position: 'absolute', inset: '-6px -4px' },
    '&:hover': { color: color.fg },
    '&:focus-visible': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: 2 },
  },
});

export const moreCaret = style({
  transition: `transform ${motion.base}`,
  selectors: { [`${more}[aria-expanded="true"] &`]: { transform: 'rotate(180deg)' } },
  '@media': { [media.reducedMotion]: { transition: 'none' } },
});

/** 展开的全文：`--well` 底。 */
export const full = style({ margin: '4px 0', padding: '10px 12px', background: color.well, boxShadow: ring(color.line) });

export const fullLabel = style({ margin: '10px 0 2px', fontSize: size.label, color: color.fg3, selectors: { '&:first-child': { marginTop: 0 } } });

export const attrs = style({ marginTop: 8, fontSize: size.aux, lineHeight: 1.7, color: color.fg2 });

export const quotes = style({ fontFamily: font.serif, fontSize: size.small, lineHeight: 1.8, color: color.fg });

export const pattern = style({ padding: '8px 0', borderTop: hair(color.line), selectors: { '&:first-of-type': { borderTop: 0, paddingTop: 2 } } });

export const patternHead = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 8px' });

export const patternName = style({ fontFamily: font.serif, fontWeight: 600, fontSize: size.emphasis });

export const scope = style({ padding: '2px 5px', fontSize: size.label, color: color.fg2, boxShadow: ring(color.line2) });

export const patternPalace = style({ marginLeft: 'auto', fontSize: size.small });

export const patternStars = style({ marginTop: 2, fontSize: size.aux, lineHeight: 1.7, color: color.fg2 });

export const patternStarPalace = style({ marginLeft: 3, color: color.fg3 });

export const surround = style({ listStyle: 'none' });

export const surroundRow = style({
  display: 'grid',
  gridTemplateColumns: '34px auto 1fr',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  minHeight: space.hit,
  padding: '4px 0',
  textAlign: 'left',
  borderBottom: hair(color.line),
  selectors: { '&:focus-visible': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: -2 } },
});

export const surroundRole = style({ fontSize: size.label, color: color.fg3 });

export const surroundName = style({
  fontFamily: font.serif,
  fontWeight: 600,
  fontSize: size.body,
  color: color.fg2,
  selectors: { [`${surroundRow}:hover &`]: { color: color.accent } },
});

export const surroundBranch = style({ marginLeft: 4, fontWeight: 400, fontSize: size.aux, color: color.fg3 });

export const surroundStars = style({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: '2px 10px',
  fontFamily: font.serif,
  fontSize: size.small,
  color: color.fg2,
});

export const surroundStar = style({ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' });

export const foot = style({ paddingTop: 10 });

export const footButton = style({
  height: space.hit,
  fontSize: size.small,
  color: color.fg2,
  selectors: { '&:hover': { color: color.fg }, '&:focus-visible': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: 2 } },
});

export const hint = style({ padding: '12px 0 4px', fontSize: size.aux, color: color.fg3 });

/** 表格放不下时只在自己的容器里横向滚动（第 13 节同一规则）。 */
export const tableWrap = style({ overflowX: 'auto' });

export const table = style({ width: '100%', borderCollapse: 'collapse', fontSize: size.small });

globalStyle(`${table} th`, {
  padding: '6px 8px 6px 0',
  fontSize: size.label,
  fontWeight: 400,
  color: color.fg3,
  textAlign: 'left',
  borderBottom: hair(color.line2),
  whiteSpace: 'nowrap',
});

globalStyle(`${table} td`, { padding: '4px 10px 4px 0', borderBottom: hair(color.line), whiteSpace: 'nowrap', verticalAlign: 'middle' });
globalStyle(`${table} td:first-child`, { paddingLeft: 8 });

export const rowOn = style({});
globalStyle(`${rowOn} td`, { background: color.bg3 });
globalStyle(`${rowOn} td:first-child`, { boxShadow: `inset 2px 0 0 ${color.fg}` });

export const rowButton = style({
  minHeight: 40,
  fontFamily: font.num,
  fontSize: size.body,
  fontWeight: 500,
  color: color.fg,
  boxShadow: `inset 0 calc(-1 * ${stroke.hair}) 0 ${color.line3}`,
  selectors: {
    '&:hover': { boxShadow: `inset 0 calc(-1 * ${stroke.hair}) 0 ${color.fg}` },
    '&:focus-visible': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: 2 },
  },
});

export const rowSub = style({ display: 'block', margin: '-2px 0 4px', fontFamily: font.num, fontSize: size.label, color: color.fg3 });

export const gz = style({ fontFamily: font.serif, color: color.fg2 });

export const cellSerif = style({ fontFamily: font.serif });

export const branch = style({ marginLeft: 4, fontSize: size.aux, color: color.fg3 });

export const four = style({ fontFamily: font.serif, whiteSpace: 'normal', lineHeight: 1.6, minWidth: 120 });

export const fourItem = style({ display: 'inline-block', marginRight: 8, whiteSpace: 'nowrap' });

export const fourMark = style({ marginLeft: 1, fontStyle: 'normal', fontFamily: font.sans, fontSize: size.label, color: color.fg3 });

export const nowTag = style({ marginLeft: 6, padding: '2px 4px', fontSize: size.label, color: color.fg2, boxShadow: ring(color.line3) });

export const pager = style({ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 });

export const pagerButton = style({
  width: space.hit,
  height: space.hit,
  flex: 'none',
  fontSize: 18,
  color: color.fg2,
  boxShadow: ring(color.line2),
  selectors: { '&:disabled': { color: color.fg3, boxShadow: ring(color.line), cursor: 'not-allowed' } },
});

export const pagerText = style({ flex: 1, textAlign: 'center', fontSize: size.small, color: color.fg2 });

export const pagerAges = style({ marginRight: 8, fontFamily: font.num, fontWeight: 500, color: color.fg });

export const empty = style({ padding: '24px 0' });

export const emptyTitle = style({ fontFamily: font.serif, fontWeight: 600, fontSize: 17 });

export const emptyBody = style({ marginTop: 6, fontSize: size.small, lineHeight: 1.75, color: color.fg2 });
