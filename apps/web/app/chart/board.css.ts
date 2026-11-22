import { createVar, fallbackVar, keyframes, style } from '@vanilla-extract/css';
import { media } from '../styles/media';
import { color, font, motion, size, stroke } from '../styles/tokens.css';

/** 盘的外框尺寸与外圈刻度带宽度，由放置它的页面按断点设定。 */
export const boardWidth = createVar();
export const boardHeight = createVar();
export const ringBand = createVar();

/**
 * 盘的密度按实际格宽决定（设计规范第 7 节），用容器查询而不是断点：中间 4×4 网格的内容区
 * 宽或高不足 520px（单格 <130px）即为紧凑盘。
 */
const COMPACT = '(width < 520px) or (height < 520px)';

/** 外圈刻度带宽度，页面没给时为 0（不画外圈）。 */
const band = fallbackVar(ringBand, '0px');

export const board = style({
  position: 'relative',
  flex: 'none',
  width: boardWidth,
  height: boardHeight,
  padding: band,
  containerType: 'size',
  containerName: 'board',
});

export const grid = style({
  display: 'grid',
  gridTemplate: 'repeat(4, 1fr) / repeat(4, 1fr)',
  gap: stroke.hair,
  width: '100%',
  height: '100%',
  background: color.line2,
  border: `${stroke.hair} solid ${color.line2}`,
});

export const cell = style({
  position: 'relative',
  display: 'flex',
  minWidth: 0,
  minHeight: 0,
  overflow: 'hidden',
  background: color.bg,
});

export const middle = style({ gridArea: '2 / 2 / 4 / 4', background: color.bg });

/** 空状态里每宫只写地支。 */
export const ghostBranch = style({
  margin: 'auto',
  fontFamily: font.serif,
  fontSize: size.branch,
  fontWeight: 500,
  color: color.fg3,
  '@container': { [`board ${COMPACT}`]: { fontSize: size.branchCompact } },
});

const fadeIn = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });

/** 外圈刻度与底星：量出尺寸后才画，出现时淡入。 */
export const overlay = style({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  overflow: 'visible',
  pointerEvents: 'none',
  animation: `${fadeIn} 250ms ${motion.ease} both`,
});

export const tick = style({ stroke: color.line3, strokeWidth: 1, shapeRendering: 'crispEdges' });

export const baseStar = style({ fill: color.bg, stroke: color.fg3, strokeWidth: 1 });

/** 中宫的文字层：盖在网格中宫之上，块与块之间留白，每块自带底色，连线从块后穿过。 */
export const centre = style({
  position: 'absolute',
  inset: `calc(${band} + (100% - 2 * ${band}) / 4)`,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  textAlign: 'center',
  pointerEvents: 'none',
});

export const state = style({
  display: 'grid',
  justifyItems: 'center',
  gap: 10,
  padding: '8px 12px',
  background: color.bg,
});

export const stateTitle = style({
  fontFamily: font.serif,
  fontWeight: 500,
  fontSize: size.boardState,
  color: color.fg,
  '@container': { [`board ${COMPACT}`]: { fontSize: size.boardStateCompact } },
});

export const stateHint = style({
  fontSize: size.aux,
  color: color.fg2,
  '@container': { [`board ${COMPACT}`]: { fontSize: size.label } },
});

/** 提示语按屏宽二选一：手机上生辰表单在盘的上方，其余在左侧。 */
export const hintWide = style({ '@media': { [media.s]: { display: 'none' } } });
export const hintNarrow = style({ display: 'none', '@media': { [media.s]: { display: 'inline' } } });
