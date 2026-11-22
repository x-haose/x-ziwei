import { style } from '@vanilla-extract/css';
import { color, font, motion, size, space, stroke } from '../styles/tokens.css';

const ring = (c: string) => `inset 0 0 0 ${stroke.hair} ${c}`;

/**
 * 主按钮：实心，48px 高。底色只在悬停时过渡；启用、禁用与复制成功的切换是瞬时的，
 * 避免过渡途中字与底同色。
 */
export const button = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  height: space.button,
  padding: '0 22px',
  fontSize: size.body,
  fontWeight: 500,
  whiteSpace: 'nowrap',
  background: color.btn,
  color: color.btnFg,
  transition: `transform ${motion.fast}`,
  selectors: {
    '&:hover, &[data-hovered]': {
      background: color.btnHover,
      transition: `background ${motion.fast}, transform ${motion.fast}`,
    },
    '&:active, &[data-pressed]': { transform: 'translateY(1px)' },
    '&:disabled, &[data-disabled]': {
      cursor: 'not-allowed',
      transform: 'none',
      background: color.bg3,
      color: color.fg3,
    },
    '&[data-ok]': { background: color.accent, color: color.accentFg },
  },
});

/** 幽灵按钮：透明底、细框；与主按钮同高同字号。 */
export const ghost = style([
  button,
  {
    background: 'transparent',
    color: color.fg,
    fontWeight: 400,
    boxShadow: ring(color.line3),
    selectors: {
      '&:hover, &[data-hovered]': { background: 'transparent', boxShadow: ring(color.fg) },
      '&:disabled, &[data-disabled]': { background: 'transparent', color: color.fg3, boxShadow: ring(color.line2) },
      '&[data-ok]': { background: 'transparent', color: color.accent, boxShadow: ring(color.accent) },
    },
  },
]);

/** 分段控件的外框：各段等宽，段间 1px 竖线。 */
export const segmented = style({
  display: 'flex',
  boxShadow: ring(color.line2),
});

export const segment = style({
  flex: 1,
  minHeight: space.hit,
  padding: '0 8px',
  fontSize: size.small,
  color: color.fg2,
  textAlign: 'center',
  transition: `background ${motion.fast}, color ${motion.fast}`,
  selectors: {
    '& + &': { boxShadow: `inset ${stroke.hair} 0 0 ${color.line2}` },
    '&[data-hovered]': { color: color.fg },
    '&[data-selected]': { background: color.btn, color: color.btnFg },
    '&[data-disabled]': { color: color.fg3, cursor: 'not-allowed' },
    '&[data-focus-visible]': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: 2 },
  },
});

/** 段内文字用衬线（运限层、候选时辰）。 */
export const segmentSerif = style({ fontFamily: font.serif, fontWeight: 600 });

/** 字段标签：12px，`--fg-3`。 */
export const fieldLabel = style({
  display: 'flex',
  justifyContent: 'space-between',
  gap: 8,
  fontSize: size.label,
  color: color.fg3,
});

/** 错误信息：13px 强调色字，左侧 2px 强调色竖线，挂在对应字段下。 */
export const error = style({
  display: 'flex',
  gap: 6,
  paddingLeft: 8,
  fontSize: size.aux,
  lineHeight: 1.5,
  color: color.accent,
  boxShadow: `inset ${stroke.rule} 0 0 ${color.accent}`,
});

/** 只给读屏看的文字。 */
export const visuallyHidden = style({
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
});
