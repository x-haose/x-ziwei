import { globalStyle, style } from '@vanilla-extract/css';
import { media } from '../styles/media';
import { color, font, motion, size, space, stroke } from '../styles/tokens.css';

/* 知识包页（设计规范第 18 节）。 */

const ring = (c: string, w: string = stroke.hair) => `inset 0 0 0 ${w} ${c}`;
const hair = (c: string) => `${stroke.hair} solid ${c}`;

export const page = style({
  maxWidth: 1240,
  margin: '0 auto',
  padding: `40px ${space.pad} 80px`,
  '@media': { [media.s]: { paddingTop: 24 } },
});

export const head = style({
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: 32,
  paddingBottom: 28,
  borderBottom: hair(color.line2),
  '@media': { [media.s]: { flexDirection: 'column', alignItems: 'stretch', gap: 18 } },
});

export const title = style({
  fontFamily: font.serif,
  fontWeight: 500,
  fontSize: size.docTitle,
  lineHeight: 1.25,
  '@media': { [media.s]: { fontSize: size.docTitleNarrow } },
});

export const lede = style({ marginTop: 12, maxWidth: '36em', fontSize: size.prose, lineHeight: 1.75, color: color.fg2 });

export const headActions = style({ display: 'flex', gap: 10, flex: 'none' });

export const headAction = style({ '@media': { [media.s]: { flex: 1 } } });

/** 存储不可用、读库失败时页头下的提示：2px 赭红左线加 1px 框。 */
export const notice = style({
  marginTop: 20,
  padding: '12px 16px',
  fontSize: size.body,
  lineHeight: 1.7,
  boxShadow: `inset 2px 0 0 ${color.accent}, ${ring(color.line2)}`,
});

export const noticeTitle = style({ display: 'block', marginBottom: 2, fontFamily: font.serif, fontWeight: 600, color: color.accent });

export const sectionHead = style({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 16,
  paddingBottom: 10,
  borderBottom: hair(color.line2),
});

export const sectionTitle = style({ fontFamily: font.serif, fontWeight: 600, fontSize: size.subtitle });

export const sectionAux = style({ fontSize: size.label, color: color.fg3 });

/* ── 当前生效 ── */

export const use = style({ marginTop: 36 });

export const useHead = style([
  sectionHead,
  { alignItems: 'center', '@media': { [media.s]: { flexDirection: 'column', alignItems: 'stretch', gap: 10 } } },
]);

export const useMode = style({ width: 300, '@media': { [media.s]: { width: '100%' } } });

export const row = style({
  display: 'flex',
  alignItems: 'stretch',
  marginTop: 18,
  '@media': {
    [media.mDown]: { flexWrap: 'wrap', rowGap: 8 },
    [media.s]: { flexDirection: 'column' },
  },
});

/** 整包切换里的单选组：与叠加的卡片同一行排布。 */
export const wholeRow = style({
  display: 'flex',
  alignItems: 'stretch',
  flex: '0 1 auto',
  minWidth: 0,
  '@media': { [media.mDown]: { flexWrap: 'wrap', rowGap: 8 }, [media.s]: { flexDirection: 'column' } },
});

export const sheet = style({
  position: 'relative',
  flex: '0 1 250px',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '14px 16px 12px',
  boxShadow: ring(color.line2),
  background: color.bg,
  textAlign: 'left',
  '@media': { [media.s]: { flex: 'none', padding: '12px 14px 10px' } },
});

export const sheetBase = style({ background: color.bg2 });

export const sheetResult = style({
  flex: '1 1 360px',
  boxShadow: ring(color.fg),
  '@media': { [media.mDown]: { flexBasis: '100%' } },
});

/** 整包切换里可点的包：`role="radio"`，右上圆点，选中 1px 主色框加 `--bg-3` 底。 */
export const sheetPick = style({
  cursor: 'pointer',
  selectors: {
    '&[data-hovered]': { background: color.bg2 },
    '&[data-selected]': { boxShadow: ring(color.fg), background: color.bg3 },
    '&[data-focus-visible]': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: 2 },
  },
});

