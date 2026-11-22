import { createVar, globalStyle, style } from '@vanilla-extract/css';
import { boardHeight, boardWidth, ringBand } from '../chart/board.css';
import { media } from '../styles/media';
import { color, font, rubbing, size, space, stroke } from '../styles/tokens.css';

/** 拓片图的宽度；高度按原图比例（1400×1429）。拓片与其上的紫微垣标注共用这一组定位。 */
const rubWidth = createVar();
const RATIO = 1429 / 1400;

/**
 * ≥1280：拓片满版（宽 1180，中心在视口 50%+180、45% 高处），左侧与顶部各一道遮罩；
 * 1024–1279：拓片缩到 1040、上移；<1024：纵向排，拓片在上、标题居中、盘在下。
 */
export const home = style({
  position: 'relative',
  height: '100vh',
  minHeight: 680,
  overflow: 'hidden',
  vars: { [rubWidth]: '1180px' },
  '@media': {
    [media.homeMid]: { vars: { [rubWidth]: '1040px' } },
    [media.mDown]: { height: 'auto', minHeight: '100svh', vars: { [rubWidth]: 'max(640px, 118vw)' } },
  },
  selectors: {
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      zIndex: 1,
      pointerEvents: 'none',
      background: [
        `linear-gradient(90deg, ${color.bg} 0%, color-mix(in oklch, ${color.bg} 94%, transparent) 26%, color-mix(in oklch, ${color.bg} 55%, transparent) 44%, transparent 62%)`,
        `linear-gradient(180deg, ${color.bg} 0%, color-mix(in oklch, ${color.bg} 92%, transparent) 90px, transparent 230px)`,
      ].join(','),
      '@media': {
        [media.mDown]: {
          background: `linear-gradient(180deg, ${color.bg} 0px, color-mix(in oklch, ${color.bg} 85%, transparent) 52px, transparent 130px, transparent calc(0.36 * ${rubWidth}), color-mix(in oklch, ${color.bg} 55%, transparent) calc(0.5 * ${rubWidth}), ${color.bg} calc(0.6 * ${rubWidth}))`,
        },
      },
    },
  },
});

/** 拓片与紫微垣标注的定位框，与拓片图同尺寸同位置。 */
export const sky = style({
  position: 'absolute',
  width: rubWidth,
  height: `calc(${rubWidth} * ${RATIO})`,
  left: `calc(50% + 180px - ${rubWidth} / 2)`,
  top: `calc(45% - ${rubWidth} * ${RATIO} / 2)`,
  pointerEvents: 'none',
  userSelect: 'none',
  '@media': {
    [media.homeMid]: { left: `calc(50% + 150px - ${rubWidth} / 2)`, top: `calc(37% - ${rubWidth} * ${RATIO} / 2)` },
    [media.mDown]: { left: `calc(50% - ${rubWidth} / 2)`, top: `calc(-0.15 * ${rubWidth})` },
  },
});

export const rubbingImage = style({
  width: '100%',
  height: '100%',
  mixBlendMode: rubbing.blend as 'screen',
  filter: rubbing.filter,
  opacity: rubbing.opacity,
});

/** 紫微垣：拓片中心的赭红细圈与圆心点，竖排标注与图名写在圈旁，层级在遮罩之上。 */
export const ziwei = style({
  position: 'absolute',
  zIndex: 2,
  left: '50.2%',
  top: '49.7%',
  width: '21%',
  aspectRatio: '1',
  transform: 'translate(-50%, -50%)',
  border: `${stroke.hair} solid ${color.accent}`,
  borderRadius: '50%',
});

globalStyle(`${ziwei}::after`, {
  content: '""',
  position: 'absolute',
  left: '50%',
  top: '50%',
  width: 5,
  height: 5,
  transform: 'translate(-50%, -50%)',
  borderRadius: '50%',
  background: color.accent,
});

const halo = {
  paintOrder: 'stroke fill',
  WebkitTextStroke: `5px ${color.bg}`,
} as const;

