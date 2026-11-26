import { globalStyle, style } from '@vanilla-extract/css';
import { media } from '../styles/media';
import { color, font, motion, size, space, stroke } from '../styles/tokens.css';

const hair = (c: string) => `${stroke.hair} solid ${c}`;

/**
 * 限定在 `scope` 之内的全局样式。选择器可以是逗号分隔的列表，每一项都加上作用域：
 * 直接写成 `${scope} h3, h4` 时只有第一项受限，其余各项会作用到全站。
 */
const within = (scope: string) => (sel: string, rule: Parameters<typeof globalStyle>[1]) =>
  globalStyle(
    sel
      .split(',')
      .map((s) => `${scope} ${s.trim()}`)
      .join(', '),
    rule,
  );

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

const p = within(preview);
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
/* 提示词里的表格是盘面数据（「廉贞(利), 天府(庙)」），中文只在空格与标点处换行，星曜名不被拆开。 */
p('td', { padding: '4px 8px 4px 0', borderBottom: hair(color.line), verticalAlign: 'top', wordBreak: 'keep-all' });
/* 单元格至少约五个字宽：「103-112」这类区间不被拆开；各列加起来放不下时表格横向滚动。 */
p('th, td', { minWidth: '5em' });

/* ── 对话的回答（设计规范 19.4）：同预览的规则，正文 15px 行高 1.8，表格 14px、表头 12px ── */

export const chat = style({ fontSize: size.body, lineHeight: 1.8, color: color.fg });

const c = within(chat);
c('p', { margin: '0 0 .75em' });
c('ul, ol', { margin: '0 0 .75em' });
c(`${tableWrap}`, { margin: '.4em 0 .9em' });
c('table', { fontSize: size.small });
c('th', { fontSize: size.label });

/* ── 提示词全文（设计规范 21.6）：同预览的规则，正文 15px 行高 1.85，最宽 780px，表格 14px，分隔线 1px `--line-2` ── */

export const full = style({ maxWidth: 780, fontSize: size.body, lineHeight: 1.85, color: color.fg });

const f = within(full);
f('table', { fontSize: size.small });
f('hr', { borderTop: hair(color.line2), margin: '28px 0' });

/* ── 内容页正文（设计规范第 14 节） ── */

export const prose = style({
  fontSize: size.prose,
  lineHeight: 1.85,
  color: color.fg,
});

const r = within(prose);
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
r('th, td', { minWidth: '5em' });

/* 手机上表格保持行列：单元格照常换行，放不下时表格在外层容器里横向滚动，页面本身不横向溢出。 */
r('td code', { '@media': { [media.s]: { whiteSpace: 'normal', wordBreak: 'break-all' } } });
