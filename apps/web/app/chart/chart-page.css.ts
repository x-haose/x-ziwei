import { globalStyle, style } from '@vanilla-extract/css';
import { media } from '../styles/media';
import { color, font, motion, size, space, stroke } from '../styles/tokens.css';
import { boardHeight, boardWidth, ringBand } from './board.css';
import { section as layerSection } from './layer-panel.css';

/**
 * 排盘页网格（设计规范 21.1）：
 * XL ≥1360 三栏「生辰 / 运限 / 释义标记 ｜ 盘 ｜ 右栏」，右栏 ≥480px；L 盘在左上，生辰、运限、释义标记依次排在盘下
 * （不宽于盘），右栏 ≥420px 整列；M、S 单列：生辰 → 运限 → 释义标记 → 盘 → 右栏。
 * 盘：XL/L 是 min(视口高 − 100, 可用宽) 的正方形；M 是 min(视口宽 − 2×页边, 900)；S 贴满屏宽、格子 4:5 竖长。
 */
export const page = style({
  display: 'grid',
  columnGap: space.gap,
  padding: `20px ${space.pad} 28px`,
  gridTemplateColumns: '228px auto minmax(480px, 1fr)',
  gridTemplateRows: 'auto auto auto 1fr',
  gridTemplateAreas: '"birth board prompt" "layer board prompt" "kp board prompt" ". board prompt"',
  vars: {
    [ringBand]: '26px',
    [boardWidth]: `min(calc(100vh - 100px), calc(100vw - 228px - 480px - 2 * ${space.gap} - 2 * ${space.pad}))`,
    [boardHeight]: boardWidth,
  },
  '@media': {
    [media.lDown]: {
      gridTemplateColumns: 'auto minmax(420px, 1fr)',
      gridTemplateRows: 'auto auto auto auto 1fr',
      gridTemplateAreas: '"board prompt" "birth prompt" "layer prompt" "kp prompt" ". prompt"',
      vars: { [boardWidth]: `min(calc(100vh - 100px), calc(100vw - 420px - ${space.gap} - 2 * ${space.pad}))` },
    },
    [media.mDown]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
      gridTemplateRows: 'auto',
      gridTemplateAreas: '"birth" "layer" "kp" "board" "prompt"',
      padding: `8px ${space.pad} 40px`,
      vars: { [ringBand]: '24px', [boardWidth]: `min(calc(100vw - 2 * ${space.pad}), 900px)` },
    },
    [media.s]: {
      padding: `0 ${space.pad} 40px`,
      vars: { [ringBand]: '0px', [boardWidth]: '100vw', [boardHeight]: 'calc(100vw * 1.26)' },
    },
  },
});

/** <1024 有盘时底部固定着一条页签按钮，页面底部留出它的高度。 */
export const withBar = style({ '@media': { [media.mDown]: { paddingBottom: 92 } } });

/** 左栏的释义标记（设计规范 21.3）：全页唯一的位置，三个页签共用。 */
export const kp = style({ gridArea: 'kp', minWidth: 0, paddingTop: 14, '@media': { [media.s]: { paddingTop: 8 } } });

export const birth = style({ gridArea: 'birth', minWidth: 0 });

export const board = style({
  gridArea: 'board',
  '@media': {
    [media.mDown]: { justifySelf: 'center', marginTop: 20 },
    [media.s]: { justifySelf: 'stretch', margin: `14px calc(-1 * ${space.pad}) 0` },
  },
});

/* 手机上盘贴满屏宽，左右不画边框。 */
globalStyle(`${board} > div:first-child`, {
  '@media': { [media.s]: { borderLeft: 0, borderRight: 0 } },
});

/* ── 最近排过 ── */

export const recent = style({ paddingTop: 14 });

export const recentTitle = style({ paddingBottom: 4, fontSize: size.label, fontWeight: 400, color: color.fg3 });

export const recentRow = style({ display: 'flex', alignItems: 'center', borderBottom: `${stroke.hair} solid ${color.line}` });

export const recentGo = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  minHeight: 48,
  padding: '5px 0',
  textAlign: 'left',
});

export const recentBirth = style({
  fontFamily: font.serif,
  fontWeight: 500,
  fontSize: size.body,
  selectors: { [`${recentGo}:hover &`]: { color: color.accent } },
});

export const recentMeta = style({ fontSize: size.label, color: color.fg3 });

export const recentDelete = style({
  display: 'grid',
  placeItems: 'center',
  width: space.hit,
  height: space.hit,
  color: color.fg3,
  selectors: { '&:hover': { color: color.fg } },
});

export const recentNone = style({ padding: '6px 0', fontSize: size.aux, color: color.fg3 });

/* ── 右栏：「看盘 | 对话 | 提示词」（设计规范 21.1；对话栏内部的样式在 chat/chat.css.ts） ── */

/** ≥1024 吸顶（距顶 20px），高为视口高减 104px（L 减 100px），各页签在栏内滚动；<1024 排在盘下，随页面滚动。 */
export const side = style({
  gridArea: 'prompt',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  minWidth: 0,
  height: 'calc(100vh - 104px)',
  position: 'sticky',
  top: 20,
  '@media': {
    [media.lDown]: { height: 'calc(100vh - 100px)' },
    [media.mDown]: { height: 'auto', position: 'static', marginTop: 24 },
    [media.s]: { marginTop: 20 },
  },
});

/** 还没有盘时，手机上整个右栏不显示。 */
export const sideEmpty = style({ '@media': { [media.s]: { display: 'none' } } });