/** 竖排「紫微垣」：桌面在圈左，平板与手机在圈右并从圈边引一道短线。 */
export const ziweiLabel = style({
  ...halo,
  position: 'absolute',
  top: '50%',
  right: 'calc(100% + 8px)',
  transform: 'translateY(-50%)',
  writingMode: 'vertical-rl',
  textOrientation: 'upright',
  fontFamily: font.serif,
  fontSize: size.star,
  lineHeight: 1,
  letterSpacing: '0.12em',
  color: color.fg,
  '@media': {
    [media.mDown]: { right: 'auto', left: 'calc(100% + 40px)', fontSize: size.starCompact },
  },
});

export const ziweiTick = style({
  display: 'none',
  '@media': {
    [media.mDown]: {
      display: 'block',
      position: 'absolute',
      top: '50%',
      left: '100%',
      width: 34,
      borderTop: `${stroke.hair} solid ${color.fg}`,
    },
  },
});

/** 图名：桌面在圈左下方，右对齐；纵向排版时不显示（出处在页尾）。 */
export const ziweiCaption = style({
  ...halo,
  position: 'absolute',
  top: 'calc(50% + 42px)',
  right: 'calc(100% + 30px)',
  display: 'grid',
  justifyItems: 'end',
  fontSize: size.label,
  lineHeight: 1.5,
  color: color.fg2,
  whiteSpace: 'nowrap',
  '@media': { [media.mDown]: { display: 'none' } },
});

/* ── 顶部导航：字标、四个带两行小字的入口、一段说明、主题按钮 ── */

export const nav = style({
  position: 'relative',
  zIndex: 3,
  display: 'grid',
  gridTemplateColumns: '240px repeat(4, minmax(0, 170px)) 1fr auto',
  gap: 20,
  padding: `22px ${space.pad} 0`,
  '@media': {
    [media.lDown]: { gridTemplateColumns: '200px repeat(4, minmax(0, 150px)) 1fr auto' },
    [media.mDown]: { gridTemplateColumns: '1fr auto auto', gap: 8, padding: `12px ${space.pad} 0` },
  },
});

export const mark = style({ display: 'flex', alignItems: 'flex-start', gap: 10, color: color.fg });

export const markName = style({
  display: 'block',
  fontFamily: font.num,
  fontSize: size.markHome,
  fontWeight: 300,
  lineHeight: 1.05,
  letterSpacing: '-0.02em',
  '@media': { [media.mDown]: { fontSize: size.markNarrow } },
});

export const markSub = style({
  display: 'block',
  marginTop: 6,
  fontFamily: font.serif,
  fontSize: size.small,
  fontWeight: 500,
  letterSpacing: 0,
  color: color.fg3,
  '@media': { [media.mDown]: { fontSize: size.aux, marginTop: 3 } },
});

export const item = style({
  display: 'block',
  padding: '2px 0 6px 12px',
  borderLeft: `${stroke.hair} solid ${color.line2}`,
  '@media': { [media.mDown]: { display: 'none' } },
});

/** 纵向排版时只留「排盘」一项，改成一行字的按钮。 */
export const itemKeep = style({
  '@media': {
    [media.mDown]: { display: 'flex', alignItems: 'center', height: space.hit, border: 0, padding: '0 8px' },
  },
});

export const itemTitle = style({
  display: 'block',
  fontFamily: font.serif,
  fontSize: size.subtitle,
  fontWeight: 500,
  lineHeight: 1.3,
  selectors: { [`${item}:hover &`]: { color: color.accent } },
  '@media': { [media.mDown]: { fontSize: size.emphasis } },
});

export const itemNote = style({
  display: 'block',
  marginTop: 4,
  fontSize: size.aux,
  lineHeight: 1.5,
  color: color.fg3,
  '@media': { [media.mDown]: { display: 'none' } },
});

export const blurb = style({
  justifySelf: 'end',
  maxWidth: 252,
  fontSize: size.small,
  lineHeight: 1.6,
  color: color.fg2,
  '@media': { [media.lDown]: { display: 'none' } },
});

