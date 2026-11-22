import { style } from '@vanilla-extract/css';
import { color, size, stroke, space } from '../styles/tokens.css';

export const footer = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '4px 20px',
  maxWidth: 1240,
  margin: '0 auto',
  padding: `20px ${space.pad} 28px`,
  borderTop: `${stroke.hair} solid ${color.line}`,
  fontSize: size.aux,
  color: color.fg3,
});

export const link = style({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: space.hit,
  color: color.fg2,
  selectors: { '&:hover': { color: color.fg } },
});

export const lang = style([link, { marginLeft: 'auto' }]);
