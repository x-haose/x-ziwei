import { type LunarCalendar, YEAR_MAX, YEAR_MIN, solarDaysInMonth } from './calendar';

export type CalendarKind = 'solar' | 'lunar';
export type Gender = 'f' | 'm';

/**
 * 时辰序号 0–12：0 早子（00:00–00:59），1 丑 …… 11 亥，12 晚子（23:00–23:59）。
 * 每档的钟点范围（起、止），用于选择器与摘要。
 */
export const HOUR_RANGES: readonly (readonly [string, string])[] = [
  ['00:00', '00:59'],
  ['01:00', '02:59'],
  ['03:00', '04:59'],
  ['05:00', '06:59'],
  ['07:00', '08:59'],
  ['09:00', '10:59'],
  ['11:00', '12:59'],
  ['13:00', '14:59'],
  ['15:00', '16:59'],
  ['17:00', '18:59'],
  ['19:00', '20:59'],
  ['21:00', '22:59'],
  ['23:00', '23:59'],
];

/**
 * 只知道大概时间时的四个时段：钟点范围、排出候选盘的时辰（时辰序号）与缺省先看的那一张。
 * 钟点都落在所填的出生日期当天：「夜里」是这一天的 00:00–04:59 与 23:00–23:59，
 * 候选为当天的早子、丑、寅与晚子四张。
 */
export const PERIODS = {
  night: { range: '00:00–04:59、23:00–23:59', hours: [0, 1, 2, 12], preferred: 1 },
  morning: { range: '05:00–10:59', hours: [3, 4, 5], preferred: 4 },
  afternoon: { range: '11:00–16:59', hours: [6, 7, 8], preferred: 7 },
  evening: { range: '17:00–22:59', hours: [9, 10, 11], preferred: 10 },
} as const satisfies Record<string, { range: string; hours: readonly number[]; preferred: number }>;

export type Period = keyof typeof PERIODS;

export const PERIOD_KEYS = Object.keys(PERIODS) as Period[];

/**
 * 时辰：确定的时辰序号，或只知道的大概时段加当前看的那一张候选（`pick` 是该时段的候选之一）。
 */
export type BirthTime = { kind: 'hour'; index: number } | { kind: 'period'; period: Period; pick: number };

/** 选了某个大概时段时的时辰：候选取该时段缺省先看的那一张。 */
export function periodTime(period: Period): BirthTime {
  return { kind: 'period', period, pick: PERIODS[period].preferred };
}

/** 一份完整、合法的生辰。日期按 `cal` 所指的历法解释；`leap` 只在农历下可能为真。 */
export interface Birth {
  cal: CalendarKind;
  year: number;
  month: number;
  leap: boolean;
  day: number;
  time: BirthTime;
  gender: Gender;
}

/** 填写中的生辰：未选的项为 null。 */
export interface BirthDraft {
  cal: CalendarKind;
  year: number | null;
  month: number | null;
  leap: boolean;
  day: number | null;
  time: BirthTime | null;
  gender: Gender | null;
}

export const EMPTY_DRAFT: BirthDraft = { cal: 'solar', year: null, month: null, leap: false, day: null, time: null, gender: null };

export type BirthField = 'year' | 'month' | 'day' | 'time' | 'gender';

/** 表单字段的先后，提交时焦点落到第一个出错的字段。 */
export const FIELD_ORDER: readonly BirthField[] = ['year', 'month', 'day', 'time', 'gender'];

/** 校验错误。文案由界面按 `code` 与参数生成；每条都写明怎么改。 */
export type BirthError =
  | { code: 'required' }
  /** 日期超出可排范围（公历 YEAR_MIN–YEAR_MAX 年；农历按换算出的公历日期判断）。 */
  | { code: 'outOfRange' }
  /** 不是有效的取值（只会来自手写的链接）。 */
  | { code: 'invalid' }
  | { code: 'solarDays'; year: number; month: number; days: number }
  | { code: 'lunarDays'; year: number; month: number; leap: boolean; days: number; day: number }
  | { code: 'noLeapMonth'; year: number; month: number }
  | { code: 'lunarUnavailable' };

export type BirthErrors = Partial<Record<BirthField, BirthError>>;

/**
 * 校验填写中的生辰。全部合法时返回生辰；否则返回各字段的错误（每个字段至多一条）。
 *
 * 可排范围只按公历定义一次：公历日期的年份在 YEAR_MIN–YEAR_MAX 之间；农历日期换算成公历后落在同一范围。
 * 农历的月份、天数与换算要查 `lunar`；没有农历能力时农历生辰一律报 `lunarUnavailable`。
 */
