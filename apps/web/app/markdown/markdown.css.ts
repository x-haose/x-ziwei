import { globalStyle, style } from '@vanilla-extract/css';
import { media } from '../styles/media';
import { color, font, motion, size, space, stroke } from '../styles/tokens.css';

const hair = (c: string) => `${stroke.hair} solid ${c}`;

/* ── 两种排版共用的部分 ── */

export const tableWrap = style({ overflowX: 'auto' });

export const codeBlock = style({
  margin: '1.4em 0',
  background: color.well,
  boxShadow: `inset 0 0 0 ${stroke.hair} ${color.line2}`,
});

export const codeHead = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: space.hit,
  paddingLeft: 14,
  borderBottom: hair(color.line),
  fontSize: size.aux,
  color: color.fg2,
});

export const codeCopy = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: space.hit,
  padding: '0 14px',
  fontSize: size.aux,
  color: color.fg2,
  selectors: { '&:hover': { color: color.fg }, '&[data-ok]': { color: color.accent } },
});

export const pre = style({
  margin: 0,
  padding: '14px 16px 16px',
  overflowX: 'auto',
  fontFamily: font.mono,
  fontSize: size.code,
  lineHeight: 1.7,
  color: color.fg,
  tabSize: 2,
  scrollbarWidth: 'thin',
  scrollbarColor: `${color.line2} transparent`,
});

/** 长段纯文本（给模型的说明）折行，改用正文字体。 */
export const codeWrap = style({});
globalStyle(`${codeWrap} ${pre}`, {
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontFamily: font.sans,
  fontSize: size.body,
  lineHeight: 1.8,
});

/* ── 提示词预览（设计规范第 13 节） ── */

export const preview = style({ fontSize: size.small, lineHeight: 1.75, color: color.fg });

const p = (sel: string, rule: Parameters<typeof globalStyle>[1]) => globalStyle(`${preview} ${sel}`, rule);
p('h1, h2, h3, h4', { fontFamily: font.serif, fontWeight: 600, color: color.fg, lineHeight: 1.4 });
p('h1', { fontSize: size.emphasis, margin: '0 0 .6em' });
p('h2', { fontSize: size.body, margin: '1.4em 0 .5em', paddingTop: '.8em', borderTop: hair(color.line) });
p('h3, h4', { fontSize: size.small, margin: '1.1em 0 .4em' });
p('p', { margin: '0 0 .7em' });
p('ul, ol', { margin: '0 0 .7em', paddingLeft: '1.3em' });
p('ul', { listStyle: 'disc' });
p('ol', { listStyle: 'decimal' });
p('li', { margin: '.15em 0' });
p('li::marker', { color: color.fg3 });
p('strong', { fontWeight: 500 });
p('hr', { border: 0, borderTop: hair(color.line), margin: '1em 0' });
p('a', { textDecoration: 'underline', textDecorationColor: color.line3, textUnderlineOffset: 3 });
p(':not(pre) > code', {
  fontFamily: font.mono,
  fontSize: size.code,
  padding: '.05em .3em',
  background: color.bg2,
  boxShadow: `inset 0 0 0 ${stroke.hair} ${color.line}`,
});
p(`${tableWrap}`, { margin: '0 0 .8em' });
p('table', { borderCollapse: 'collapse', width: '100%', fontSize: size.aux, fontVariantNumeric: 'tabular-nums' });
p('th', {
  fontWeight: 400,
  fontSize: size.label,
  color: color.fg3,
  textAlign: 'left',
  padding: '4px 8px 4px 0',
  borderBottom: hair(color.line2),
  whiteSpace: 'nowrap',
});
p('td', { padding: '4px 8px 4px 0', borderBottom: hair(color.line), verticalAlign: 'top' });

/* ── 内容页正文（设计规范第 14 节） ── */

export const prose = style({
  fontSize: size.prose,
  lineHeight: 1.85,
  color: color.fg,
});

const r = (sel: string, rule: Parameters<typeof globalStyle>[1]) => globalStyle(`${prose} ${sel}`, rule);
r('p', { margin: '1em 0' });
r('h2', {
  fontFamily: font.serif,
  fontWeight: 600,
  fontSize: size.proseH2,
  lineHeight: 1.4,
  margin: '2.4em 0 .7em',
  paddingTop: '1.1em',
  borderTop: hair(color.line),
  scrollMarginTop: 24,
  '@media': { [media.docSingle]: { fontSize: size.proseH2Narrow } },
});
r('h3, h4', {
  fontFamily: font.serif,
  fontWeight: 600,
  fontSize: size.subtitle,
  lineHeight: 1.5,
  margin: '1.9em 0 .5em',
  scrollMarginTop: 24,
});
r('ul, ol', { margin: '1em 0', paddingLeft: '1.4em' });
r('ul', { listStyle: 'disc' });
r('ol', { listStyle: 'decimal' });
r('li', { margin: '.35em 0', paddingLeft: '.2em' });
r('li::marker', { color: color.fg3 });
r('strong', { fontWeight: 500 });
r('hr', { border: 0, borderTop: hair(color.line), margin: '2em 0' });
r('a', {
  textDecoration: 'underline',
  textDecorationColor: color.line3,
  textDecorationThickness: 1,
  textUnderlineOffset: 4,
  transition: `text-decoration-color ${motion.fast}`,
});
r('a:hover', { textDecorationColor: color.fg });
r(':not(pre) > code', {
  fontFamily: font.mono,
  fontSize: '.88em',
  padding: '.1em .35em',
  background: color.bg2,
  boxShadow: `inset 0 0 0 ${stroke.hair} ${color.line}`,
  wordBreak: 'break-all',
});
r(`${tableWrap}`, { margin: '1.4em 0' });
r('table', { borderCollapse: 'collapse', width: '100%', fontSize: size.body, lineHeight: 1.6 });
r('th', {
  fontWeight: 400,
  fontSize: size.aux,
  color: color.fg3,
  textAlign: 'left',
  padding: '0 16px 8px 0',
  borderBottom: hair(color.line2),
});
r('td', { padding: '10px 16px 10px 0', borderBottom: hair(color.line), verticalAlign: 'top' });
r('td code', { whiteSpace: 'nowrap', wordBreak: 'normal', fontSize: size.code });

/* 手机上表格逐行上下堆叠。 */
r(`${tableWrap}`, { '@media': { [media.s]: { overflow: 'visible' } } });
r('table, tbody, tr, td', { '@media': { [media.s]: { display: 'block', width: '100%' } } });
r('thead', { '@media': { [media.s]: { display: 'none' } } });
r('tr', { '@media': { [media.s]: { padding: '10px 0', borderBottom: hair(color.line) } } });
r('td', { '@media': { [media.s]: { padding: 0, border: 0 } } });
r('td + td', { '@media': { [media.s]: { marginTop: 4 } } });
r('td code', { '@media': { [media.s]: { whiteSpace: 'normal', wordBreak: 'break-all' } } });
