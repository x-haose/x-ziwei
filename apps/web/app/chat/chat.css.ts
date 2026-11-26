import { globalStyle, keyframes, style } from '@vanilla-extract/css';
import { media } from '../styles/media';
import { color, font, motion, size, space, stroke } from '../styles/tokens.css';

/** 对话（设计规范第 19 节）。版式的网格在 `chart-page.css.ts`，这里是右栏、全屏面板与抽屉里的部件。 */

const ring = (c: string) => `inset 0 0 0 ${stroke.hair} ${c}`;
const hair = (c: string) => `${stroke.hair} solid ${c}`;

const pulse = keyframes({ from: { opacity: 0.35 }, to: { opacity: 1 } });
const blink = keyframes({ to: { visibility: 'hidden' } });

/* ── 右栏里的对话 ── */

export const panel = style({ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, outline: 'none' });

/** 右栏里对话顶部的「‹ 回到…」。 */
export const backButton = style({ alignSelf: 'flex-start', minHeight: 32, marginBottom: 4, fontSize: size.label, color: color.fg2, selectors: { '&:hover': { color: color.fg } } });

/* ── 对话栏 ── */

export const chat = style({ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 });

export const toolbar = style({ display: 'flex', alignItems: 'center', gap: 4, flex: 'none' });

export const pick = style({ flex: 1, minWidth: 0, height: 40, fontSize: size.small });

export const pickSheet = style({ height: space.hit });

export const pickService = style({ fontWeight: 500, marginRight: 6 });

export const pickModel = style({ color: color.fg2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });

export const textButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 'none',
  height: space.hit,
  padding: '0 10px',
  fontSize: size.small,
  color: color.fg2,
  selectors: {
    '&:hover': { color: color.fg },
    '&:disabled': { color: color.fg3, cursor: 'not-allowed' },
    '&:focus-visible': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: -2 },
  },
});

export const context = style({ flex: 'none', padding: '8px 0', fontSize: size.small, lineHeight: 1.6, color: color.fg3, borderBottom: hair(color.line) });

export const contextBirth = style({ color: color.fg2 });

export const log = style({
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  padding: '14px 2px 18px 0',
  scrollbarWidth: 'thin',
  scrollbarColor: `${color.line2} transparent`,
  outline: 'none',
  '@media': { [media.mDown]: { minHeight: 0 } },
});

export const userRow = style({ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 6, margin: '0 0 14px' });

export const user = style({
  maxWidth: '88%',
  width: 'fit-content',
  padding: '9px 12px',
  background: color.bg2,
  fontSize: size.body,
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  '@media': { [media.s]: { maxWidth: '92%' } },
});

export const editBox = style({ width: '100%', maxWidth: '100%' });

export const editArea = style({
  display: 'block',
  width: '100%',
  minWidth: 'min(260px, 100%)',
  minHeight: 72,
  resize: 'vertical',
  background: color.bg,
  border: 0,
  borderRadius: 0,
  boxShadow: ring(color.fg),
  padding: '8px 10px',
  font: 'inherit',
  color: color.fg,
  selectors: { '&:focus': { outline: 'none' } },
});

export const editActions = style({ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8 });

export const smallButton = style({ height: 36, padding: '0 12px', fontSize: size.aux });

export const answer = style({ margin: '0 0 18px' });

export const caret = style({
  display: 'inline-block',
  width: '.5em',
  height: '1.05em',
  marginLeft: 2,
  verticalAlign: '-.15em',
  background: color.fg,
  animation: `${blink} 1s steps(2, start) infinite`,
  '@media': { [media.reducedMotion]: { animation: 'none' } },
});

export const foot = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0 4px', marginTop: -4, fontSize: size.label, color: color.fg3 });

export const footWho = style({ marginRight: 6 });

export const footButton = style({
  position: 'relative',
  height: 32,
  padding: '0 8px',
  fontSize: size.aux,
  color: color.fg2,
  selectors: {
    '&::after': { content: '""', position: 'absolute', inset: '-6px 0' },
    '&:hover': { color: color.fg },
    '&:focus-visible': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: -2 },
  },
});

export const stopped = style({ color: color.fg2, marginRight: 4 });

/* 「它查了什么」 */

export const calls = style({ margin: '0 0 10px' });

export const callsToggle = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  minHeight: 36,
  padding: '4px 0',
  fontSize: size.aux,
  lineHeight: 1.5,
  color: color.fg3,
  textAlign: 'left',
  boxShadow: `inset 0 calc(-1 * ${stroke.hair}) 0 ${color.line}`,
  selectors: { '&:hover': { color: color.fg2 }, '&:focus-visible': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: 2 } },
});

export const callsText = style({ flex: 1, minWidth: 0 });