export const dot = style({
  position: 'absolute',
  right: 14,
  top: 16,
  width: 12,
  height: 12,
  borderRadius: '50%',
  boxShadow: ring(color.fg3),
  selectors: { [`${sheetPick}[data-selected] &`]: { boxShadow: ring(color.fg, '3.5px') } },
});

export const sheetKind = style({ fontSize: size.label, color: color.fg3 });

export const sheetName = style({ fontFamily: font.serif, fontWeight: 600, fontSize: 18, lineHeight: 1.35, overflowWrap: 'anywhere' });

/** 标识与版本不折行；卡片被压窄时以省略号截断。 */
export const sheetId = style({ fontFamily: font.num, fontSize: size.aux, color: color.fg3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' });

export const sheetVersion = style({ marginLeft: 10 });

export const sheetNote = style({ fontSize: size.small, lineHeight: 1.6, color: color.fg2 });

export const sheetActions = style({ display: 'flex', margin: '6px -8px -6px auto', '@media': { [media.s]: { marginTop: 0 } } });

export const sheetAction = style({
  display: 'grid',
  placeItems: 'center',
  width: 40,
  height: 40,
  color: color.fg2,
  selectors: {
    '&:hover': { color: color.fg, background: color.bg2 },
    '&:disabled': { color: color.line3, background: 'none', cursor: 'not-allowed' },
    '&:focus-visible': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: -1 },
  },
});

/** 横排时左右箭头、手机纵排时上下箭头。 */
export const arrowH = style({ '@media': { [media.s]: { display: 'none' } } });
export const arrowV = style({ display: 'none', '@media': { [media.s]: { display: 'block' } } });

export const op = style({
  flex: 'none',
  width: 36,
  display: 'grid',
  placeItems: 'center',
  fontFamily: font.num,
  fontWeight: 300,
  fontSize: 22,
  color: color.fg3,
  '@media': { [media.s]: { width: '100%', height: 28 } },
});

export const opEq = style({ '@media': { [media.mDown]: { width: '100%', height: 28 } } });

export const addable = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '6px 10px',
  marginTop: 12,
  fontSize: size.small,
  color: color.fg3,
});

export const addButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  minHeight: 36,
  padding: '0 12px',
  fontSize: size.small,
  color: color.fg,
  boxShadow: ring(color.line2),
  selectors: {
    '&:hover': { boxShadow: ring(color.fg) },
    '&::before': { content: '"+"', fontFamily: font.num, color: color.fg2 },
    '&:focus-visible': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: 2 },
  },
});

/* ── 条目数 ── */

export const counts = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
  gap: '2px 10px',
  marginTop: 6,
  '@media': { [media.s]: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', rowGap: 8 } },
});

export const countItem = style({ display: 'flex', flexDirection: 'column' });

export const countLabel = style({ fontSize: size.label, color: color.fg3 });

export const countValue = style({ margin: 0, fontFamily: font.num, fontSize: 16, lineHeight: 1.3, color: color.fg });

export const countZero = style({ color: color.fg3 });

export const countMark = style({ fontStyle: 'normal', fontSize: size.label, color: color.fg2, marginLeft: 4 });

/** 条目数下方的比例条：底 `--line`，填充为该段条目数 ÷ 默认包同段条目数。 */
export const cover = style({ position: 'relative', display: 'block', height: 3, marginTop: 5, background: color.line });

export const coverFill = style({
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  background: color.fg2,
  selectors: { [`${sheetResult} &`]: { background: color.fg } },
});

/* ── 本机的包与导入 ── */

export const grid = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 360px',
  gap: 48,
  marginTop: 48,
  alignItems: 'start',
  '@media': { [media.mDown]: { gridTemplateColumns: 'minmax(0, 1fr)', gap: 40 } },
});

export const packs = style({ listStyle: 'none', margin: 0, padding: 0 });

export const pack = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  columnGap: 20,
  padding: '18px 0 16px',
  borderBottom: hair(color.line),
  '@media': { [media.s]: { gridTemplateColumns: 'minmax(0, 1fr)' } },
});

export const packTitle = style({ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '4px 10px' });

export const packName = style({ fontFamily: font.serif, fontWeight: 600, fontSize: size.subtitle });

