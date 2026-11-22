import { globalStyle } from '@vanilla-extract/css';
import { media } from './media';
import { color, font, motion, size, stroke } from './tokens.css';

globalStyle('*, *::before, *::after', { boxSizing: 'border-box', margin: 0, padding: 0 });

globalStyle('html, body', { background: color.bg, color: color.fg });

/* 全站排印：不合成粗体与斜体；中文按严格规则断行；数字等宽对齐。 */
globalStyle('html', {
  fontSynthesis: 'none',
  WebkitTextSizeAdjust: '100%',
  textSizeAdjust: '100%',
});

globalStyle('body', {
  fontFamily: font.sans,
  fontSize: size.body,
  lineHeight: 1.6,
  lineBreak: 'strict',
  fontVariantNumeric: 'tabular-nums',
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
  minHeight: '100vh',
  transition: `background-color ${motion.base}, color ${motion.base}`,
});

globalStyle('button, input, textarea', { font: 'inherit', color: 'inherit' });
globalStyle('button', { background: 'none', border: 0, cursor: 'pointer', textAlign: 'inherit' });
globalStyle('a', { color: 'inherit', textDecoration: 'none' });
globalStyle('img, svg', { display: 'block' });
globalStyle('ul, ol', { listStyle: 'none' });

globalStyle(':focus-visible', { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: '2px' });
globalStyle('::selection', { background: color.fg, color: color.bg });

globalStyle('*, *::before, *::after', {
  '@media': {
    [media.reducedMotion]: {
      animation: 'none !important',
      transition: 'none !important',
    },
  },
});