export const callsCaret = style({
  flex: 'none',
  transition: `transform ${motion.base}`,
  selectors: { [`${callsToggle}[aria-expanded="true"] &`]: { transform: 'rotate(180deg)' } },
  '@media': { [media.reducedMotion]: { transition: 'none' } },
});

const dot = { display: 'inline-block', flex: 'none', width: 7, height: 7, borderRadius: '50%' } as const;

export const runDot = style({
  ...dot,
  background: color.accent,
  animation: `${pulse} 1s ${motion.ease} infinite alternate`,
  '@media': { [media.reducedMotion]: { animation: 'none' } },
});

export const doneDot = style({ ...dot, boxShadow: ring(color.fg3) });

export const callList = style({ padding: '4px 0 2px' });

export const callRow = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto auto',
  alignItems: 'center',
  gap: '2px 12px',
  padding: '6px 0',
  borderBottom: hair(color.line),
  fontSize: size.aux,
  color: color.fg2,
});

export const callName = style({ fontWeight: 500, color: color.fg, fontSize: size.small });

export const callScope = style({ gridColumn: '1 / -1', fontSize: size.label, color: color.fg3, lineHeight: 1.5 });

export const callMs = style({ fontFamily: font.num, fontSize: size.label, color: color.fg3 });

export const see = style({
  position: 'relative',
  height: 32,
  padding: '0 6px',
  fontSize: size.aux,
  color: color.fg2,
  boxShadow: `inset 0 calc(-1 * ${stroke.hair}) 0 ${color.line3}`,
  selectors: {
    '&::after': { content: '""', position: 'absolute', inset: '-6px 0' },
    '&:hover': { color: color.fg, boxShadow: `inset 0 calc(-1 * ${stroke.hair}) 0 ${color.fg}` },
    '&:focus-visible': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: 2 },
  },
});

/* 错误块 */

export const error = style({ margin: '4px 0 12px', padding: '10px 12px', background: color.bg2, boxShadow: `inset 2px 0 0 ${color.accent}` });

export const errorTitle = style({ display: 'block', fontFamily: font.serif, fontWeight: 600, fontSize: size.body, color: color.accent });

export const errorBody = style({ marginTop: 2, fontSize: size.small, lineHeight: 1.7, color: color.fg2, overflowWrap: 'anywhere' });

export const actions = style({ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 });

export const actionButton = style({ height: 40, padding: '0 14px', fontSize: size.small });

/* 截断分隔线与常驻说明 */

export const cut = style({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  margin: '4px 0 16px',
  fontSize: size.label,
  color: color.fg3,
  selectors: { '&::before, &::after': { content: '""', flex: 1, height: 1, background: color.line2 } },
});

export const note = style({
  flex: 'none',
  margin: '8px 0 0',
  padding: '9px 12px',
  fontSize: size.small,
  lineHeight: 1.65,
  color: color.fg2,
  boxShadow: `inset 2px 0 0 ${color.line3}, ${ring(color.line)}`,
});

export const noteLead = style({ color: color.fg, fontWeight: 500 });

/** 内核加载的细进度条：1px 底线上 3px 赭红填充（与盘区的进度条同一用法）。 */

/* 输入框与费用说明 */

export const composer = style({
  flex: 'none',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'end',
  gap: 8,
  marginTop: 10,
  paddingTop: 10,
  borderTop: hair(color.line),
});

export const input = style({
  display: 'block',
  width: '100%',
  minHeight: 48,
  maxHeight: 168,
  resize: 'none',
  overflowY: 'auto',
  background: 'transparent',
  border: 0,
  borderRadius: 0,
  boxShadow: ring(color.line2),
  padding: '11px 12px',
  fontSize: size.body,
  lineHeight: 1.6,
  selectors: {
    '&:focus': { outline: 'none', boxShadow: ring(color.fg) },
    '&::placeholder': { color: color.fg3 },
    '&:disabled': { boxShadow: ring(color.line), cursor: 'not-allowed' },
  },
});

export const sendButton = style({ minWidth: 76 });

export const fine = style({ display: 'block', flex: 'none', padding: '6px 0 0', fontSize: size.aux, lineHeight: 1.5, color: color.fg3 });

/* 空状态 */

export const empty = style({ padding: '18px 0 8px' });

export const emptyTitle = style({ fontFamily: font.serif, fontWeight: 600, fontSize: size.emphasis });

export const emptyBody = style({ marginTop: 4, fontSize: size.small, lineHeight: 1.7, color: color.fg2 });

export const suggestions = style({ marginTop: 12 });