export const packId = style({ fontFamily: font.num, fontSize: size.aux, color: color.fg3 });

export const tags = style({ display: 'inline-flex', gap: 6, flexWrap: 'wrap' });

export const tag = style({
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: size.label,
  lineHeight: 1,
  padding: '3px 5px',
  color: color.fg2,
  boxShadow: ring(color.line2),
});

export const tagOn = style({ color: color.fg, boxShadow: ring(color.fg) });

export const meta = style({ display: 'flex', flexWrap: 'wrap', gap: '4px 22px', marginTop: 8, fontSize: size.aux, color: color.fg2 });

export const metaLabel = style({ marginRight: 6, fontSize: size.label, color: color.fg3 });

export const packCounts = style({ maxWidth: 560, marginTop: 10 });

export const packSource = style({ marginTop: 8, maxWidth: '44em', fontSize: size.small, lineHeight: 1.6, color: color.fg3 });

export const packActions = style({
  display: 'flex',
  alignItems: 'flex-start',
  marginRight: -10,
  '@media': { [media.s]: { margin: '8px 0 0 -10px', flexWrap: 'wrap' } },
});

export const packAction = style({
  display: 'inline-flex',
  alignItems: 'center',
  height: space.hit,
  padding: '0 10px',
  fontSize: size.small,
  color: color.fg2,
  selectors: {
    '&:hover': { color: color.fg, boxShadow: `inset 0 -1px 0 ${color.fg}` },
    '&:focus-visible': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: -1 },
  },
});

export const packLocked = style({ display: 'inline-flex', alignItems: 'center', height: space.hit, padding: '0 10px', fontSize: size.aux, color: color.fg3 });

export const packsNone = style({ padding: '22px 0', fontSize: size.body, lineHeight: 1.7, color: color.fg2, borderBottom: hair(color.line) });

export const importBox = style({ position: 'sticky', top: 24, '@media': { [media.mDown]: { position: 'static', order: -1 } } });

export const importMode = style({ marginTop: 12 });

/** 导入方式的页签：外观同分段控件，文字居中。 */
export const modeTab = style({ display: 'grid', placeItems: 'center', cursor: 'pointer', outline: 'none' });

export const drop = style({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  minHeight: 196,
  marginTop: 12,
  padding: 20,
  textAlign: 'center',
  boxShadow: ring(color.line3),
  transition: `background ${motion.fast}, box-shadow ${motion.fast}`,
  outline: 'none',
  selectors: {
    '&[data-drop-target]': { background: color.bg2, boxShadow: ring(color.fg, '2px') },
    '&[data-focus-visible]': { boxShadow: ring(color.fg, '2px') },
  },
});

export const dropOff = style({ boxShadow: ring(color.line), cursor: 'not-allowed' });

export const dropIcon = style({ color: color.fg3 });

export const dropText = style({ fontSize: size.body, color: color.fg, selectors: { [`${dropOff} &`]: { color: color.fg3 } } });

export const dropSmall = style({ fontSize: size.label, color: color.fg3 });

export const dropBar = style({ width: 180 });

export const pasteArea = style({
  display: 'block',
  width: '100%',
  height: 220,
  marginTop: 12,
  resize: 'vertical',
  background: color.well,
  border: 0,
  borderRadius: 0,
  boxShadow: ring(color.line2),
  padding: 12,
  fontFamily: font.mono,
  fontSize: size.code,
  lineHeight: 1.6,
  color: color.fg,
  selectors: {
    '&:focus': { outline: 'none', boxShadow: ring(color.fg) },
    '&::placeholder': { color: color.fg3, fontFamily: font.sans },
    '&:disabled': { color: color.fg3, cursor: 'not-allowed' },
  },
});

export const pasteButton = style({ width: '100%', marginTop: 10 });

export const local = style({
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: 10,
  marginTop: 14,
  paddingTop: 12,
  borderTop: hair(color.line),
  fontSize: size.small,
  lineHeight: 1.65,
  color: color.fg2,
});

export const localIcon = style({ marginTop: 3, color: color.fg2 });

export const localStrong = style({ fontWeight: 500, color: color.fg });

export const result = style({ marginTop: 16 });

