import { globalStyle, style } from '@vanilla-extract/css';
import { media } from '../styles/media';
import { color, font, motion, size, space, stroke } from '../styles/tokens.css';

/** 看盘（设计规范第 21 节）：左栏的「看什么」「看哪段时间」，右栏按主题的五步阅读、问 AI、页脚，手机底栏。 */

const ring = (c: string) => `inset 0 0 0 ${stroke.hair} ${c}`;
const hair = (c: string) => `${stroke.hair} solid ${c}`;
/** 点按区上下扩到至少 44px（文字按钮）。 */
const hit = (y: number, x = 0) => ({ content: '""', position: 'absolute' as const, inset: `-${y}px -${x}px` });

/* ── 左栏 ── */

export const nav = style({ minWidth: 0, paddingTop: 16, '@media': { [media.mDown]: { paddingTop: 24 } } });

export const navTitle = style({
  fontFamily: font.serif,
  fontSize: 15,
  fontWeight: 600,
  paddingBottom: 6,
  marginBottom: 8,
  borderBottom: hair(color.line),
});

export const topicGrid = style({ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 4 });

export const topicButton = style({
  display: 'grid',
  placeItems: 'center',
  minHeight: space.hit,
  fontFamily: font.serif,
  fontSize: 15,
  color: color.fg2,
  boxShadow: ring(color.line2),
  transition: `background ${motion.fast}, color ${motion.fast}`,
  selectors: {
    '&:hover': { color: color.fg, boxShadow: ring(color.line3) },
    '&[aria-pressed="true"]': { background: color.btn, color: color.btnFg, boxShadow: 'none' },
    '&:disabled': { color: color.fg3, cursor: 'not-allowed' },
  },
});

export const when = style({ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', '@media': { [media.lDown]: { maxWidth: 420 }, [media.mDown]: { maxWidth: 'none' } } });

export const whenButton = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 1,
  minHeight: 52,
  fontFamily: font.serif,
  fontSize: 15,
  lineHeight: 1.2,
  color: color.fg2,
  boxShadow: ring(color.line2),
  selectors: {
    '& + &': { marginLeft: -1 },
    '&:hover': { color: color.fg },
    '&[aria-pressed="true"]': { background: color.btn, color: color.btnFg, boxShadow: 'none', position: 'relative' },
    '&:disabled': { color: color.fg3, cursor: 'not-allowed' },
  },
});

export const whenSub = style({ fontFamily: font.num, fontSize: size.label, opacity: 0.8 });

export const whenNow = style({ fontSize: size.label, color: color.fg2, marginTop: 8 });

export const textButton = style({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  minHeight: 32,
  fontSize: size.label,
  color: color.fg2,
  selectors: { '&:hover': { color: color.fg }, '&::after': hit(6), '&:disabled': { color: color.fg3, cursor: 'not-allowed' } },
});

export const caret = style({ display: 'inline-flex', transition: `transform ${motion.base}`, selectors: { '[aria-expanded="true"] > &': { transform: 'rotate(180deg)' } } });

export const more = style([textButton, { marginTop: 4 }]);

/* ── 右栏 ── */

export const scroller = style({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  scrollbarWidth: 'thin',
  scrollbarColor: `${color.line2} transparent`,
  scrollPaddingTop: 8,
  '@media': { [media.mDown]: { overflowY: 'visible' } },
});

export const reading = style({ padding: '0 2px 40px 0' });

export const head = style({ padding: '4px 0 16px', borderBottom: hair(color.line2) });

export const headTop = style({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 32 });

export const eyebrow = style({ fontSize: size.label, color: color.fg3 });

export const jumpAsk = style({
  position: 'relative',
  height: 32,
  padding: '0 12px',
  fontSize: size.label,
  color: color.fg,
  boxShadow: ring(color.line3),
  selectors: { '&::after': hit(6), '&:hover': { boxShadow: ring(color.fg) } },
  '@media': { [media.mDown]: { display: 'none' } },
});

export const title = style({
  fontFamily: font.serif,
  fontWeight: 600,
  fontSize: 30,
  lineHeight: 1.25,
  marginTop: 2,
  selectors: { '&:focus': { outline: 'none' } },
  '@media': { [media.s]: { fontSize: 26 } },
});

export const sel = style({ fontSize: 15, lineHeight: 1.75, marginTop: 6 });

export const intro = style({ marginTop: 10, padding: '10px 12px', background: color.bg2, fontSize: size.small, lineHeight: 1.75, color: color.fg2 });

export const term = style({
  display: 'inline',
  font: 'inherit',
  color: 'inherit',
  padding: 0,
  boxShadow: `inset 0 -1px 0 ${color.line3}`,
  position: 'relative',
  selectors: { '&::after': hit(10, 2), '&:hover': { boxShadow: `inset 0 -1px 0 ${color.fg}` } },
});

export const steps = style({ listStyle: 'none', margin: '18px 0 0', padding: 0, counterReset: 'step' });

