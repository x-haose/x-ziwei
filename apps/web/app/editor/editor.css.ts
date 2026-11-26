import { globalStyle, style } from '@vanilla-extract/css';
import { media } from '../styles/media';
import { color, font, motion, size, space, stroke } from '../styles/tokens.css';

/** 知识包编辑器（设计规范第 20 节）。 */

const ring = (c: string) => `inset 0 0 0 ${stroke.hair} ${c}`;
const hair = (c: string) => `${stroke.hair} solid ${c}`;
const hit = (y: number, x = 0) => ({ content: '""', position: 'absolute' as const, inset: `-${y}px -${x}px` });

/** ≥1360 三栏，1024–1359 两栏（预览与问题在抽屉里），更窄时单栏。 */
export const xl = '(min-width: 1360px)';

export const page = style({ maxWidth: 1680, margin: '0 auto', padding: `0 ${space.pad} 48px` });

export const writePage = style({ maxWidth: 1280, margin: '0 auto', padding: `24px ${space.pad} 48px` });

/* ── 第一屏 ── */

export const writeTitle = style({ fontFamily: font.serif, fontWeight: 600, fontSize: 34, lineHeight: 1.25, '@media': { [media.s]: { fontSize: 28 } } });

export const writeInto = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 12px', marginTop: 16 });

export const writeIntoLabel = style({ fontSize: size.label, color: color.fg3 });

export const writeIntoPicker = style({ minWidth: 280, maxWidth: '100%' });

export const hint = style({ fontSize: size.small, color: color.fg2, marginTop: 8, lineHeight: 1.6 });

export const starts = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 16,
  marginTop: 24,
  '@media': { [media.lDown]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }, [media.mDown]: { gridTemplateColumns: 'minmax(0, 1fr)' } },
});

export const startFirst = style({ '@media': { [media.lDown]: { gridRow: 'span 2' }, [media.mDown]: { gridRow: 'auto' } } });

export const start = style({ padding: '16px 16px 18px', boxShadow: ring(color.line2), minWidth: 0 });

export const startTitle = style({ fontFamily: font.serif, fontWeight: 600, fontSize: 19, marginBottom: 10 });

export const count = style({ fontSize: size.small, lineHeight: 1.6, color: color.fg2, marginTop: 10 });

export const majors = style({ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0 12px', marginTop: 8 });

export const majorsTitle = style({ fontSize: size.label, color: color.fg3, marginTop: 14 });

export const row = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minHeight: space.hit,
  padding: '0 4px',
  width: '100%',
  textAlign: 'left',
  borderBottom: hair(color.line),
  selectors: { '&:hover': { background: color.bg2 }, '&[aria-current="true"]': { background: color.bg3, boxShadow: `inset 2px 0 0 ${color.fg}` } },
});

export const rowName = style({ fontFamily: font.serif, fontWeight: 600, fontSize: 15 });

export const rowWhere = style({ fontSize: size.label, color: color.fg3, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });

export const tag = style({ flex: 'none', fontSize: size.label, padding: '0 5px', lineHeight: '20px', color: color.fg3 });

export const tagOn = style({ color: color.fg, boxShadow: ring(color.fg) });

export const dot = style({ flex: 'none', width: 7, height: 7, borderRadius: '50%' });

export const dotError = style({ background: color.accent });

export const dotWarning = style({ boxShadow: ring(color.fg2) });

export const wide = style({ width: '100%', marginTop: 12 });

export const topicGrid = style({ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4, marginTop: 10 });

export const topicCell = style({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  minHeight: 52,
  padding: '4px 8px',
  boxShadow: ring(color.line2),
  textAlign: 'left',
  selectors: { '&:hover': { boxShadow: ring(color.line3) } },
});

export const topicName = style({ fontFamily: font.serif, fontSize: 15 });

export const topicSub = style({ fontSize: size.label, color: color.fg3 });

export const blankRow = style([row, { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 0, padding: '6px 4px', textDecoration: 'none', color: 'inherit' }]);

export const blankName = style({ fontSize: 15, color: color.fg });

export const blankNote = style({ fontSize: size.label, color: color.fg3 });

