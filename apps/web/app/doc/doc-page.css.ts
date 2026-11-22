import { style } from '@vanilla-extract/css';
import { media } from '../styles/media';
import { color, font, motion, size, space, stroke } from '../styles/tokens.css';

/**
 * 内容页（设计规范第 14 节）：≥1200 三栏（侧栏 200 ｜ 正文 ｜ 本页目录 200，栏间 48，最宽 1240 居中）；
 * 820–1199 去掉右侧目录，改为正文顶部的展开条；<820 单栏，文档分组移到正文末尾。
 */
export const page = style({
  display: 'grid',
  gridTemplateColumns: '200px minmax(0, 1fr) 200px',
  columnGap: 48,
  maxWidth: 1240,
  margin: '0 auto',
  padding: `40px ${space.pad} 72px`,
  '@media': {
    [media.docNoToc]: { gridTemplateColumns: '200px minmax(0, 1fr)', columnGap: 40 },
    [media.docSingle]: { gridTemplateColumns: 'minmax(0, 1fr)', paddingTop: 20 },
  },
});

export const side = style({
  position: 'sticky',
  top: 24,
  alignSelf: 'start',
  fontSize: size.small,
  '@media': {
    [media.docSingle]: {
      position: 'static',
      order: 3,
      marginTop: 48,
      paddingTop: 20,
      borderTop: `${stroke.hair} solid ${color.line}`,
    },
  },
});

export const sideSection = style({ selectors: { '& + &': { marginTop: 18 } } });

export const sideGroup = style({ marginBottom: 4, fontSize: size.label, fontWeight: 400, color: color.fg3 });

export const sideLink = style({
  display: 'flex',
  alignItems: 'center',
  minHeight: 36,
  padding: '0 10px',
  color: color.fg2,
  boxShadow: `inset ${stroke.hair} 0 0 ${color.line}`,
  selectors: {
    '&:hover': { color: color.fg },
    '&[aria-current="page"]': { color: color.fg, background: color.bg2, boxShadow: `inset ${stroke.rule} 0 0 ${color.fg}` },
  },
});

export const article = style({
  order: 2,
  width: '100%',
  maxWidth: '35em',
  margin: '0 auto',
  fontSize: size.prose,
  minWidth: 0,
});

export const header = style({
  paddingTop: '1em',
  paddingBottom: 28,
  marginBottom: 8,
  borderBottom: `${stroke.hair} solid ${color.line2}`,
});

export const crumb = style({ marginBottom: 10, fontSize: size.aux, color: color.fg3 });

export const title = style({
  fontFamily: font.serif,
  fontWeight: 500,
  fontSize: size.docTitle,
  lineHeight: 1.25,
  letterSpacing: '-0.005em',
  '@media': { [media.docSingle]: { fontSize: size.docTitleNarrow } },
});

export const lede = style({
  marginTop: 12,
  fontSize: size.lede,
  lineHeight: 1.7,
  color: color.fg2,
  '@media': { [media.docSingle]: { fontSize: size.prose } },
});

/* ── 本页目录 ── */

export const toc = style({
  position: 'sticky',
  top: 24,
  order: 3,
  alignSelf: 'start',
  fontSize: size.aux,
  '@media': { [media.docNoToc]: { display: 'none' } },
});

export const tocLabel = style({ marginBottom: 6, fontSize: size.label, color: color.fg3 });

export const tocLink = style({
  display: 'block',
  padding: '5px 0 5px 12px',
  lineHeight: 1.5,
  color: color.fg2,
  boxShadow: `inset ${stroke.hair} 0 0 ${color.line}`,
  selectors: {
    '&:hover': { color: color.fg },
    '&[data-current]': { color: color.fg, boxShadow: `inset ${stroke.rule} 0 0 ${color.fg}` },
  },
});

export const tocSub = style({ paddingLeft: 24, fontSize: size.label });

/** 正文顶部的「本页目录」展开条，只在没有右侧目录时出现。 */
export const mobileToc = style({
  display: 'none',
  margin: '0 0 8px',
  boxShadow: `inset 0 0 0 ${stroke.hair} ${color.line2}`,
  '@media': { [media.docNoToc]: { display: 'block' } },
});

export const mobileTocButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  height: space.hit,
  padding: '0 14px',
  fontSize: size.small,
  color: color.fg2,
});

export const mobileTocCaret = style({
  transition: `transform ${motion.base}`,
  selectors: { [`${mobileTocButton}[aria-expanded="true"] &`]: { transform: 'rotate(180deg)' } },
});

export const mobileTocList = style({ padding: '0 14px 10px', fontSize: size.aux });

/* ── 上一篇/下一篇 ── */

export const pager = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
  marginTop: 64,
  '@media': { [media.docSingle]: { gridTemplateColumns: '1fr' } },
});

export const pagerLink = style({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  minHeight: 76,
  padding: '12px 16px',
  boxShadow: `inset 0 0 0 ${stroke.hair} ${color.line2}`,
  transition: `background ${motion.fast}, box-shadow ${motion.fast}`,
  selectors: {
    '&:hover': { background: color.bg2, boxShadow: `inset 0 0 0 ${stroke.hair} ${color.line3}` },
  },
});

export const pagerNext = style({
  textAlign: 'right',
  gridColumn: 2,
  '@media': { [media.docSingle]: { gridColumn: 1 } },
});

export const pagerLabel = style({ fontSize: size.label, color: color.fg3 });

export const pagerTitle = style({ marginTop: 2, fontFamily: font.serif, fontWeight: 500, fontSize: size.lede });