export const suggestion = style({
  display: 'block',
  width: '100%',
  minHeight: space.hit,
  padding: '8px 0',
  fontSize: size.body,
  textAlign: 'left',
  borderBottom: hair(color.line),
  selectors: {
    '&:hover': { color: color.accent },
    '&:disabled': { color: color.fg3, cursor: 'not-allowed' },
    '&:focus-visible': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: 2 },
  },
});

/* ── 设置表单 ── */

export const setup = style({ flex: 1, minHeight: 0, overflow: 'auto', padding: '8px 0 4px' });

export const setupTitle = style({ fontFamily: font.serif, fontWeight: 600, fontSize: 17 });

export const setupBody = style({ marginTop: 4, fontSize: size.small, lineHeight: 1.7, color: color.fg2 });

export const form = style({ display: 'grid', gap: 12, marginTop: 14 });

export const fieldLabel = style({ display: 'block', marginBottom: 6, fontSize: size.label, color: color.fg3 });

export const providers = style({ display: 'grid', gap: 1, padding: 1 });

export const provider = style({
  display: 'grid',
  gridTemplateColumns: '16px 1fr auto',
  alignItems: 'center',
  gap: 10,
  minHeight: 48,
  padding: '4px 12px',
  textAlign: 'left',
  cursor: 'pointer',
  boxShadow: `0 0 0 ${stroke.hair} ${color.line2}`,
  outline: 'none',
  selectors: {
    '&[data-selected]': { background: color.bg3 },
    '&[data-focus-visible]': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: -3 },
  },
});

export const providerDot = style({
  width: 12,
  height: 12,
  borderRadius: '50%',
  boxShadow: ring(color.fg3),
  selectors: { [`${provider}[data-selected] &`]: { boxShadow: `inset 0 0 0 3.5px ${color.fg}` } },
});

export const providerName = style({ fontWeight: 500, fontSize: size.body });

export const providerHost = style({ fontFamily: font.num, fontSize: size.label, color: color.fg3 });

export const textInput = style({
  display: 'block',
  width: '100%',
  height: space.hit,
  padding: '0 12px',
  background: 'transparent',
  border: 0,
  borderRadius: 0,
  boxShadow: ring(color.line2),
  fontSize: size.body,
  selectors: {
    '&:focus': { outline: 'none', boxShadow: ring(color.fg) },
    '&::placeholder': { color: color.fg3 },
    '&[aria-invalid="true"]': { boxShadow: ring(color.accent) },
  },
});

export const keyRow = style({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto' });

export const keyInput = style([textInput, { fontFamily: font.mono, fontSize: size.code }]);

export const keyToggle = style([textButton, { boxShadow: ring(color.line2), marginLeft: -1 }]);

export const fieldError = style({ marginTop: 6, paddingLeft: 8, fontSize: size.aux, color: color.accent, boxShadow: `inset 2px 0 0 ${color.accent}` });

export const saved = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  minHeight: space.hit,
  fontSize: size.small,
  color: color.fg2,
  borderBottom: hair(color.line),
});

export const savedKey = style({ fontFamily: font.mono, fontSize: size.code, color: color.fg, marginLeft: 8 });

export const formActions = style({ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 });

export const result = style({ padding: '8px 10px', fontSize: size.small, lineHeight: 1.65, background: color.bg2, overflowWrap: 'anywhere' });

export const resultOk = style({ boxShadow: `inset 2px 0 0 ${color.fg}` });

export const resultBad = style({ boxShadow: `inset 2px 0 0 ${color.accent}`, color: color.fg });

export const resultRun = style([runDot, { marginRight: 8, verticalAlign: 1 }]);

export const privacy = style({
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: 10,
  marginTop: 4,
  paddingTop: 12,
  borderTop: hair(color.line),
  fontSize: size.small,
  lineHeight: 1.65,
  color: color.fg2,
});

export const privacyLead = style({ fontWeight: 500, color: color.fg });

globalStyle(`${privacy} > svg`, { marginTop: 4 });

/* 模型选择器 */

export const pickNote = style({ padding: '8px 12px 4px', fontSize: size.label, color: color.fg3, lineHeight: 1.5 });

export const pickTag = style({ fontSize: size.label, color: color.fg3 });

export const pickLink = style([textButton, { width: '100%', justifyContent: 'flex-start', padding: '0 12px', borderTop: hair(color.line) }]);

/* ── 抽屉、记录与确认框 ── */

export const scrim = style({ position: 'fixed', inset: 0, zIndex: 80, background: color.scrim });

export const drawer = style({
  position: 'fixed',
  zIndex: 81,
  top: 0,
  right: 0,
  bottom: 0,
  width: 'min(480px, 100vw)',
  display: 'flex',
  flexDirection: 'column',
  background: color.bg,
  boxShadow: `calc(-1 * ${stroke.hair}) 0 0 ${color.line3}`,
  outline: 'none',
  '@media': { [media.s]: { boxShadow: 'none' } },
});