export const resultTitle = style({ fontFamily: font.serif, fontWeight: 600, fontSize: 16, marginBottom: 6 });

export const resultFile = style({ fontSize: size.small, color: color.fg2, overflowWrap: 'anywhere' });

export const steps = style({ listStyle: 'none', margin: '10px 0 0', padding: 0, fontSize: size.small });

export const step = style({
  display: 'grid',
  gridTemplateColumns: '20px 1fr auto',
  alignItems: 'center',
  minHeight: 30,
  color: color.fg3,
  selectors: {
    '&::before': { content: '""', width: 7, height: 7, borderRadius: '50%', boxShadow: 'inset 0 0 0 1px currentColor' },
    '&[data-state="done"]': { color: color.fg2 },
    '&[data-state="done"]::before': { background: 'currentColor' },
    '&[data-state="now"]': { color: color.fg },
    '&[data-state="now"]::before': { background: color.accent, boxShadow: 'none' },
  },
});

export const stepNote = style({ fontFamily: font.num, fontSize: size.label });

export const problemLabel = style({ marginTop: 12, fontSize: size.aux, color: color.accent });

export const warnLabel = style([problemLabel, { color: color.fg2 }]);

/** 导入成功时的「N 条提醒」：点开看各条。 */
export const warnToggle = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  minHeight: space.hit,
  marginTop: 4,
  fontSize: size.aux,
  color: color.fg2,
  selectors: { '&:hover': { color: color.fg }, '&:focus-visible': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: 2 } },
});

export const warnCaret = style({
  display: 'inline-flex',
  transition: `transform ${motion.base}`,
  selectors: { [`${warnToggle}[aria-expanded="true"] &`]: { transform: 'rotate(180deg)' } },
});

export const problems = style({ listStyle: 'none', margin: '8px 0 0', padding: 0 });

export const problem = style({
  padding: '9px 0 9px 12px',
  marginBottom: 6,
  background: color.bg2,
  boxShadow: `inset 2px 0 0 ${color.accent}`,
});

export const problemWarn = style({ boxShadow: `inset 2px 0 0 ${color.line3}` });

export const problemWhere = style({ display: 'block', fontFamily: font.mono, fontSize: size.code, lineHeight: 1.5, color: color.fg, overflowWrap: 'anywhere' });

export const problemText = style({ marginTop: 2, fontSize: size.small, lineHeight: 1.6, color: color.fg2, overflowWrap: 'anywhere' });

export const resultActions = style({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 14 });

export const resultButton = style({ height: space.hit, padding: '0 16px', fontSize: size.small });

export const okBox = style({ padding: '14px 16px', boxShadow: ring(color.fg) });

export const okList = style({ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 14px', marginTop: 8, fontSize: size.small });

export const okTerm = style({ color: color.fg3, fontSize: size.aux });

export const okValue = style({ color: color.fg, overflowWrap: 'anywhere', margin: 0 });

/* ── 查看抽屉 ── */

export const scrim = style({ position: 'fixed', inset: 0, zIndex: 80, background: color.scrim });

export const drawer = style({
  position: 'fixed',
  zIndex: 81,
  top: 0,
  right: 0,
  bottom: 0,
  width: 'min(600px, 100vw)',
  display: 'flex',
  flexDirection: 'column',
  background: color.bg,
  boxShadow: `calc(-1 * ${stroke.hair}) 0 0 ${color.line3}`,
  outline: 'none',
  '@media': { [media.s]: { boxShadow: 'none' } },
});

export const drawerDialog = style({ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, outline: 'none' });

const drawerPad = { paddingLeft: 24, paddingRight: 24, '@media': { [media.s]: { paddingLeft: 16, paddingRight: 16 } } } as const;

export const drawerHead = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  paddingTop: 20,
  paddingBottom: 14,
  borderBottom: hair(color.line),
  ...drawerPad,
});

export const drawerHeadText = style({ flex: 1, minWidth: 0 });

export const drawerTabs = style({ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 });

export const drawerTitle = style({ fontFamily: font.serif, fontWeight: 600, fontSize: 22, lineHeight: 1.35 });

export const drawerMeta = style({ display: 'flex', flexWrap: 'wrap', gap: '0 14px', marginTop: 2, fontSize: size.aux, color: color.fg2 });

