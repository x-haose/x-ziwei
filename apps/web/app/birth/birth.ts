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
 * 只知道大概时间时的四个时段：钟点范围与排出的三张候选盘各用哪个时辰（时辰序号）。
 * 夜里的「子」取早子（序号 0），与当天日期一致。
 */
export const PERIODS = {
  night: { range: '23:00–04:59', hours: [0, 1, 2] },
  morning: { range: '05:00–10:59', hours: [3, 4, 5] },
  afternoon: { range: '11:00–16:59', hours: [6, 7, 8] },
  evening: { range: '17:00–22:59', hours: [9, 10, 11] },
} as const;

export type Period = keyof typeof PERIODS;

export const PERIOD_KEYS = Object.keys(PERIODS) as Period[];

export type BirthTime = { kind: 'hour'; index: number } | { kind: 'period'; period: Period };

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
  | { code: 'solarDays'; year: number; month: number; days: number }
  | { code: 'lunarDays'; year: number; month: number; leap: boolean; days: number; day: number }
  | { code: 'noLeapMonth'; year: number; month: number }
  | { code: 'lunarUnavailable' };

export type BirthErrors = Partial<Record<BirthField, BirthError>>;

/**
 * 校验填写中的生辰。全部合法时返回生辰；否则返回各字段的错误（每个字段至多一条）。
 * 农历的月份与天数要查 `lunar`；没有农历能力时农历生辰一律报 `lunarUnavailable`。
 */
export function validateBirth(draft: BirthDraft, lunar: LunarCalendar | null): { birth: Birth } | { errors: BirthErrors } {
  const errors: BirthErrors = {};
  const { cal, year, month, day, leap, time, gender } = draft;
  if (year === null) errors.year = { code: 'required' };
  if (month === null) errors.month = { code: 'required' };
  if (day === null) errors.day = { code: 'required' };
  if (time === null) errors.time = { code: 'required' };
  if (gender === null) errors.gender = { code: 'required' };
  if (cal === 'lunar' && !lunar) errors.month = { code: 'lunarUnavailable' };
  if (year !== null && month !== null && day !== null) {
    if (cal === 'solar') {
      const days = solarDaysInMonth(year, month);
      if (day > days) errors.day = { code: 'solarDays', year, month, days };
    } else if (lunar) {
      const m = lunar.months(year).find((x) => x.month === month && x.leap === leap);
      if (!m) errors.month = { code: 'noLeapMonth', year, month };
      else if (day > m.days) errors.day = { code: 'lunarDays', year, month, leap, days: m.days, day };
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
 * 生辰写进地址 `#` 之后的部分（不发给服务器）：`cal=solar&d=2000-8-16&t=2&g=f`。
 * 农历闰月加 `leap=1`；只知道大概时间时用 `p=<时段>` 代替 `t`。
 */
export function encodeBirth(birth: Birth): string {
  const q = new URLSearchParams();
  q.set('cal', birth.cal);
  q.set('d', `${birth.year}-${birth.month}-${birth.day}`);
  if (birth.leap) q.set('leap', '1');
  if (birth.time.kind === 'hour') q.set('t', String(birth.time.index));
  else q.set('p', birth.time.period);
  q.set('g', birth.gender);
  return q.toString();
}

export type DecodedBirth =
  | { kind: 'none' }
  | { kind: 'ok'; birth: Birth }
  /** 地址里有生辰但不完整或不合法：要明确告诉用户，不能当作没有。 */
  | { kind: 'invalid' }
  /** 地址里是农历生辰，而当前没有农历能力。 */
  | { kind: 'unsupported' };

const INT = /^\d+$/;

function isPeriod(value: string): value is Period {
  return Object.hasOwn(PERIODS, value);
}

/** 解析地址 `#` 之后的生辰（可带或不带开头的 `#`）。空串表示地址里没有生辰。 */
export function decodeBirth(hash: string, lunar: LunarCalendar | null): DecodedBirth {
  const raw = hash.replace(/^#/, '');
  if (raw === '') return { kind: 'none' };
  const q = new URLSearchParams(raw);
  const cal = q.get('cal');
  const parts = (q.get('d') ?? '').split('-');
  const t = q.get('t');
  const p = q.get('p');
  const g = q.get('g');
  const leap = q.get('leap');
  if (cal !== 'solar' && cal !== 'lunar') return { kind: 'invalid' };
  if (parts.length !== 3 || !parts.every((x) => INT.test(x))) return { kind: 'invalid' };
  const [year, month, day] = parts.map(Number) as [number, number, number];
  if (year < YEAR_MIN || year > YEAR_MAX || month < 1 || month > 12 || day < 1 || day > 31) return { kind: 'invalid' };
  if (leap !== null && (leap !== '1' || cal !== 'lunar')) return { kind: 'invalid' };
  if (g !== 'f' && g !== 'm') return { kind: 'invalid' };
  let time: BirthTime;
  if (t !== null && p === null && INT.test(t) && Number(t) <= 12) time = { kind: 'hour', index: Number(t) };
  else if (p !== null && t === null && isPeriod(p)) time = { kind: 'period', period: p };
  else return { kind: 'invalid' };
  if (cal === 'lunar' && !lunar) return { kind: 'unsupported' };
  const result = validateBirth({ cal, year, month, day, leap: leap === '1', time, gender: g }, lunar);
  return 'birth' in result ? { kind: 'ok', birth: result.birth } : { kind: 'invalid' };
}
