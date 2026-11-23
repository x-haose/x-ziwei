import * as css from './icons.css';

/**
 * 自绘图标。线宽 1px、端点平直，与正文笔画和盘面细线一致；颜色取 `currentColor`，
 * 只有字标里那颗星取强调色。图标都是装饰，文字或无障碍标签由使用处提供。
 */

/** 字标：外框是盘，内框是中宫，两条线从一颗星连出，取自三方四正的连线。 */
export function Glyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x=".5" y=".5" width="23" height="23" fill="none" stroke="currentColor" />
      <rect x="6.5" y="6.5" width="11" height="11" fill="none" stroke="currentColor" opacity=".55" />
      <path d="M9.25 6.5 17.5 14.75M9.25 6.5 6.5 17.5" stroke="currentColor" opacity=".55" />
      <circle className={css.accentFill} cx="9.25" cy="6.5" r="2" />
    </svg>
  );
}

/** 主题：半实心＝跟随系统。 */
export function ThemeSystemIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r="7.5" fill="none" stroke="currentColor" />
      <path d="M9 1.5a7.5 7.5 0 0 1 0 15z" fill="currentColor" />
    </svg>
  );
}

/** 主题：空心＝浅色。 */
export function ThemeLightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r="7.5" fill="none" stroke="currentColor" />
    </svg>
  );
}

/** 主题：实心＝深色。 */
export function ThemeDarkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r="7.5" fill="currentColor" stroke="currentColor" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2.5 7.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" />
    </svg>
  );
}

/** 下箭头：选择器触发钮、展开条；展开时由样式转 180°。 */
export function CaretIcon() {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
      <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" />
    </svg>
  );
}

/** 翻页箭头：`dir` 为 -1 朝左（上一页），1 朝右（下一页）。 */
export function PageIcon({ dir }: { dir: -1 | 1 }) {
  return (
    <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden="true">
      <path d={dir < 0 ? 'M6.5 1 1.5 6l5 5' : 'M1.5 1l5 5-5 5'} fill="none" stroke="currentColor" />
    </svg>
  );
}

/** 搜索图标：一圈加一道斜柄，线宽 1px。 */
export function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="currentColor" />
      <path d="M11.5 11.5 16 16" stroke="currentColor" />
    </svg>
  );
}

/** 方向箭头：知识包叠加里前移、后移（横排左右、纵排上下）。 */
export function ChevronIcon({ dir }: { dir: 'left' | 'right' | 'up' | 'down' }) {
  const d = { left: 'M8 2 4 6l4 4', right: 'M4 2l4 4-4 4', up: 'M2 8l4-4 4 4', down: 'M2 4l4 4 4-4' }[dir];
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" />
    </svg>
  );
}

/** 文件线稿：知识包导入的放置区。 */
export function FileIcon() {
  return (
    <svg width="28" height="34" viewBox="0 0 28 34" aria-hidden="true">
      <path d="M1.5 1.5h17l8 8v23h-25z" fill="none" stroke="currentColor" />
      <path d="M18.5 1.5v8h8M7 17h14M7 21.5h14M7 26h9" fill="none" stroke="currentColor" />
    </svg>
  );
}

/** 锁形线稿：「只存在这台设备」的说明。 */
export function LockIcon() {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true">
      <rect x="1.5" y="7" width="11" height="8" fill="none" stroke="currentColor" />
      <path d="M4 7V4.5a3 3 0 0 1 6 0V7" fill="none" stroke="currentColor" />
    </svg>
  );
}
