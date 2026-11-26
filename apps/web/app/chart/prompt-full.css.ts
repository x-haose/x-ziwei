import { globalStyle, style } from '@vanilla-extract/css';
import { media } from '../styles/media';
import { color, font, size, space, stroke } from '../styles/tokens.css';

/** 提示词全文（设计规范 21.5）：全屏阅读视图。 */

const hair = (c: string) => `${stroke.hair} solid ${c}`;

/** 全屏层打开时，被完全盖住的页面不渲染、不进读屏。 */
globalStyle('html[data-fullview] body > header, html[data-fullview] body > main', { visibility: 'hidden' });

export const modal = style({ position: 'fixed', inset: 0, zIndex: 85, display: 'flex', flexDirection: 'column', background: color.bg, outline: 'none' });

export const dialog = style({ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, outline: 'none' });

export const head = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  minHeight: 64,
  padding: `8px ${space.pad}`,
  borderBottom: hair(color.line2),
  flex: 'none',
  '@media': {
    [media.s]: {
      display: 'grid',
      gridTemplateColumns: '44px minmax(0, 1fr) auto',
      gridTemplateAreas: '"x t c" "toc toc mode"',
      gap: 8,
    },
  },
});

export const close = style({
  display: 'grid',
  placeItems: 'center',
  width: space.hit,
  height: space.hit,
  marginLeft: -10,
  flex: 'none',
  color: color.fg2,
  '@media': { [media.s]: { gridArea: 'x', marginLeft: 0 } },
});

export const title = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  alignItems: 'baseline',
  gap: 10,
  '@media': { [media.s]: { gridArea: 't', flexDirection: 'column', alignItems: 'flex-start', gap: 0 } },
});

export const titleText = style({ fontFamily: font.serif, fontWeight: 600, fontSize: size.subtitle, whiteSpace: 'nowrap' });

export const titleCount = style({ fontFamily: font.num, fontSize: size.aux, color: color.fg3, whiteSpace: 'nowrap' });

export const tocButton = style({
  display: 'none',
  alignItems: 'center',
  gap: 6,
  maxWidth: 240,
  height: space.hit,
  padding: '0 12px',
  fontSize: size.small,
  color: color.fg2,
  boxShadow: `inset 0 0 0 ${stroke.hair} ${color.line2}`,
  '@media': {
    [media.mDown]: { display: 'inline-flex' },
    [media.s]: { gridArea: 'toc', maxWidth: 'none', justifyContent: 'flex-start' },
  },
});

export const tocCurrent = style({ color: color.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 });

export const mode = style({ width: 168, flex: 'none', '@media': { [media.s]: { gridArea: 'mode', width: 128 } } });

export const copy = style({ height: space.hit, padding: '0 18px', fontSize: size.small, flex: 'none', '@media': { [media.s]: { gridArea: 'c', padding: '0 14px' } } });

export const body = style({
  flex: 1,
  minHeight: 0,
  display: 'grid',
  gridTemplateColumns: '272px minmax(0, 1fr)',
  width: '100%',
  maxWidth: 1320,
  margin: '0 auto',
  '@media': { [media.mDown]: { gridTemplateColumns: 'minmax(0, 1fr)', position: 'relative' } },
});

export const toc = style({
  overflow: 'auto',
  padding: `20px 20px 32px ${space.pad}`,
  borderRight: hair(color.line),
  scrollbarWidth: 'thin',
  '@media': {
    [media.mDown]: {
      display: 'none',
      position: 'absolute',
      zIndex: 3,
      left: 0,
      right: 0,
      top: 0,
      maxHeight: '70vh',
      background: color.bg,
      borderRight: 0,
      borderBottom: hair(color.line3),
      padding: `12px ${space.pad} 16px`,
    },
  },
});

/** <1024 目录收起，点「目录」后在正文上方展开。 */
export const tocOpen = style({ '@media': { [media.mDown]: { display: 'block' } } });

export const tocLink = style({
  display: 'block',
  width: '100%',
  padding: '6px 10px',
  fontSize: size.small,
  lineHeight: 1.45,
  textAlign: 'left',
  color: color.fg2,
  boxShadow: `inset ${stroke.hair} 0 0 ${color.line}`,
  selectors: {
    '&:hover': { color: color.fg },
    '&[aria-current]': { color: color.fg, background: color.bg2, boxShadow: `inset 2px 0 0 ${color.fg}` },
    '&:focus-visible': { outline: `${stroke.hair} solid ${color.fg}`, outlineOffset: -2 },
  },
});

export const tocL1 = style({ fontFamily: font.serif, fontWeight: 600, color: color.fg, marginTop: 10 });
export const tocL2 = style({ paddingLeft: 18 });
export const tocL3 = style({ paddingLeft: 30, fontSize: size.aux });

export const content = style({
  overflow: 'auto',
  padding: '28px 48px 96px',
  scrollbarWidth: 'thin',
  selectors: { '&:focus': { outline: 'none' } },
  '@media': { [media.mDown]: { padding: `20px ${space.pad} 72px` } },
});

/** 原文：保留换行，标题行用主色。 */
export const raw = style({ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: size.small, lineHeight: 1.75, color: color.fg2, maxWidth: 780 });

export const rawHeading = style({ color: color.fg, fontWeight: 500 });

export const rawQuestion = style({ color: color.accent });
