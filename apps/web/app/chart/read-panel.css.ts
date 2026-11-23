import { style } from '@vanilla-extract/css';
import { media } from '../styles/media';
import { color, font, motion, size, space, stroke } from '../styles/tokens.css';

export const section = style({
  gridArea: 'read',
  minWidth: 0,
  minHeight: 0,
  paddingTop: 20,
  '@media': { [media.s]: { paddingTop: 18 } },
});

export const head = style({
  display: 'flex',
  alignItems: 'baseline',
  flexWrap: 'wrap',
  gap: '4px 10px',
  paddingBottom: 8,
  borderBottom: `${stroke.hair} solid ${color.line}`,
});

export const name = style({ fontFamily: font.serif, fontSize: size.reading, fontWeight: 600, lineHeight: 1.2, color: color.accent });
export const headNote = style({ fontFamily: font.serif, fontSize: size.body, color: color.fg2 });
export const headAges = style({ marginLeft: 'auto', fontFamily: font.num, fontSize: size.aux, color: color.fg3 });

export const stars = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '2px 14px',
  padding: '9px 0',
  fontSize: size.aux,
  lineHeight: 1.6,
  color: color.fg2,
  borderBottom: `${stroke.hair} solid ${color.line}`,
});

export const starName = style({ marginRight: 2, fontFamily: font.serif, fontWeight: 600, fontSize: size.body, color: color.fg });
export const huaAccent = style({ color: color.accent });
export const extra = style({ width: '100%', fontFamily: font.serif, fontSize: size.aux, color: color.fg3 });

export const row = style({
  display: 'grid',
  gridTemplateColumns: '34px 1fr auto',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  minHeight: space.hit,
  padding: '4px 0',
  textAlign: 'left',
  borderBottom: `${stroke.hair} solid ${color.line}`,
});

export const role = style({ fontSize: size.label, color: color.fg3 });

export const rowName = style({
  fontFamily: font.serif,
  fontSize: size.body,
  fontWeight: 600,
  color: color.fg2,
  transition: `color ${motion.fast}`,
  selectors: { [`${row}:hover &`]: { color: color.accent } },
});

export const rowBranch = style({ marginLeft: 4, fontWeight: 400, fontSize: size.aux, color: color.fg3 });
export const rowStars = style({ fontFamily: font.serif, fontSize: size.small, color: color.fg2, textAlign: 'right' });

export const pattern = style({ paddingTop: 9, fontSize: size.aux, color: color.fg2 });
export const patternName = style({ margin: '0 6px', fontFamily: font.serif, fontWeight: 600, fontSize: size.small, color: color.fg });
