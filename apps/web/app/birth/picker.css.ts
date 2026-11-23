import { createVar, style } from '@vanilla-extract/css';
import { color, font, motion, size, space, stroke } from '../styles/tokens.css';

const ring = (c: string) => `inset 0 0 0 ${stroke.hair} ${c}`;

/* ── 触发钮 ── */

export const trigger = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
  width: '100%',
  minWidth: 0,
  height: space.hit,
  padding: '0 10px',
  fontSize: size.body,
  textAlign: 'left',
  boxShadow: ring(color.line2),
  transition: `box-shadow ${motion.fast}`,
  selectors: {
    '&[data-hovered]': { boxShadow: ring(color.line3) },
    '&[aria-expanded="true"]': { boxShadow: ring(color.fg) },
    '&[aria-invalid="true"]': { boxShadow: ring(color.accent) },
    '&[data-disabled]': { color: color.fg3, boxShadow: ring(color.line), cursor: 'not-allowed' },
    '&[data-focus-visible]': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: 2 },
  },
});

export const triggerValue = style({ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });

export const placeholder = style([triggerValue, { color: color.fg3 }]);

export const caret = style({
  flex: 'none',
  color: color.fg2,
  transition: `transform ${motion.base}`,
  selectors: {
    [`${trigger}[aria-expanded="true"] &`]: { transform: 'rotate(180deg)' },
    [`${trigger}[data-disabled] &`]: { color: color.line3 },
  },
});

/** 触发钮里的主值（时辰名等）用衬线。 */
export const valueSerif = style({ fontFamily: font.serif, fontWeight: 500 });

/** 触发钮里的附注（钟点范围、干支）。 */
export const valueNote = style({ marginLeft: 6, fontFamily: font.num, fontSize: size.aux, color: color.fg2 });

/* ── 弹层：桌面贴在触发钮下方，手机是底部面板 ── */

/** 弹层的最小宽度，各选择器按内容给出；实际宽度不小于触发钮（React Aria 写入 `--trigger-width`）。 */
export const popoverWidth = createVar();

export const popover = style({
  vars: { [popoverWidth]: '264px' },
  display: 'flex',
  flexDirection: 'column',
  width: `max(var(--trigger-width), ${popoverWidth})`,
  maxWidth: 'calc(100vw - 16px)',
  background: color.bg,
  boxShadow: `0 0 0 ${stroke.hair} ${color.line3}`,
  outline: 'none',
});

export const overlay = style({
  position: 'fixed',
  inset: 0,
  zIndex: 69,
  background: color.scrim,
});

export const sheet = style({
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  flexDirection: 'column',
  maxHeight: '78vh',
  background: color.bg,
  boxShadow: `0 calc(-1 * ${stroke.hair}) 0 ${color.line3}`,
  paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
  outline: 'none',
});

/** 对话框与其内层占满弹层，可被压缩到弹层的最大高度以内。 */
export const dialog = style({ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, outline: 'none' });

export const frame = style({ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 });

/** 标题行之下的内容区：超出弹层高度时在这里滚动。 */
export const body = style({ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', paddingBottom: 6 });

export const head = style({
  flex: 'none',
  display: 'flex',
  alignItems: 'center',
  height: space.hit,
  borderBottom: `${stroke.hair} solid ${color.line}`,
});

export const headTitle = style({
  flex: 1,
  display: 'flex',
  justifyContent: 'center',
  fontFamily: font.serif,
  fontWeight: 600,
  fontSize: size.small,
  textAlign: 'center',
  whiteSpace: 'nowrap',
});

export const headButton = style({
  display: 'grid',
  placeItems: 'center',
  flex: 'none',
  width: space.hit,
  height: space.hit,
  color: color.fg2,
  selectors: {
    '&[data-hovered]': { color: color.fg },
    '&[data-disabled]': { color: color.line2, cursor: 'not-allowed' },
    '&[data-focus-visible]': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: -1 },
  },
});

/** 标题行中间可点的标题（年份弹层的「1980 年代 ⌄」）。 */
export const headSwitch = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: space.hit,
  padding: '0 10px',
  fontFamily: font.serif,
  fontWeight: 600,
  fontSize: size.small,
  color: color.fg,
  selectors: {
    '&[data-focus-visible]': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: -1 },
  },
});

export const headSwitchCaret = style({ color: color.fg2 });

export const note = style({ padding: '4px 10px 2px', fontSize: size.label, color: color.fg3 });

export const noteTyped = style({ fontFamily: font.num, fontWeight: 500, color: color.fg, letterSpacing: '0.05em' });

export const section = style({ padding: '10px 10px 0', fontSize: size.label, color: color.fg3 });

export const weekdays = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  padding: '8px 6px 0',
  fontSize: size.label,
  color: color.fg3,
  textAlign: 'center',
});

/* ── 选项网格 ── */

export const columns = createVar();

export const options = style({
  display: 'grid',
  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
  gap: 2,
  padding: 6,
  outline: 'none',
});

export const option = style({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 1,
  minHeight: space.hit,
  padding: '2px 4px',
  fontSize: size.small,
  lineHeight: 1.3,
  color: color.fg,
  cursor: 'pointer',
  outline: 'none',
  transition: `background ${motion.fast}`,
  selectors: {
    '&[data-hovered]': { background: color.bg2 },
    '&[data-focus-visible]': { boxShadow: ring(color.fg) },
    '&[data-selected]': { background: color.btn, color: color.btnFg },
    '&[data-disabled]': {
      color: color.fg3,
      cursor: 'not-allowed',
      background: 'none',
      textDecoration: 'line-through',
      textDecorationColor: color.line3,
    },
  },
});

/**
 * 列表式选项（时辰）：一行里左边名字、右边钟点。名字与钟点各自不折行；一行放不下时钟点整体换到第二行，
 * 不挤压名字。
 */
export const optionRow = style({
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  alignContent: 'center',
  columnGap: 12,
  padding: '4px 10px',
});

export const optionMain = style({
  fontFamily: font.serif,
  fontWeight: 500,
  fontSize: size.small,
  whiteSpace: 'nowrap',
  selectors: { [`${optionRow} &`]: { flex: 'none' } },
});

/** 选项里的数字（年份、日）用 Geist。 */
export const optionNumber = style({ fontFamily: font.num, fontWeight: 400, fontSize: size.small });

export const optionNote = style({
  fontFamily: font.num,
  fontSize: size.label,
  color: color.fg3,
  whiteSpace: 'nowrap',
  selectors: {
    [`${option}[data-selected] &`]: { color: color.btnFg },
    [`${optionRow} &`]: { marginLeft: 'auto' },
  },
});

/** 今天所在的年份等：右上一个强调色小圆点。 */
export const optionNow = style({
  selectors: {
    '&::after': {
      content: '""',
      position: 'absolute',
      right: 5,
      top: 5,
      width: 5,
      height: 5,
      borderRadius: '50%',
      background: color.accent,
    },
  },
});

/** 居中排列的触发钮：值与附注之间留空，箭头仍在右端。 */
export const triggerCentered = style({ justifyContent: 'center', gap: 8 });
