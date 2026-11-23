/**
 * 生辰表单用到的历法能力。
 *
 * 公历部分是格里历的日期算术，在这里直接算。农历（每年有哪些月、闰月、每月天数，
 * 以及与公历互换）由排盘内核提供，本仓库不写农历换算；没有内核时 `LunarCalendar` 为空，
 * 表单里的农历选项不可用。
 */

/**
 * 网页可排的公历年份范围（含两端）。排盘内核支持公历 1–9999 年，网页限在这个范围，年份选择器也按它分页；
 * 农历日期按换算出的公历日期判断是否在范围内（见 `validateBirth`）。
 */
export const YEAR_MIN = 1900;
export const YEAR_MAX = 2100;

/** 公历某年某月的天数。 */
export function solarDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 公历某年某月 1 日是星期几，周一为 0、周日为 6（月历按周一起排）。 */
export function solarFirstWeekday(year: number, month: number): number {
  return (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
}

/** 农历的一个月：月序 1–12，是否闰月，天数（29 或 30）。 */
export interface LunarMonth {
  month: number;
  leap: boolean;
  days: 29 | 30;
}

export interface LunarDate {
  year: number;
  month: number;
  leap: boolean;
  day: number;
}

export interface SolarDate {
  year: number;
  month: number;
  day: number;
}

/** 排盘内核提供的农历能力。年份是农历年（正月初一起算）。 */
export interface LunarCalendar {
  /** 该农历年的全部月份，按先后排列，闰月紧跟在同序的本月之后。 */
  months(year: number): readonly LunarMonth[];
  /** 公历日期对应的农历日期。 */
  toLunar(date: SolarDate): LunarDate;
  /** 农历日期对应的公历日期；该年没有这个月（如不存在的闰月）或这个月没有这一天时返回 null。 */
  toSolar(date: LunarDate): SolarDate | null;
  /** 该农历年的干支（「庚辰」），写在年份选项下方。 */
  yearGanzhi(year: number): string;
}
