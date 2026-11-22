import { style } from '@vanilla-extract/css';
import { color, font, size, space, stroke } from '../styles/tokens.css';

export const page = style({
  display: 'grid',
  alignContent: 'center',
  justifyItems: 'start',
  gap: 12,
  minHeight: '100vh',
  maxWidth: 640,
  margin: '0 auto',
  padding: `0 ${space.pad}`,
});

export const code = style({ fontFamily: font.num, fontSize: size.aux, color: color.fg3 });

export const title = style({ fontFamily: font.serif, fontWeight: 500, fontSize: size.docTitle, lineHeight: 1.25 });

export const back = style({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: space.hit,
  fontSize: size.body,
  textDecoration: 'underline',
  textDecorationColor: color.line3,
  textDecorationThickness: stroke.hair,
  textUnderlineOffset: 4,
  selectors: { '&:hover': { textDecorationColor: color.fg } },
});
