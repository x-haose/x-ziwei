import { type Messages, fmt } from '../i18n/messages';
import { type Birth, type BirthError, HOUR_RANGES, PERIODS, type Period } from './birth';
import { YEAR_MAX, YEAR_MIN } from './calendar';

/** 时辰名（「寅时」）。 */
export function hourName(t: Messages, index: number): string {
  const name = t.hours[index];
  if (name === undefined) throw new Error(`时辰序号越界：${index}`);
  return fmt(t.picker.hourSuffix, { name });
}

/** 时辰的钟点范围（「03:00–04:59」）。 */
export function hourRange(index: number): string {
  const r = HOUR_RANGES[index];
  if (!r) throw new Error(`时辰序号越界：${index}`);
  return `${r[0]}–${r[1]}`;
}

export function periodName(t: Messages, period: Period): string {
  return t.periods[period];
}

/** 农历月名（「七月」「闰四月」）。 */
export function lunarMonthName(t: Messages, month: number, leap: boolean): string {
  const name = t.lunarMonths[month - 1];
  if (name === undefined) throw new Error(`农历月序越界：${month}`);
  return (leap ? t.lunarLeap : '') + name;
}

/** 农历日名（「十七」「初一」）。 */
export function lunarDayName(t: Messages, day: number): string {
  const name = t.lunarDays[day - 1];
  if (name === undefined) throw new Error(`农历日序越界：${day}`);
  return name;
}

/** 农历年份逐位写（「二〇〇〇」）。 */
export function lunarYearName(t: Messages, year: number): string {
  return [...String(year)].map((d) => t.lunarYearDigits[Number(d)]).join('');
}

export function solarDateText(t: Messages, year: number, month: number, day: number): string {
  return fmt(t.form.solarDate, { y: year, m: month, d: day });
}

export function lunarDateText(t: Messages, year: number, month: number, leap: boolean, day: number): string {
  return fmt(t.form.lunarDate, {
    y: lunarYearName(t, year),
    month: lunarMonthName(t, month, leap),
    day: lunarDayName(t, day),
  });
}

/** 一份生辰的三段文字：日期、时辰（或大概时段）、性别。 */
export function birthSummary(t: Messages, birth: Birth): { date: string; time: string; gender: string } {
  const date =
    birth.cal === 'solar'
      ? solarDateText(t, birth.year, birth.month, birth.day)
      : `${t.form.lunar}${lunarDateText(t, birth.year, birth.month, birth.leap, birth.day)}`;
  const time =
    birth.time.kind === 'hour'
      ? hourName(t, birth.time.index)
      : fmt(t.form.periodSummary, { period: periodName(t, birth.time.period) });
  return { date, time, gender: birth.gender === 'f' ? t.form.female : t.form.male };
}

/** 校验错误的文案。 */
export function errorText(t: Messages, err: BirthError, field: 'year' | 'month' | 'day' | 'time' | 'gender'): string {
  switch (err.code) {
    case 'required':
      return { year: t.form.errYear, month: t.form.errMonth, day: t.form.errDay, time: t.form.errHour, gender: t.form.errGender }[field];
    case 'solarDays':
      return fmt(t.form.errSolarDays, { y: err.year, m: err.month, n: err.days });
    case 'lunarDays':
      return fmt(t.form.errLunarDays, {
        y: lunarYearName(t, err.year),
        month: lunarMonthName(t, err.month, err.leap),
        n: err.days,
        day: lunarDayName(t, err.day),
      });
    case 'noLeapMonth':
      return fmt(t.form.errLunarLeap, { y: lunarYearName(t, err.year), month: lunarMonthName(t, err.month, false) });
    case 'lunarUnavailable':
      return t.form.lunarUnavailable;
    case 'outOfRange':
      return fmt(t.form.errOutOfRange, { a: YEAR_MIN, b: YEAR_MAX });
    case 'invalid':
      return t.form.errInvalid;
  }
}

/** 某个大概时段的全部候选时辰，各带钟点（「早子（00:00–00:59）、丑（01:00–02:59）……」）。 */
export function candidatesText(t: Messages, period: Period): string {
  return PERIODS[period].hours.map((h) => fmt(t.form.candidate, { name: t.hours[h]!, range: hourRange(h) })).join(t.form.listSep);
}
