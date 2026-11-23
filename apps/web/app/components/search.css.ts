import { style } from '@vanilla-extract/css';
import { media } from '../styles/media';
import { color, font, motion, size, space, stroke } from '../styles/tokens.css';

export const trigger = style({
  display: 'grid',
  placeItems: 'center',
  width: space.hit,
  height: space.hit,
  flex: 'none',
  color: color.fg2,
  transition: `color ${motion.fast}`,
  selectors: { '&[data-hovered]': { color: color.fg }, '&[data-focus-visible]': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: 2 } },
});

export const overlay = style({ position: 'fixed', inset: 0, zIndex: 69, background: color.scrim });

/** 桌面：居中偏上的面板；手机：贴顶全宽。 */
export const modal = style({
  position: 'fixed',
  left: '50%',
  top: '12vh',
  transform: 'translateX(-50%)',
  width: 'min(560px, calc(100vw - 32px))',
  maxHeight: '70vh',
  display: 'flex',
  flexDirection: 'column',
  background: color.bg,
  boxShadow: `0 0 0 ${stroke.hair} ${color.line3}`,
  outline: 'none',
  '@media': { [media.s]: { left: 0, top: 0, transform: 'none', width: '100vw', maxHeight: '85vh' } },
});

export const dialog = style({ display: 'flex', flexDirection: 'column', minHeight: 0, outline: 'none' });

export const field = style({ display: 'flex', alignItems: 'center', borderBottom: `${stroke.hair} solid ${color.line}` });

export const input = style({
  flex: 1,
  minWidth: 0,
  height: 52,
  padding: '0 14px',
  border: 0,
  background: 'transparent',
  fontSize: size.body,
  outline: 'none',
  selectors: { '&::placeholder': { color: color.fg3 }, '&::-webkit-search-cancel-button': { display: 'none' } },
});

export const close = style({
  display: 'grid',
  placeItems: 'center',
  width: space.hit,
  height: space.hit,
  flex: 'none',
  color: color.fg2,
  selectors: { '&[data-hovered]': { color: color.fg } },
});

export const list = style({ overflow: 'auto', padding: 6, outline: 'none', minHeight: 0 });

export const note = style({ padding: '14px 16px', fontSize: size.aux, color: color.fg3 });

export const item = style({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 2,
  minHeight: space.hit,
  padding: '6px 10px',
  color: color.fg2,
  cursor: 'pointer',
  outline: 'none',
  selectors: {
    '&[data-focused], &[data-hovered]': { background: color.bg2, color: color.fg },
    '&[data-focus-visible]': { boxShadow: `inset 0 0 0 ${stroke.hair} ${color.fg}` },
  },
});

export const itemPage = style({ fontFamily: font.serif, fontWeight: 600, fontSize: size.body, color: color.fg });
export const itemHeading = style({ paddingLeft: 22, fontFamily: font.serif, fontSize: size.small });
export const itemText = style({ paddingLeft: 22, fontSize: size.aux, lineHeight: 1.6 });
