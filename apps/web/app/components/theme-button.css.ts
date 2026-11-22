import { globalStyle, style } from '@vanilla-extract/css';
import { color, motion, space } from '../styles/tokens.css';

export const button = style({
  display: 'grid',
  placeItems: 'center',
  width: space.hit,
  height: space.hit,
  flex: 'none',
  color: color.fg2,
  transition: `color ${motion.fast}`,
  selectors: { '&:hover': { color: color.fg } },
});

export const icon = style({ display: 'none' });
export const system = style({});
export const light = style({});
export const dark = style({});

/* 图标按 <html data-pref> 显示：首帧前由主题引导脚本写好，不等水合。 */
globalStyle(`:root[data-pref="system"] ${system}, :root[data-pref="light"] ${light}, :root[data-pref="dark"] ${dark}`, {
  display: 'block',
});