export const nowrap = style({ whiteSpace: 'nowrap' });

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

export const drawerTools = style({ paddingTop: 12, paddingBottom: 10, borderBottom: hair(color.line), ...drawerPad });

export const tabs = style({ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', boxShadow: ring(color.line2) });

export const tab = style({
  flex: '1 0 auto',
  display: 'grid',
  placeItems: 'center',
  minHeight: space.hit,
  padding: '0 12px',
  fontSize: size.small,
  color: color.fg2,
  cursor: 'pointer',
  outline: 'none',
  selectors: {
    '& + &': { boxShadow: `inset ${stroke.hair} 0 0 ${color.line2}` },
    '&[data-selected]': { background: color.btn, color: color.btnFg },
    '&[data-disabled]': { color: color.fg3, cursor: 'not-allowed' },
    '&[data-focus-visible]': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: -3 },
  },
});

export const tabCount = style({
  fontFamily: font.num,
  fontSize: size.label,
  color: color.fg3,
  marginLeft: 4,
  selectors: { [`${tab}[data-selected] &`]: { color: color.btnFg } },
});

export const search = style({ position: 'relative', marginTop: 10 });

export const searchIcon = style({ position: 'absolute', left: 12, top: 13, color: color.fg3, pointerEvents: 'none' });

export const searchInput = style({
  height: space.hit,
  width: '100%',
  padding: '0 12px 0 40px',
  background: 'transparent',
  border: 0,
  borderRadius: 0,
  boxShadow: ring(color.line2),
  fontSize: size.body,
  selectors: {
    '&:focus': { outline: 'none', boxShadow: ring(color.fg) },
    '&::placeholder': { color: color.fg3 },
    '&::-webkit-search-cancel-button': { display: 'none' },
  },
});

export const drawerBody = style({
  flex: 1,
  overflow: 'auto',
  paddingTop: 4,
  paddingBottom: 32,
  scrollbarWidth: 'thin',
  ...drawerPad,
});

export const hint = style({ padding: '10px 0', fontSize: size.small, color: color.fg3 });

export const entry = style({ borderBottom: hair(color.line) });

export const entryButton = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: '2px 12px',
  width: '100%',
  padding: '12px 0',
  textAlign: 'left',
  selectors: { '&:focus-visible': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: 2 } },
});

export const entryName = style({
  fontFamily: font.serif,
  fontWeight: 600,
  fontSize: 16,
  selectors: { [`${entryButton}:hover &`]: { color: color.accent } },
});

export const entryTag = style([tag, { marginLeft: 8, verticalAlign: 2, fontFamily: font.sans, fontWeight: 400 }]);

export const entryKey = style({ alignSelf: 'center', justifySelf: 'end', fontFamily: font.num, fontSize: size.label, color: color.fg3 });

export const entryBrief = style({ gridColumn: '1 / -1', fontSize: size.small, lineHeight: 1.65, color: color.fg2 });

export const entryFull = style({ paddingBottom: 14 });

export const more = style({ width: '100%', marginTop: 14 });

/* ── 删除确认 ── */

export const dialog = style({
  position: 'fixed',
  zIndex: 82,
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'min(440px, calc(100vw - 32px))',
  padding: 24,
  background: color.bg,
  boxShadow: `0 0 0 ${stroke.hair} ${color.line3}`,
  outline: 'none',
});

export const dialogTitle = style({ fontFamily: font.serif, fontWeight: 600, fontSize: 20, lineHeight: 1.4 });

export const dialogBody = style({ marginTop: 10, fontSize: size.body, lineHeight: 1.75, color: color.fg2 });

export const dialogStrong = style({ fontWeight: 500, color: color.fg });

export const dialogActions = style({ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 });

/** 删除确认里的「删除」：赭红实心，全站唯一用于按钮的赭红（不可恢复的确认）。 */
export const danger = style({
  background: color.accent,
  color: color.accentFg,
  selectors: { '&:hover, &[data-hovered]': { background: `color-mix(in oklch, ${color.accent} 88%, ${color.fg})` } },
});

globalStyle(`${entryFull} > *:first-child`, { marginTop: 0 });