export const drawerDialog = style({ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, outline: 'none' });

export const drawerHead = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  padding: '20px 24px 14px',
  borderBottom: hair(color.line),
  '@media': { [media.s]: { paddingLeft: 16, paddingRight: 16 } },
});

export const drawerTitle = style({ fontFamily: font.serif, fontWeight: 600, fontSize: 22, lineHeight: 1.35 });

export const drawerSub = style({ marginTop: 2, fontSize: size.aux, color: color.fg2 });

export const drawerClose = style({
  display: 'grid',
  placeItems: 'center',
  flex: 'none',
  width: space.hit,
  height: space.hit,
  margin: '-6px -8px 0 auto',
  color: color.fg2,
  selectors: { '&[data-hovered]': { color: color.fg }, '&[data-focus-visible]': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: -1 } },
});

export const drawerBody = style({
  flex: 1,
  overflow: 'auto',
  padding: '4px 24px 32px',
  scrollbarWidth: 'thin',
  '@media': { [media.s]: { paddingLeft: 16, paddingRight: 16 } },
});

export const historyRow = style({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', borderBottom: hair(color.line) });

export const historyGo = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 2,
  minHeight: 56,
  padding: '8px 0',
  textAlign: 'left',
  selectors: { '&:focus-visible': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: 2 } },
});

export const historyTitle = style({
  fontFamily: font.serif,
  fontWeight: 600,
  fontSize: size.body,
  lineHeight: 1.45,
  overflowWrap: 'anywhere',
  selectors: { [`${historyGo}:hover &`]: { color: color.accent } },
});

export const historyCurrent = style({
  marginLeft: 8,
  padding: '2px 5px',
  fontFamily: font.sans,
  fontWeight: 400,
  fontSize: size.label,
  boxShadow: ring(color.fg),
  verticalAlign: 2,
});

export const historyMeta = style({ fontSize: size.aux, color: color.fg3 });

export const historyDelete = style({
  display: 'grid',
  placeItems: 'center',
  width: space.hit,
  height: space.hit,
  color: color.fg3,
  selectors: { '&:hover': { color: color.fg }, '&:focus-visible': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: -2 } },
});

export const historyFoot = style({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 16, fontSize: size.aux, color: color.fg3 });

export const dialog = style({
  position: 'fixed',
  zIndex: 90,
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'min(440px, calc(100vw - 32px))',
  padding: 24,
  background: color.bg,
  boxShadow: `0 0 0 ${stroke.hair} ${color.line3}`,
  outline: 'none',
});

export const dialogScrim = style([scrim, { zIndex: 89 }]);

export const dialogTitle = style({ fontFamily: font.serif, fontWeight: 600, fontSize: 20, lineHeight: 1.4, overflowWrap: 'anywhere' });

export const dialogBody = style({ marginTop: 10, fontSize: size.body, lineHeight: 1.75, color: color.fg2 });

export const dialogActions = style({ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 });

export const danger = style({
  background: color.accent,
  color: color.accentFg,
  selectors: { '&:hover, &[data-hovered]': { background: `color-mix(in oklch, ${color.accent} 88%, ${color.fg})` } },
});

/* ── 平板与手机：全屏面板、右栏里的入口、底部条 ── */

export const sheet = style({ position: 'fixed', inset: 0, zIndex: 75, display: 'flex', flexDirection: 'column', background: color.bg, outline: 'none' });

export const sheetDialog = style({ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, outline: 'none' });

export const sheetHead = style({ display: 'flex', alignItems: 'center', gap: 4, flex: 'none', height: 56, padding: '0 6px 0 4px', borderBottom: hair(color.line) });

export const sheetClose = style({ display: 'grid', placeItems: 'center', width: space.hit, height: space.hit, color: color.fg2 });

export const sheetTitle = style({ flex: 1, minWidth: 0 });

export const sheetName = style({ display: 'block', fontFamily: font.serif, fontWeight: 600, fontSize: size.emphasis, lineHeight: 1.3 });

export const sheetBirth = style({ display: 'block', fontSize: size.label, color: color.fg3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' });

export const sheetBody = style({
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  padding: `8px ${space.pad} max(10px, env(safe-area-inset-bottom))`,
});

/* 存储不可用等整栏的说明 */

export const notice = style({ padding: '12px 14px', fontSize: size.small, lineHeight: 1.7, color: color.fg2, boxShadow: `inset 2px 0 0 ${color.accent}, ${ring(color.line2)}` });

export const noticeTitle = style({ display: 'block', fontWeight: 500, color: color.fg });