export const step = style({
  position: 'relative',
  counterIncrement: 'step',
  padding: '0 0 24px 44px',
  selectors: {
    '&::before': {
      content: 'counter(step)',
      position: 'absolute',
      left: 0,
      top: 8,
      width: 28,
      height: 28,
      display: 'grid',
      placeItems: 'center',
      fontFamily: font.num,
      fontSize: size.aux,
      lineHeight: 1,
      color: color.fg,
      background: color.bg,
      boxShadow: ring(color.line3),
      transition: `background ${motion.fast}, color ${motion.fast}`,
    },
    '&::after': { content: '""', position: 'absolute', left: 14, top: 42, bottom: 4, width: 1, background: color.line2 },
    '&:last-child::after': { display: 'none' },
    '&[data-on]::before': { background: color.btn, color: color.btnFg, boxShadow: 'none' },
  },
  '@media': { [media.mDown]: { paddingBottom: 12 } },
});

export const stepHead = style({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: space.hit,
  '@media': { [media.mDown]: { display: 'block', minHeight: 0 } },
});

export const stepTitle = style({
  fontFamily: font.serif,
  fontWeight: 600,
  fontSize: 19,
  flex: 1,
  selectors: { '&:focus': { outline: 'none' } },
  '@media': { [media.mDown]: { lineHeight: '44px' } },
});

export const see = style([textButton, { padding: '0 4px', selectors: { '&[aria-pressed="true"]': { color: color.fg } } }, { '@media': { [media.mDown]: { display: 'none' } } }]);

/** 手机上每步旁边的小盘：4×4 宫格，中间四格空。 */
export const mini = style({
  display: 'none',
  '@media': {
    [media.mDown]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 30px)',
      gridTemplateRows: 'repeat(4, 22px)',
      float: 'right',
      margin: '2px 0 6px 12px',
      boxShadow: ring(color.line2),
      position: 'relative',
    },
  },
  selectors: { '&::after': { content: '""', position: 'absolute', inset: -4 } },
});

export const miniCell = style({
  display: 'grid',
  placeItems: 'center',
  fontFamily: font.serif,
  fontSize: size.label,
  lineHeight: 1,
  color: color.fg3,
  boxShadow: `inset 0 0 0 0.5px ${color.line}`,
  selectors: {
    '&[data-on]': { background: color.bg3, color: color.fg },
    '&[data-focus]': { background: color.bg3, color: color.accent, fontWeight: 600 },
  },
});

export const facts = style({ marginTop: 2 });

globalStyle(`${facts} p`, { fontSize: size.body, lineHeight: 1.8 });
globalStyle(`${facts} p + p`, { marginTop: 4 });

export const acts = style({ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, clear: 'both' });

export const actButton = style({ height: space.hit, padding: '0 16px', fontSize: size.small });

export const how = style({
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: '0 10px',
  fontSize: size.small,
  lineHeight: 1.7,
  color: color.fg2,
  marginTop: 10,
  padding: '8px 0',
  borderTop: hair(color.line),
  clear: 'both',
});

export const howLabel = style({ fontSize: size.label, color: color.fg3, lineHeight: '24px' });

export const notes = style({ marginTop: 6, clear: 'both' });

export const notesLabel = style({ fontSize: size.label, color: color.fg3, margin: '6px 0 2px' });

export const note = style({
  padding: '8px 0',
  borderTop: hair(color.line),
  selectors: { [`${notesLabel} + &`]: { borderTop: 0, paddingTop: 2 } },
});

export const noteName = style({ fontFamily: font.serif, fontWeight: 600, fontSize: size.body });

export const noteText = style({ fontSize: size.small, lineHeight: 1.8, color: color.fg2, marginTop: 2 });

export const noteNone = style([noteText, { color: color.fg3 }]);

export const noteActs = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0 16px' });

export const noteMore = style([textButton, { minHeight: 36, gap: 4, textAlign: 'left' }]);

export const group = style({ padding: '4px 0', borderTop: hair(color.line) });

export const groupButton = style([noteMore, { fontSize: size.small, lineHeight: 1.5, padding: '4px 0' }]);

globalStyle(`${group} ${note}`, { paddingLeft: 12, boxShadow: `inset 1px 0 0 ${color.line2}` });

export const full = style({ margin: '2px 0 6px', padding: '10px 12px', background: color.well, boxShadow: ring(color.line), fontSize: size.small, lineHeight: 1.8 });

export const fullLabel = style({ fontSize: size.label, color: color.fg3, margin: '10px 0 2px', selectors: { '&:first-child': { marginTop: 0 } } });

export const quotes = style({ fontFamily: font.serif, fontSize: size.small, lineHeight: 1.8 });

export const askStep = style([textButton, { marginTop: 2 }]);

/* ── 问 AI ── */

export const ask = style({ marginTop: 24, padding: '18px 16px 16px', boxShadow: ring(color.line3), '@media': { [media.s]: { padding: '16px 12px 14px', margin: '24px -4px 0' } } });

