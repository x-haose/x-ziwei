import { style } from '@vanilla-extract/css';
import { color, font, size, stroke } from '../styles/tokens.css';

export const form = style({
  display: 'grid',
  gap: 12,
  padding: '14px 0 16px',
  borderBottom: `${stroke.hair} solid ${color.line}`,
});

export const field = style({ display: 'grid', gap: 5, minWidth: 0 });

/** 年、月、日三个触发钮：年稍宽。 */
export const ymd = style({ display: 'grid', gridTemplateColumns: '1.25fr 1fr 1fr', gap: 6 });

/** 字段下的一行说明：另一种历法的对应日期、候选时辰。 */
export const conv = style({ minHeight: 20, fontSize: size.aux, color: color.fg2 });

export const convValue = style({ fontFamily: font.serif, fontWeight: 500, color: color.fg });