export const theme = style({
  margin: '-10px -10px 0 0',
  '@media': { [media.mDown]: { margin: 0 } },
});

/* ── 首屏主张 ── */

export const hero = style({
  position: 'absolute',
  zIndex: 3,
  left: space.pad,
  bottom: 72,
  maxWidth: 600,
  '@media': {
    [media.homeMid]: { bottom: 56, maxWidth: 520 },
    [media.mDown]: {
      position: 'relative',
      left: 'auto',
      bottom: 'auto',
      maxWidth: 640,
      padding: `calc(0.4 * ${rubWidth}) ${space.pad} 0`,
    },
  },
});

export const title = style({
  fontFamily: font.serif,
  fontWeight: 300,
  fontSize: size.display,
  lineHeight: 1.16,
  letterSpacing: '-0.01em',
  color: color.fg,
  '@media': {
    [media.homeMid]: { fontSize: size.displayMid },
    [media.mDown]: { fontSize: size.displayNarrow, lineHeight: 1.2 },
  },
});

export const lede = style({
  marginTop: 20,
  fontSize: size.lede,
  lineHeight: 1.7,
  fontWeight: 300,
  color: color.fg2,
  '@media': { [media.s]: { fontSize: size.body, marginTop: 12 } },
});

export const nowrap = style({ whiteSpace: 'nowrap' });

export const cta = style({
  display: 'flex',
  gap: 12,
  marginTop: 30,
  '@media': { [media.s]: { flexDirection: 'column', gap: 10, marginTop: 22 } },
});

export const ctaButton = style({
  '@media': { [media.mDown]: { flex: 1 }, [media.s]: { flex: 'none', width: '100%' } },
});

export const facts = style({
  display: 'flex',
  gap: space.gap,
  marginTop: 40,
  '@media': {
    [media.homeMid]: { gap: 20, marginTop: 32 },
    [media.mDown]: { display: 'none' },
  },
});

export const fact = style({
  minWidth: 120,
  paddingTop: 8,
  borderTop: `${stroke.hair} solid ${color.line2}`,
  '@media': { [media.homeMid]: { minWidth: 0 } },
});

export const factLabel = style({ display: 'block', fontSize: size.label, color: color.fg3 });
export const factValue = style({ fontWeight: 400, fontSize: size.small, color: color.fg });

/* ── 从底边浮出的盘 ── */

export const boardLink = style({
  position: 'absolute',
  zIndex: 2,
  right: 56,
  top: 'calc(45% + 182px)',
  display: 'block',
  '@media': {
    [media.homeMid]: { right: 32, top: 'calc(37% + 150px)' },
    [media.mDown]: { position: 'relative', right: 'auto', top: 'auto', margin: '36px auto 0', width: 'fit-content' },
  },
});

export const board = style({
  background: color.bg,
  vars: { [boardWidth]: '560px', [boardHeight]: '560px', [ringBand]: '22px' },
  '@media': {
    [media.homeMid]: { vars: { [boardWidth]: '452px', [boardHeight]: '452px', [ringBand]: '20px' } },
    [media.mDown]: {
      vars: {
        [boardWidth]: `min(calc(100vw - 2 * ${space.pad}), 620px)`,
        [boardHeight]: `min(calc(100vw - 2 * ${space.pad}), 620px)`,
        [ringBand]: '0px',
      },
    },
  },
});

/** 拓片出处：桌面贴在页面左下，纵向排版时跟在盘后。 */
export const credit = style({
  position: 'absolute',
  zIndex: 3,
  left: space.pad,
  bottom: 20,
  maxWidth: 560,
  fontSize: size.label,
  lineHeight: 1.5,
  color: color.fg3,
  selectors: { '&:hover': { color: color.fg2 } },
  '@media': {
    [media.homeMid]: { bottom: 18 },
    [media.mDown]: { position: 'static', display: 'block', maxWidth: 640, margin: '0 auto', padding: `24px ${space.pad} 32px` },
  },
});
