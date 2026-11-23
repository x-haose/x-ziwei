import { globalStyle, style } from '@vanilla-extract/css';
import { prose } from '../markdown/markdown.css';
import { color, font, size, stroke } from '../styles/tokens.css';

/** 提示框：普通提示 `--bg-2` 底无框；警示提示无底色，左侧 2px 强调色竖线加 1px 细框，标题强调色。 */
export const callout = style({
  margin: '1.4em 0',
  padding: '14px 18px',
  background: color.bg2,
  fontSize: size.body,
  lineHeight: 1.75,
});

export const calloutWarn = style({
  background: 'transparent',
  boxShadow: `inset ${stroke.rule} 0 0 ${color.accent}, inset 0 0 0 ${stroke.hair} ${color.line2}`,
});

export const calloutTitle = style({
  margin: '0 0 4px',
  fontFamily: font.serif,
  fontWeight: 600,
  fontSize: size.emphasis,
  selectors: { [`${calloutWarn} &`]: { color: color.accent } },
});

globalStyle(`${prose} ${callout} p`, { margin: '0.3em 0' });
globalStyle(`${prose} ${callout} ${calloutTitle}`, { margin: '0 0 4px' });

/**
 * 步骤条：28px 方形编号框，编号间 1px 竖线相连，内容缩进 44px，步间 18px。
 * 整体与正文列表同样左缩进 1.4em。选择器带上正文容器，盖过正文里有序列表的通用样式。
 */
export const steps = style({});
export const step = style({});

globalStyle(`${prose} ${steps}`, { listStyle: 'none', counterReset: 'step', margin: '1.4em 0', padding: '0 0 0 1.4em' });
globalStyle(`${prose} ${step}`, { position: 'relative', counterIncrement: 'step', padding: '0 0 18px 44px', margin: 0 });
globalStyle(`${prose} ${step}::before`, {
  content: 'counter(step)',
  position: 'absolute',
  left: 0,
  top: 2,
  width: 28,
  height: 28,
  display: 'grid',
  placeItems: 'center',
  fontFamily: font.num,
  fontSize: size.aux,
  lineHeight: 1,
  color: color.fg,
  background: color.bg,
  boxShadow: `inset 0 0 0 ${stroke.hair} ${color.line3}`,
});
globalStyle(`${prose} ${step}::after`, {
  content: '""',
  position: 'absolute',
  left: 14,
  top: 34,
  bottom: 4,
  width: 1,
  background: color.line2,
});
globalStyle(`${prose} ${step}:last-child`, { paddingBottom: 0 });
globalStyle(`${prose} ${step}:last-child::after`, { display: 'none' });
globalStyle(`${prose} ${step} p`, { margin: 0 });
