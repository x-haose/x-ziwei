import { style } from '@vanilla-extract/css';
import { color, motion, size } from '../styles/tokens.css';

export const toast = style({
  position: 'fixed',
  left: '50%',
  bottom: 28,
  zIndex: 50,
  transform: 'translate(-50%, 12px)',
  opacity: 0,
  pointerEvents: 'none',
  maxWidth: 'calc(100vw - 32px)',
  padding: '10px 16px',
  background: color.btn,
  color: color.btnFg,
  fontSize: size.small,
  lineHeight: 1.5,
  transition: `opacity ${motion.base}, transform ${motion.base}`,
  selectors: {
    '&[data-on]': { opacity: 1, transform: 'translate(-50%, 0)' },
  },
});