export const resumeTitle = style({ fontSize: size.label, color: color.fg3, marginTop: 16 });

/* ── 标题栏 ── */

export const bar = style({
  position: 'sticky',
  top: 0,
  zIndex: 20,
  background: color.bg,
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '8px 12px',
  padding: '14px 0 10px',
  borderBottom: hair(color.line3),
  '@media': { [media.s]: { position: 'static' } },
});

export const back = style({ position: 'relative', fontSize: size.small, color: color.fg2, textDecoration: 'none', selectors: { '&::after': hit(12, 4), '&:hover': { color: color.fg } } });

export const barName = style({ fontFamily: font.serif, fontWeight: 600, fontSize: 22 });

export const barId = style({ fontFamily: font.num, fontSize: size.label, color: color.fg3 });

export const barBase = style({ fontSize: size.label, color: color.fg2 });

export const barSpace = style({ flex: 1 });

export const barStatus = style({ fontSize: size.label, color: color.fg2 });

export const barStatusBad = style({ color: color.accent });

export const barButton = style({ height: space.hit, padding: '0 14px', fontSize: size.small });

export const issuesButton = style([barButton, { display: 'inline-flex', gap: 10 }]);

export const issuesError = style({ color: color.accent });

export const barNote = style({ width: '100%', textAlign: 'right', fontSize: size.small, color: color.fg2, '@media': { [media.mDown]: { textAlign: 'left' } } });

export const strip = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 16px', margin: `0 calc(-1 * ${space.pad})`, padding: `12px ${space.pad}`, background: color.bg2, boxShadow: `inset 0 2px 0 ${color.line3}`, fontSize: size.small, lineHeight: 1.6 });

export const stripText = style({ flex: '1 1 420px' });

export const textButton = style({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  minHeight: 32,
  fontSize: size.label,
  color: color.fg2,
  selectors: { '&::after': hit(6), '&:hover': { color: color.fg }, '&:disabled': { color: color.fg3, cursor: 'not-allowed' } },
});

/* ── 三栏 ── */

export const body = style({
  display: 'grid',
  gridTemplateColumns: '256px minmax(0, 1fr) 380px',
  gap: 28,
  marginTop: 16,
  alignItems: 'start',
  '@media': {
    [media.lDown]: { gridTemplateColumns: '240px minmax(0, 1fr)' },
    [media.mDown]: { gridTemplateColumns: 'minmax(0, 1fr)' },
  },
});

export const side = style({
  position: 'sticky',
  top: 96,
  maxHeight: 'calc(100vh - 112px)',
  overflowY: 'auto',
  scrollbarWidth: 'thin',
  minWidth: 0,
  '@media': { [media.mDown]: { position: 'static', maxHeight: 'none', overflow: 'visible' } },
});

export const right = style([side, { '@media': { [media.lDown]: { display: 'none' } } }]);

export const hiddenNarrow = style({ '@media': { [media.mDown]: { display: 'none' } } });

export const segmented = style({ marginBottom: 10 });

export const info = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  width: '100%',
  padding: '8px 10px',
  marginBottom: 10,
  textAlign: 'left',
  boxShadow: ring(color.line2),
  selectors: { '&[aria-current="true"]': { boxShadow: ring(color.fg) } },
});

export const infoName = style({ fontSize: 15, fontWeight: 500 });

export const infoSub = style({ fontFamily: font.num, fontSize: size.label, color: color.fg3 });

export const progress = style({ height: 3, background: color.line, marginTop: 6, position: 'relative' });

export const progressFill = style({ position: 'absolute', left: 0, top: 0, bottom: 0, background: color.fg });

export const groupHead = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  minHeight: 36,
  marginTop: 8,
  fontSize: size.label,
  color: color.fg3,
  selectors: { '&:hover': { color: color.fg } },
});

export const caret = style({ display: 'inline-flex', transition: `transform ${motion.base}`, selectors: { '[aria-expanded="true"] > * > &, [aria-expanded="true"] > &': { transform: 'rotate(180deg)' } } });

export const tabs = style({ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 4, marginBottom: 10 });

