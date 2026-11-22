import { style } from '@vanilla-extract/css';
import { media } from '../styles/media';
import { color, font, size, space, stroke } from '../styles/tokens.css';

export const bar = style({
  position: 'relative',
  zIndex: 5,
  display: 'flex',
  alignItems: 'center',
  gap: space.gap,
  height: 56,
  padding: `0 ${space.pad}`,
  borderBottom: `${stroke.hair} solid ${color.line}`,
  '@media': { [media.s]: { gap: 8, paddingRight: 8 } },
});

export const mark = style({ display: 'flex', alignItems: 'center', gap: 10, minHeight: space.hit, color: color.fg });

export const markName = style({
  fontFamily: font.num,
  fontWeight: 500,
  fontSize: size.star,
  letterSpacing: '-0.01em',
});

export const markSub = style({
  fontFamily: font.serif,
  fontSize: size.aux,
  fontWeight: 500,
  color: color.fg3,
  '@media': { [media.s]: { display: 'none' } },
});

export const nav = style({ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 'auto' });

export const link = style({
  display: 'flex',
  alignItems: 'center',
  height: space.hit,
  padding: '0 12px',
  fontSize: size.small,
  color: color.fg2,
  whiteSpace: 'nowrap',
  selectors: {
    '&:hover': { color: color.fg },
    '&[aria-current="page"]': { color: color.fg, boxShadow: `inset 0 calc(-1 * ${stroke.hair}) 0 ${color.fg}` },
  },
});

/** 平板与手机只留首页与排盘两项。 */
export const optional = style({ '@media': { [media.mDown]: { display: 'none' } } });

export const theme = style({ marginLeft: 6 });
