import { globalStyle, style } from '@vanilla-extract/css';
import { media } from '../styles/media';
import { color, font, motion, size, space, stroke } from '../styles/tokens.css';

export const section = style({
  gridArea: 'layer',
  minWidth: 0,
  paddingTop: 20,
  '@media': { [media.mDown]: { paddingTop: 16 }, [media.s]: { paddingTop: 8 } },
});

export const head = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  minHeight: 30,
  paddingBottom: 6,
  borderBottom: `${stroke.hair} solid ${color.line}`,
  '@media': { [media.s]: { display: 'none' } },
});

export const headTitle = style({ fontFamily: font.serif, fontSize: size.body, fontWeight: 600, color: color.fg });

export const tabs = style({ marginTop: 8, '@media': { [media.s]: { marginTop: 0 } } });

/** 选择格：大限 3 列、流年 5 列、流月 4 列；平板一行排开；手机改为可横向滑动的一行。 */
export const grid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 1,
  marginTop: 10,
  padding: 1,
  '@media': {
    [media.mDown]: { gridTemplateColumns: 'repeat(6, 1fr)' },
    [media.s]: {
      display: 'flex',
      overflowX: 'auto',
      scrollbarWidth: 'none',
      gap: 0,
      margin: `8px calc(-1 * ${space.pad}) 0`,
      padding: `0 ${space.pad}`,
    },
  },
});

export const gridYears = style({
  gridTemplateColumns: 'repeat(5, 1fr)',
  '@media': { [media.mDown]: { gridTemplateColumns: 'repeat(10, 1fr)' }, [media.s]: { display: 'none' } },
});

export const gridMonths = style({
  gridTemplateColumns: 'repeat(4, 1fr)',
  '@media': { [media.mDown]: { gridTemplateColumns: 'repeat(7, 1fr)' } },
});

export const tile = style({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  justifyContent: 'center',
  minHeight: 46,
  padding: '4px 8px',
  background: color.bg,
  boxShadow: `0 0 0 ${stroke.hair} ${color.line}`,
  textAlign: 'left',
  transition: `background ${motion.fast}`,
  selectors: {
    '&:hover': { background: color.bg2 },
    '&[aria-pressed="true"]': { background: color.btn },
  },
  '@media': {
    [media.s]: { flex: 'none', minWidth: 76, boxShadow: `inset 0 0 0 ${stroke.hair} ${color.line}`, marginRight: -1 },
  },
});

/** 流年、流月的格子居中。 */
export const tileCentered = style({ alignItems: 'center', padding: '4px 2px', whiteSpace: 'nowrap', '@media': { [media.s]: { minWidth: 60 } } });

/** 今天所在的大限、流年、流月：右上一个强调色小圆点。 */
export const tileNow = style({
  selectors: {
    '&::after': {
      content: '""',
      position: 'absolute',
      right: 7,
      top: 7,
      width: 5,
      height: 5,
      borderRadius: '50%',
      background: color.accent,
    },
  },
});

export const tileMain = style({ fontFamily: font.num, fontWeight: 400, fontSize: size.aux, lineHeight: 1.3, color: color.fg });
export const tileMainSerif = style({ fontFamily: font.serif, fontWeight: 500, fontSize: size.small });
export const tileNote = style({ fontFamily: font.serif, fontSize: size.label, lineHeight: 1.3, color: color.fg3 });

globalStyle(`${tile}[aria-pressed="true"] ${tileMain}`, { color: color.btnFg });
globalStyle(`${tile}[aria-pressed="true"] ${tileNote}`, { color: color.btnFg, opacity: 0.8 });

/** 流年选择条：‹ 2026 丙午 ›。 */
export const yearNav = style({ display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr) 44px', gap: 4, marginTop: 10 });

export const yearStep = style({
  display: 'grid',
  placeItems: 'center',
  height: space.hit,
  color: color.fg2,
  boxShadow: `inset 0 0 0 ${stroke.hair} ${color.line2}`,
  selectors: {
    '&:hover': { color: color.fg, boxShadow: `inset 0 0 0 ${stroke.hair} ${color.line3}` },
    '&:disabled': { color: color.line3, cursor: 'not-allowed' },
  },
});

export const natal = style({ marginTop: 10, fontSize: size.aux, lineHeight: 1.7, color: color.fg2 });
export const natalStrong = style({ fontFamily: font.serif, fontWeight: 500, color: color.fg });

export const legend = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px 14px',
  marginTop: 10,
  fontSize: size.aux,
  color: color.fg2,
  '@media': { [media.s]: { display: 'none' } },
});

export const legendItem = style({ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' });

export const legendHua = style({});
globalStyle(`${legendItem} > ${legendHua}`, { margin: 0 });