export const tab = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  padding: '6px 8px',
  boxShadow: ring(color.line2),
  textAlign: 'left',
  selectors: { '&[aria-selected="true"]': { background: color.btn, color: color.btnFg, boxShadow: 'none' } },
});

export const tabSub = style({ fontSize: size.label, opacity: 0.8 });

export const search = style({ width: '100%', height: 40, padding: '0 10px', marginBottom: 8, fontSize: size.small, background: color.well, border: 0, boxShadow: ring(color.line2), color: color.fg });

export const addEntry = style([textButton, { marginTop: 8 }]);

/* ── 条目编辑 ── */

export const entryHead = style({ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: 12, borderBottom: hair(color.line2) });

export const entryTitles = style({ flex: 1, minWidth: 0 });

export const entryName = style({ fontFamily: font.serif, fontWeight: 600, fontSize: 30, lineHeight: 1.25, selectors: { '&:focus': { outline: 'none' } } });

export const entryKey = style({ fontFamily: font.mono, fontSize: 14.5, color: color.fg3, marginLeft: 10 });

export const entrySub = style({ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 4, fontSize: size.small, color: color.fg2 });

export const entryActions = style({ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 });

export const ai = style({ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 10px', fontSize: size.small, boxShadow: ring(color.line3) });

export const soon = style({ fontSize: size.label, padding: '0 4px', color: color.fg3, boxShadow: ring(color.line2) });

export const aiNote = style({ margin: '12px 0 0', padding: '10px 12px', boxShadow: ring(color.line3), fontSize: size.small, lineHeight: 1.7, color: color.fg2 });

export const lead = style({ fontSize: size.small, color: color.fg2, margin: '12px 0 4px' });

export const field = style({ padding: '16px 0', borderBottom: hair(color.line) });

export const fieldHead = style({ display: 'flex', alignItems: 'center', gap: 10, minHeight: 32 });

export const fieldName = style({ fontFamily: font.serif, fontWeight: 600, fontSize: 17 });

export const fieldState = style({ fontSize: size.label, color: color.fg3 });

export const changed = style({ fontSize: size.label, padding: '0 5px', lineHeight: '20px', boxShadow: ring(color.fg) });

export const fieldGrid = style({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12, marginTop: 6, '@media': { [xl]: { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' } } });

export const fieldGridSingle = style({ display: 'block', marginTop: 6 });

export const compare = style({
  fontSize: size.small,
  lineHeight: 1.8,
  color: color.fg2,
  '@media': { [xl]: { paddingRight: 12, borderRight: hair(color.line) } },
});

export const compareLabel = style({ fontSize: size.label, color: color.fg3, marginBottom: 2 });

export const compareToggle = style([textButton, { '@media': { [xl]: { display: 'none' } } }]);

export const compareBody = style({ selectors: { '&[data-closed]': { display: 'none' } }, '@media': { [xl]: { selectors: { '&[data-closed]': { display: 'block' } } } } });

export const inherit = style({ padding: '12px 14px', background: color.bg2, fontSize: size.small, color: color.fg2 });

export const inheritButton = style({ height: 40, padding: '0 14px', marginTop: 10, fontSize: size.small });

export const toolbar = style({ display: 'flex', alignItems: 'center', gap: 2, height: 36, borderBottom: hair(color.line) });

export const tool = style({ minWidth: 32, height: 32, padding: '0 6px', fontSize: size.label, color: color.fg2, selectors: { '&:hover': { color: color.fg }, '&[aria-pressed="true"]': { color: color.fg, boxShadow: ring(color.line3) } } });

export const toolSpace = style({ flex: 1 });

export const textarea = style({
  display: 'block',
  width: '100%',
  minHeight: 140,
  resize: 'vertical',
  padding: '10px 12px',
  font: 'inherit',
  fontSize: 15,
  lineHeight: 1.8,
  color: color.fg,
  background: color.well,
  border: 0,
  boxShadow: ring(color.line2),
  selectors: { '&:focus': { boxShadow: ring(color.fg), outline: 'none' }, '&[aria-invalid="true"]': { boxShadow: ring(color.accent) } },
});

export const textareaShort = style({ minHeight: 76 });

export const input = style({
  width: '100%',
  height: 40,
  padding: '0 10px',
  fontSize: size.small,
  color: color.fg,
  background: color.well,
  border: 0,
  boxShadow: ring(color.line2),
  selectors: { '&:focus': { boxShadow: ring(color.fg), outline: 'none' }, '&[aria-invalid="true"]': { boxShadow: ring(color.accent) } },
});

export const mono = style({ fontFamily: font.mono, fontSize: 14.5 });

export const rendered = style({ padding: '10px 12px', background: color.well, boxShadow: ring(color.line), minHeight: 76 });

export const widthBar = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 10px', marginTop: 6, fontSize: size.label, color: color.fg3, whiteSpace: 'nowrap' });

export const widthTrack = style({ position: 'relative', flex: '0 0 160px', height: 3, background: color.line });

export const widthFill = style({ position: 'absolute', left: 0, top: 0, bottom: 0, background: color.fg3, selectors: { '&[data-over]': { background: color.fg } } });

export const widthTick = style({ position: 'absolute', top: -3, bottom: -3, width: 1, background: color.fg3 });

export const widthOver = style({ color: color.fg });

export const problem = style({ marginTop: 8, padding: '4px 0 4px 10px', fontSize: size.small, lineHeight: 1.6, boxShadow: `inset 2px 0 0 ${color.line3}` });

export const problemError = style({ boxShadow: `inset 2px 0 0 ${color.accent}` });

export const problemLead = style({ fontWeight: 600, marginRight: 4 });

export const attrTable = style({ width: '100%', borderCollapse: 'collapse', fontSize: size.small });

globalStyle(`${attrTable} th`, { textAlign: 'left', fontWeight: 400, fontSize: size.label, color: color.fg3, padding: '4px 8px 4px 0', borderBottom: hair(color.line2) });
globalStyle(`${attrTable} td`, { padding: '4px 8px 4px 0', height: 48, borderBottom: hair(color.line), verticalAlign: 'middle' });

export const attrBase = style({ color: color.fg2, '@media': { [media.s]: { display: 'none' } } });

export const tags = style({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 });

export const chip = style({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 4px 0 8px', height: 28, fontSize: size.small, boxShadow: ring(color.line2) });

export const chipX = style({ position: 'relative', width: 20, height: 20, display: 'grid', placeItems: 'center', color: color.fg3, selectors: { '&::after': hit(8, 6), '&:hover': { color: color.fg } } });

export const block = style({ marginTop: 10, boxShadow: ring(color.line2) });

export const blockHead = style({ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: space.hit, padding: '0 10px', textAlign: 'left' });

export const blockBody = style({ padding: '0 10px 10px' });

export const quote = style({ display: 'grid', gridTemplateColumns: '24px minmax(0, 1fr) auto', alignItems: 'center', gap: 6, marginTop: 6 });

export const quoteNo = style({ fontFamily: font.num, fontSize: size.label, color: color.fg3 });

export const iconButton = style({ minWidth: 36, height: 36, padding: '0 6px', fontSize: size.label, color: color.fg2, selectors: { '&:hover': { color: color.fg }, '&:disabled': { color: color.fg3, cursor: 'not-allowed' } } });

export const empty = style({ padding: '32px 0' });

export const emptyTitle = style({ fontFamily: font.serif, fontWeight: 600, fontSize: 21 });

export const emptyBody = style({ fontSize: size.small, color: color.fg2, lineHeight: 1.7, marginTop: 6 });

/* ── 预览与问题 ── */

export const panelTabs = style({ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginBottom: 10 });

export const previewNote = style({ fontSize: size.label, lineHeight: 1.6, color: color.fg2, margin: '8px 0' });

export const previewBox = style({ padding: '10px 12px', boxShadow: ring(color.line2), fontSize: size.small, lineHeight: 1.75 });

export const previewHead = style({ fontSize: size.label, color: color.fg3, marginBottom: 6 });

export const para = style({ color: color.fg3, padding: '4px 0 4px 10px', selectors: { '&[data-on]': { color: color.fg, boxShadow: `inset 2px 0 0 ${color.fg}` } } });

export const own = style({ fontSize: 11, padding: '0 4px', marginLeft: 6, boxShadow: ring(color.fg2), color: color.fg2 });

export const missing = style({ padding: '6px 0 6px 10px', boxShadow: `inset 2px 0 0 ${color.line2}`, color: color.fg3 });

export const broken = style({ padding: '6px 0 6px 10px', boxShadow: `inset 2px 0 0 ${color.accent}` });

export const miniBoard = style({ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gridTemplateRows: 'repeat(4, 40px)', boxShadow: ring(color.line2), marginTop: 8 });

export const miniCell = style({
  display: 'grid',
  placeItems: 'center',
  fontFamily: font.serif,
  fontSize: size.label,
  boxShadow: `inset 0 0 0 0.5px ${color.line}`,
  color: color.fg3,
  selectors: { '&[data-kind="main"]': { background: color.bg3, boxShadow: ring(color.fg), color: color.fg }, '&[data-kind="around"]': { background: color.bg3, color: color.fg }, '&[data-kind="only"]': { background: color.bg2, color: color.fg } },
});

export const miniCentre = style({ gridArea: '2 / 2 / 4 / 4', display: 'grid', placeItems: 'center', textAlign: 'center', fontSize: size.label, color: color.fg2 });

export const issueGroup = style({ fontSize: size.label, color: color.fg3, margin: '10px 0 4px' });

export const issueItem = style({
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '8px 0 8px 10px',
  fontSize: size.small,
  lineHeight: 1.6,
  boxShadow: `inset 2px 0 0 ${color.line3}`,
  marginTop: 6,
  selectors: { '&:hover': { background: color.bg2 }, '&[data-level="error"]': { boxShadow: `inset 2px 0 0 ${color.accent}` } },
});

export const issuePath = style({ display: 'block', fontFamily: font.mono, fontSize: size.label, color: color.fg3 });

export const drawer = style({
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: 'min(420px, 100vw)',
  overflowY: 'auto',
  padding: 16,
  background: color.bg,
  boxShadow: `-1px 0 0 ${color.line3}`,
  outline: 'none',
  '@media': { [media.s]: { width: '100vw' } },
});

export const drawerHead = style({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 });

/* ── 包信息 ── */

export const infoField = style({ display: 'grid', gap: 4, padding: '12px 0', borderBottom: hair(color.line) });

export const infoLabel = style({ fontSize: size.label, color: color.fg3 });

export const infoNote = style({ fontSize: size.label, color: color.fg3, lineHeight: 1.6 });

export const infoTable = style([attrTable, { marginTop: 8 }]);

/* ── 新建与草稿 ── */

export const radioGroup = style({ display: 'grid', gap: 6, marginTop: 8 });

export const radio = style({ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', boxShadow: ring(color.line2), cursor: 'pointer', selectors: { '&[data-selected]': { background: color.bg3, boxShadow: ring(color.fg) } } });

export const radioMark = style({ flex: 'none', width: 14, height: 14, marginTop: 3, borderRadius: '50%', boxShadow: ring(color.fg2), selectors: { [`${radio}[data-selected] &`]: { boxShadow: `inset 0 0 0 4px ${color.fg}` } } });

export const radioName = style({ fontSize: 15 });

export const radioNote = style({ display: 'block', fontSize: size.label, color: color.fg3 });

export const formField = style({ display: 'grid', gap: 4, marginTop: 12 });

export const formError = style({ fontSize: size.label, color: color.accent });

export const json = style({ whiteSpace: 'pre-wrap', margin: 0, fontFamily: font.mono, fontSize: size.label });

/** AI 起草的占位：每个字段一块虚线框，按钮都不可用。 */
export const aiSlot = style({ display: 'block', marginTop: 10, padding: '8px 10px', border: `${stroke.hair} dashed ${color.line3}` });

export const aiSlotHead = style({ display: 'flex', alignItems: 'center', gap: 4, fontSize: size.label, color: color.fg3 });

export const aiBar = style({ display: 'block', height: 8, marginTop: 6, background: color.bg3 });