export function validateBirth(draft: BirthDraft, lunar: LunarCalendar | null): { birth: Birth } | { errors: BirthErrors } {
  const errors: BirthErrors = {};
  const { cal, year, month, day, leap, time, gender } = draft;
  if (year === null) errors.year = { code: 'required' };
  if (month === null) errors.month = { code: 'required' };
  if (day === null) errors.day = { code: 'required' };
  if (time === null) errors.time = { code: 'required' };
  else if (time.kind === 'hour' ? !(Number.isInteger(time.index) && time.index >= 0 && time.index <= 12) : !(PERIODS[time.period].hours as readonly number[]).includes(time.pick)) {
    errors.time = { code: 'invalid' };
  }
  if (gender === null) errors.gender = { code: 'required' };
  if (month !== null && !(Number.isInteger(month) && month >= 1 && month <= 12)) errors.month = { code: 'invalid' };
  if (day !== null && !(Number.isInteger(day) && day >= 1 && day <= 30 + (cal === 'solar' ? 1 : 0))) errors.day = { code: 'invalid' };
  if (cal === 'lunar' && !lunar) errors.month = { code: 'lunarUnavailable' };
  if (year !== null && month !== null && day !== null && !errors.month && !errors.day) {
    if (cal === 'solar') {
      if (year < YEAR_MIN || year > YEAR_MAX) errors.year = { code: 'outOfRange' };
      else {
        const days = solarDaysInMonth(year, month);
        if (day > days) errors.day = { code: 'solarDays', year, month, days };
      }
    } else if (lunar) {
      // 农历年的月表只对可排范围附近的年份有意义；先用公历范围的前后一年挡住明显越界的年份。
      if (year < YEAR_MIN - 1 || year > YEAR_MAX) errors.year = { code: 'outOfRange' };
      else {
        const m = lunar.months(year).find((x) => x.month === month && x.leap === leap);
        if (!m) errors.month = { code: 'noLeapMonth', year, month };
        else if (day > m.days) errors.day = { code: 'lunarDays', year, month, leap, days: m.days, day };
        else {
          const solar = lunar.toSolar({ year, month, leap, day });
          if (!solar) throw new Error('合法的农历日期换算不出公历日期');
          if (solar.year < YEAR_MIN || solar.year > YEAR_MAX) errors.year = { code: 'outOfRange' };
        }
      }
    }
  }
  if (Object.keys(errors).length > 0 || year === null || month === null || day === null || time === null || gender === null) {
    return { errors };
  }
  return { birth: { cal, year, month, leap: cal === 'lunar' && leap, day, time, gender } };
}

export function draftOf(birth: Birth): BirthDraft {
  return { ...birth };
}

/**
 * 生辰写进地址 `#` 之后的部分（不发给服务器），键的顺序固定：`cal=solar&d=2000-8-16&t=2&g=f`。
 * 农历闰月加 `leap=1`；只知道大概时间时用 `p=<时段>&h=<当前候选>` 代替 `t`。数字不补零。
 */
export function encodeBirth(birth: Birth): string {
  const parts = [`cal=${birth.cal}`, `d=${birth.year}-${birth.month}-${birth.day}`];
  if (birth.leap) parts.push('leap=1');
  if (birth.time.kind === 'hour') parts.push(`t=${birth.time.index}`);
  else parts.push(`p=${birth.time.period}`, `h=${birth.time.pick}`);
  parts.push(`g=${birth.gender}`);
  return parts.join('&');
}

export type DecodedBirth =
  | { kind: 'none' }
  | { kind: 'ok'; birth: Birth }
  /** 地址里有生辰但不完整、不合法或不是规范写法：要明确告诉用户，不能当作没有。 */
  | { kind: 'invalid' }
  /** 地址里是农历生辰，而当前还没有农历能力（排盘内核未装好）。 */
  | { kind: 'unsupported' };

const INT = /^(0|[1-9]\d*)$/;

function isPeriod(value: string): value is Period {
  return Object.hasOwn(PERIODS, value);
}

/**
 * 解析地址 `#` 之后的生辰（可带或不带开头的 `#`）。空串表示地址里没有生辰。
 *
 * 这里只做语法解析，取值是否合法交给 `validateBirth`（与表单同一套规则）；
 * 只收规范写法：解析出的生辰重新编码必须与原文完全相同，重复键、未知键、补零的数字都算不合法。
 */
export function decodeBirth(hash: string, lunar: LunarCalendar | null): DecodedBirth {
  const raw = hash.replace(/^#/, '');
  if (raw === '') return { kind: 'none' };
  const q = new URLSearchParams(raw);
  const cal = q.get('cal');
  const parts = (q.get('d') ?? '').split('-');
  const t = q.get('t');
  const p = q.get('p');
  const h = q.get('h');
  const g = q.get('g');
  if (cal !== 'solar' && cal !== 'lunar') return { kind: 'invalid' };
  if (parts.length !== 3 || !parts.every((x) => INT.test(x))) return { kind: 'invalid' };
  if (g !== 'f' && g !== 'm') return { kind: 'invalid' };
  const [year, month, day] = parts.map(Number) as [number, number, number];
  let time: BirthTime;
  if (t !== null && INT.test(t)) time = { kind: 'hour', index: Number(t) };
  else if (p !== null && isPeriod(p) && h !== null && INT.test(h)) time = { kind: 'period', period: p, pick: Number(h) };
  else return { kind: 'invalid' };
  if (cal === 'lunar' && !lunar) return { kind: 'unsupported' };
  const result = validateBirth({ cal, year, month, day, leap: q.get('leap') === '1', time, gender: g }, lunar);
  if (!('birth' in result) || encodeBirth(result.birth) !== raw) return { kind: 'invalid' };
  return { kind: 'ok', birth: result.birth };
}
