import { globalStyle, style } from '@vanilla-extract/css';
import { media } from '../styles/media';
import { color, font, size, space, stroke } from '../styles/tokens.css';
import { boardHeight, boardWidth, ringBand } from './board.css';

/**
 * 排盘页网格（设计规范第 4 节）：
 * XL ≥1360 三栏「生辰/运限/读数 ｜ 盘 ｜ 提示词」；L 两栏，提示词在盘下整宽；
 * M 两等列，生辰、运限、盘依次整宽，读数与提示词并排；S 单列。
 * 盘：XL/L 是 min(视口高 − 100, 可用宽) 的正方形；M 是 min(视口宽 − 2×页边, 900)；
 * S 贴满屏宽、格子 4:5 竖长。
 */
export const page = style({
  display: 'grid',
  columnGap: space.gap,
  padding: `20px ${space.pad} 28px`,
  gridTemplateColumns: '228px auto minmax(300px, 1fr)',
  gridTemplateRows: 'auto auto 1fr',
  gridTemplateAreas: '"birth board prompt" "layer board prompt" "read board prompt"',
  vars: {
    [ringBand]: '26px',
    [boardWidth]: `min(calc(100vh - 100px), calc(100vw - 228px - 320px - 2 * ${space.gap} - 2 * ${space.pad}))`,
    [boardHeight]: boardWidth,
  },
  '@media': {
    [media.lDown]: {
      gridTemplateColumns: '256px auto',
      gridTemplateRows: 'auto auto 1fr auto',
      gridTemplateAreas: '"birth board" "layer board" "read board" "prompt prompt"',
      vars: { [boardWidth]: `min(calc(100vh - 100px), calc(100vw - 256px - ${space.gap} - 2 * ${space.pad}))` },
    },
    [media.mDown]: {
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
      gridTemplateRows: 'auto auto auto auto',
      gridTemplateAreas: '"birth birth" "layer layer" "board board" "read prompt"',
      padding: `8px ${space.pad} 40px`,
      vars: { [ringBand]: '24px', [boardWidth]: `min(calc(100vw - 2 * ${space.pad}), 900px)` },
    },
    [media.s]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
      gridTemplateAreas: '"birth" "layer" "board" "read" "prompt"',
      padding: `0 ${space.pad} 40px`,
      vars: { [ringBand]: '0px', [boardWidth]: '100vw', [boardHeight]: 'calc(100vw * 1.26)' },
    },
  },
});

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

/* ── 提示词 ── */

export const prompt = style({
  gridArea: 'prompt',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  minWidth: 0,
  height: boardHeight,
  '@media': {
    [media.lDown]: {
      height: 'auto',
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.3fr)',
      gridTemplateRows: 'auto auto auto 1fr auto auto',
      gridTemplateAreas: '"h h" "checks pvh" "ask pv" "acts pv" "msg pv" "ai pv"',
      columnGap: space.gap,
      marginTop: 40,
    },
    [media.mDown]: { display: 'flex', marginTop: 20 },
    [media.s]: { paddingTop: 28, marginTop: 0 },
  },
});

/** 还没有盘时，手机上整块提示词区不显示。 */
export const promptEmpty = style({ '@media': { [media.s]: { display: 'none' } } });

export const head = style({
  gridArea: 'h',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  minHeight: 30,
  paddingBottom: 6,
  borderBottom: `${stroke.hair} solid ${color.line}`,
  '@media': { [media.lDown]: { marginBottom: 6 } },
});

export const headTitle = style({ fontFamily: font.serif, fontSize: size.subtitle, fontWeight: 600, color: color.fg });

export const headAux = style({ fontSize: size.label, color: color.fg3 });

export const checks = style({
  gridArea: 'checks',
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

export const ask = style({ gridArea: 'ask', padding: '12px 0' });

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

export const previewHead = style({
  gridArea: 'pvh',
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  paddingBottom: 6,
  fontSize: size.label,
  color: color.fg3,
  '@media': { [media.lDown]: { alignSelf: 'end' } },
});

export const previewMode = style({ height: 32, marginLeft: 'auto', marginRight: 12 });

globalStyle(`${previewMode} > button`, { minHeight: 32, padding: '0 10px', fontSize: size.label });

export const preview = style({
  gridArea: 'pv',
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  padding: '12px 12px 16px',
  background: color.well,
  boxShadow: `inset 0 0 0 ${stroke.hair} ${color.line}`,
  fontSize: size.small,
  lineHeight: 1.75,
  color: color.fg2,
  scrollbarWidth: 'thin',
  scrollbarColor: `${color.line2} transparent`,
  '@media': {
    [media.lDown]: { minHeight: 360, maxHeight: 460 },
    [media.mDown]: { minHeight: 320, maxHeight: 420 },
  },
});

/** 预览框还没有内容时，居中写一句说明。 */
export const previewOff = style({ display: 'grid', placeItems: 'center', color: color.fg3, textAlign: 'center' });

export const actions = style({
  gridArea: 'acts',
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: 8,
  marginTop: 12,
  '@media': { [media.s]: { gridTemplateColumns: '1fr' } },
});

export const message = style({ gridArea: 'msg', minHeight: 22, paddingTop: 4, fontSize: size.aux, color: color.accent });

export const ai = style({
  gridArea: 'ai',
  display: 'grid',
  gridTemplateColumns: 'repeat(5, auto)',
  justifyContent: 'space-between',
  borderTop: `${stroke.hair} solid ${color.line}`,
  '@media': {
    [media.lDown]: { alignSelf: 'end' },
    [media.mDown]: { alignSelf: 'stretch' },
    [media.s]: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' },
  },
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