/* L 档：生辰、运限、释义标记排在盘下，不宽于盘。 */
globalStyle(`${page} > ${birth}, ${page} > ${layerSection}, ${page} > ${kp}`, {
  '@media': { [media.lDown]: { maxWidth: boardWidth }, [media.mDown]: { maxWidth: 'none' } },
});

/* ── 提示词页签（设计规范 21.5）：勾选、问题、概要、查看全文与复制、复制链接、聊天 AI 的入口 ── */

export const prompt = style({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  overflowY: 'auto',
  scrollbarWidth: 'thin',
  '@media': { [media.mDown]: { overflowY: 'visible' } },
});

export const head = style({
  paddingBottom: 6,
  fontSize: size.small,
  color: color.fg3,
  borderBottom: `${stroke.hair} solid ${color.line}`,
});

export const checks = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  columnGap: 12,
  borderBottom: `${stroke.hair} solid ${color.line}`,
});

export const check = style({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: space.hit,
  fontSize: size.small,
  color: color.fg2,
  cursor: 'pointer',
  selectors: {
    '&[data-selected]': { color: color.fg },
    '&[data-disabled]': { color: color.fg3, cursor: 'not-allowed' },
  },
});

export const checkBox = style({
  display: 'grid',
  placeContent: 'center',
  flex: 'none',
  width: 15,
  height: 15,
  boxShadow: `inset 0 0 0 ${stroke.hair} ${color.fg3}`,
  color: color.btnFg,
  selectors: {
    [`${check}[data-selected] &`]: { background: color.btn, boxShadow: 'none' },
    [`${check}[data-disabled] &`]: { boxShadow: `inset 0 0 0 ${stroke.hair} ${color.line2}` },
    [`${check}[data-disabled][data-selected] &`]: { background: color.line2 },
    [`${check}[data-selected] &::after`]: {
      content: '""',
      width: 8,
      height: 4,
      borderLeft: `1.5px solid ${color.btnFg}`,
      borderBottom: `1.5px solid ${color.btnFg}`,
      transform: 'translateY(-1px) rotate(-45deg)',
    },
    [`${check}[data-focus-visible] &`]: { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: 2 },
  },
});

export const ask = style({ padding: '12px 0 8px' });

export const textarea = style({
  display: 'block',
  width: '100%',
  height: 68,
  resize: 'none',
  background: 'transparent',
  border: 0,
  borderRadius: 0,
  padding: '9px 11px',
  fontSize: size.body,
  lineHeight: 1.55,
  boxShadow: `inset 0 0 0 ${stroke.hair} ${color.line2}`,
  selectors: {
    '&:focus': { outline: 'none', boxShadow: `inset 0 0 0 ${stroke.hair} ${color.fg}` },
    '&::placeholder': { color: color.fg3 },
    '&:disabled': { boxShadow: `inset 0 0 0 ${stroke.hair} ${color.line}`, cursor: 'not-allowed' },
  },
});


/** 预览框还没有内容时，居中写一句说明。 */
/** 「会发送：…」一行。 */
export const sends = style({ padding: '4px 0 12px', fontSize: size.small, lineHeight: 1.65, color: color.fg2 });

/** 「查看全文」与「复制提示词」等宽并排；<1024 各占一行。 */
export const actions = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
  '@media': { [media.mDown]: { gridTemplateColumns: '1fr' } },
});

export const count = style({ marginLeft: 10, fontFamily: font.num, fontSize: size.aux, fontWeight: 400, color: color.fg3 });

export const message = style({ minHeight: 22, paddingTop: 4, fontSize: size.aux, color: color.accent });

export const linkButton = style({
  alignSelf: 'flex-start',
  height: space.hit,
  padding: '0 10px',
  fontSize: size.small,
  color: color.fg2,
  selectors: { '&:hover': { color: color.fg }, '&:disabled': { color: color.fg3, cursor: 'not-allowed' }, '&[data-ok]': { color: color.accent } },
});

export const ai = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(5, auto)',
  justifyContent: 'space-between',
  marginTop: 16,
  borderTop: `${stroke.hair} solid ${color.line}`,
  '@media': { [media.s]: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' } },
});

export const aiLink = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: space.hit,
  padding: '0 4px',
  fontSize: size.small,
  color: color.fg2,
  selectors: { '&:hover': { color: color.fg, boxShadow: `inset 0 calc(-1 * ${stroke.hair}) 0 ${color.fg}` } },
});


/* ── 生辰摘要（已排盘时，可展开修改） ── */

export const summary = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  width: '100%',
  minHeight: 64,
  padding: '8px 0',
  borderBottom: `${stroke.hair} solid ${color.line}`,
  textAlign: 'left',
});

export const summaryWhen = style({ fontFamily: font.serif, fontSize: size.subtitle, fontWeight: 500, lineHeight: 1.3 });

export const summaryNote = style({
  display: 'block',
  marginTop: 3,
  fontFamily: font.sans,
  fontSize: size.aux,
  fontWeight: 400,
  color: color.fg2,
});

export const summaryToggle = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flex: 'none',
  fontSize: size.aux,
  color: color.fg2,
  selectors: { [`${summary}:hover &`]: { color: color.fg } },
});

export const summaryCaret = style({
  transition: `transform ${motion.base}`,
  selectors: { [`${summary}[aria-expanded="true"] &`]: { transform: 'rotate(180deg)' } },
});

export const candidates = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 0 8px',
  borderBottom: `${stroke.hair} solid ${color.line}`,
});

export const candidatesLabel = style({ flex: 'none', fontSize: size.label, color: color.fg3 });
export const candidatesSeg = style({ flex: 1 });