export const askTitle = style({ fontFamily: font.serif, fontWeight: 600, fontSize: 21, selectors: { '&:focus': { outline: 'none' } } });

export const askField = style({ display: 'block', marginTop: 10 });

export const askLabel = style({ display: 'block', fontSize: size.label, color: color.fg2, marginBottom: 4 });

export const askInput = style({
  width: '100%',
  minHeight: 76,
  resize: 'vertical',
  padding: '10px 12px',
  font: 'inherit',
  fontSize: size.body,
  lineHeight: 1.6,
  color: color.fg,
  background: color.well,
  border: 0,
  boxShadow: ring(color.line2),
  selectors: { '&:focus': { boxShadow: ring(color.fg), outline: 'none' } },
});

export const askSummary = style({ fontSize: size.small, lineHeight: 1.7, color: color.fg2, marginTop: 8 });

export const askCount = style({ fontFamily: font.num, color: color.fg });

export const inline = style({
  position: 'relative',
  minHeight: 32,
  padding: '0 0 0 6px',
  fontSize: size.label,
  color: color.fg,
  boxShadow: `inset 0 -1px 0 ${color.line3}`,
  verticalAlign: 'baseline',
  selectors: { '&::after': hit(6, 4) },
});

export const askSub = style({ fontSize: size.label, color: color.fg2, marginTop: 14 });

export const sites = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  gap: 6,
  marginTop: 6,
  '@media': { [media.s]: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' } },
});

export const site = style({ height: space.hit, padding: '0 4px', fontSize: size.small, textDecoration: 'none' });

export const inPage = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: '8px 16px',
  marginTop: 14,
  paddingTop: 12,
  borderTop: hair(color.line),
});

export const inPageText = style({ flex: '1 1 200px', fontSize: size.small, lineHeight: 1.6, color: color.fg2 });

/* ── 页脚 ── */

export const foot = style({ marginTop: 20, fontSize: size.small, lineHeight: 1.7, color: color.fg3 });

export const footButtons = style({ display: 'flex', flexWrap: 'wrap', gap: '0 16px', marginTop: 2 });

export const footButton = style([textButton, { padding: 0 }]);

export const footNote = style({ margin: '0 0 8px', paddingLeft: 10, boxShadow: `inset 2px 0 0 ${color.accent}`, fontSize: size.small, color: color.fg2 });

/* ── 术语浮层 ── */

export const termPop = style({
  width: 340,
  maxWidth: 'calc(100vw - 16px)',
  maxHeight: 'min(60vh, 420px)',
  overflow: 'auto',
  padding: '12px 14px 10px',
  background: color.bg,
  boxShadow: `${ring(color.line3)}, 0 0 0 1px ${color.bg}`,
  outline: 'none',
});

export const termSheet = style({
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  maxHeight: '70vh',
  overflow: 'auto',
  padding: `12px ${space.pad} max(10px, env(safe-area-inset-bottom))`,
  background: color.bg,
  boxShadow: `0 -1px 0 ${color.line3}`,
  outline: 'none',
});

export const termScrim = style({ position: 'fixed', inset: 0, zIndex: 69, background: color.scrim });

export const termHead = style({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 });

export const termTitle = style({ fontFamily: font.serif, fontWeight: 600, fontSize: size.body });

export const termClose = style({ width: space.hit, height: space.hit, display: 'grid', placeItems: 'center', margin: '-10px -12px -10px 0', color: color.fg2 });

export const termBody = style({ fontSize: size.small, lineHeight: 1.8, color: color.fg2, marginTop: 4 });

/* ── 空、加载、失败 ── */

export const empty = style({ padding: '24px 0' });

export const emptyTitle = style({ fontFamily: font.serif, fontWeight: 600, fontSize: 17 });

export const emptyBody = style({ fontSize: size.small, lineHeight: 1.75, color: color.fg2, marginTop: 6 });

/* ── 对话在右栏时的返回 ── */

export const back = style([textButton, { padding: 0, marginBottom: 4, alignSelf: 'flex-start' }]);

/* ── 手机底栏 ── */

export const bar = style({
  display: 'none',
  '@media': {
    [media.mDown]: {
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 30,
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)',
      gap: 8,
      padding: `8px ${space.pad} max(8px, env(safe-area-inset-bottom))`,
      background: color.bg,
      borderTop: hair(color.line2),
    },
  },
});

export const barTopic = style({ height: space.hit, gap: 6, fontSize: size.small });

export const barTopicLabel = style({ color: color.fg3 });

export const barTopicName = style({ fontFamily: font.serif, fontWeight: 600, fontSize: size.body });

export const barAsk = style({ height: space.hit, fontSize: size.small });

/** 「改写这一条」：13px `--fg-3` 链接，读屏名称带条目名。 */
export const rewrite = style({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 36,
  fontSize: size.label,
  color: color.fg3,
  textDecoration: 'none',
  selectors: { '&::after': hit(4, 4), '&:hover': { color: color.fg, boxShadow: `inset 0 -1px 0 ${color.line3}` } },
});
