import { style } from '@vanilla-extract/css';
import * as picker from '../birth/picker.css';
import { color, size, space, stroke } from '../styles/tokens.css';

/* 排盘页提示词区的释义标记（设计规范第 18.11 节）。 */

/** 标记与读库失败的说明所在的格子（提示词区 L 档的网格里占 know 一格）。 */
export const area = style({ gridArea: 'know' });

export const mark = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minHeight: space.hit,
  borderBottom: `${stroke.hair} solid ${color.line}`,
  fontSize: size.aux,
  color: color.fg3,
});

export const name = style({ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: size.small, color: color.fg });

/** 「更换 ⌄」：文字按钮，不画选择器的外框。 */
export const change = style({
  selectors: {
    [`${picker.trigger}&`]: {
      width: 'auto',
      flex: 'none',
      marginLeft: 'auto',
      height: space.hit,
      padding: '0 0 0 10px',
      gap: 4,
      fontSize: size.aux,
      color: color.fg2,
      boxShadow: 'none',
    },
    [`${picker.trigger}&[data-hovered], ${picker.trigger}&[aria-expanded="true"]`]: { color: color.fg, boxShadow: 'none' },
  },
});

export const failed = style({ padding: '6px 0', fontSize: size.aux, color: color.accent });

export const kind = style({ fontSize: size.label, color: color.fg3 });

export const manage = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  minHeight: space.hit,
  margin: '4px 6px 0',
  padding: '0 10px',
  fontSize: size.small,
  color: color.fg2,
  boxShadow: `inset 0 ${stroke.hair} 0 ${color.line}`,
  selectors: { '&:hover': { color: color.fg }, '&[data-focus-visible]': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: -1 } },
});
