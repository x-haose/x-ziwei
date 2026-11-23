import { YEAR_MAX, YEAR_MIN } from './calendar';

/** 年份弹层里直接键入的数字：已键入的位与最后一次按键的时间（毫秒）。 */
export interface YearTyping {
  typed: string;
  at: number;
}

export const NO_TYPING: YearTyping = { typed: '', at: 0 };

/** 两次按键相隔超过这个时长（毫秒），重新开始键入。 */
const RESET_MS = 1500;

/** 年代总览的页数：1900–1909 到 2100 共 21 个年代。 */
export const DECADE_COUNT = Math.floor((YEAR_MAX - YEAR_MIN) / 10) + 1;

/** 某年所在年代的页码（0 起）；年份不在可排范围内时为 null。 */
export function decadeOf(year: number): number | null {
  if (year < YEAR_MIN || year > YEAR_MAX) return null;
  return Math.floor((year - YEAR_MIN) / 10);
}

/** 第 `page` 页（年代）里的年份，超出上限的不列。 */
export function yearsOfDecade(page: number): number[] {
  const first = YEAR_MIN + page * 10;
  return Array.from({ length: 10 }, (_, k) => first + k).filter((y) => y <= YEAR_MAX);
}

/**
 * 键入一位数字。键入到第 3 位时跳到该年代（年代在范围内才跳），第 4 位时把焦点落到该年
 * （年份在范围内才落）。已满 4 位或停顿过久后再键入，从头开始。
 */
export function typeYearDigit(
  state: YearTyping,
  digit: string,
  now: number,
): { state: YearTyping; page: number | null; focus: number | null } {
  if (!/^\d$/.test(digit)) throw new Error(`只接受一位数字：${digit}`);
  const restart = now - state.at > RESET_MS || state.typed.length >= 4;
  const typed = (restart ? '' : state.typed) + digit;
  const page = typed.length >= 3 ? decadeOf(Number(typed.slice(0, 3)) * 10) : null;
  const year = Number(typed);
  const focus = typed.length === 4 && year >= YEAR_MIN && year <= YEAR_MAX ? year : null;
  return { state: { typed, at: now }, page, focus };
}
