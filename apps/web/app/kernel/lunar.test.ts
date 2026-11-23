import { beforeAll, describe, expect, it } from 'vitest';
import * as kernel from 'x-iztro';
import type { LunarCalendar } from '../birth/calendar';
import { createLunarCalendar } from './lunar';

let cal: LunarCalendar;

beforeAll(async () => {
  await kernel.init();
  cal = createLunarCalendar(kernel);
});

describe('内核提供的农历', () => {
  it('2020 年有闰四月，紧跟在四月之后，月长 29 天', () => {
    const months = cal.months(2020);
    expect(months).toHaveLength(13);
    const i = months.findIndex((m) => m.leap);
    expect(months[i - 1]).toEqual({ month: 4, leap: false, days: 30 });
    expect(months[i]).toEqual({ month: 4, leap: true, days: 29 });
  });

  it('2000 年七月是小月，没有闰月', () => {
    expect(cal.months(2000).find((m) => m.month === 7)).toEqual({ month: 7, leap: false, days: 29 });
    expect(cal.months(2000).some((m) => m.leap)).toBe(false);
  });

  it('公历农历互换', () => {
    expect(cal.toLunar({ year: 2000, month: 8, day: 16 })).toEqual({ year: 2000, month: 7, leap: false, day: 17 });
    expect(cal.toSolar({ year: 2000, month: 7, leap: false, day: 17 })).toEqual({ year: 2000, month: 8, day: 16 });
    const leap = cal.toSolar({ year: 2020, month: 4, leap: true, day: 1 });
    expect(leap).not.toBeNull();
    expect(cal.toLunar(leap!)).toEqual({ year: 2020, month: 4, leap: true, day: 1 });
  });

  it('不存在的闰月与小月三十换不出公历', () => {
    expect(cal.toSolar({ year: 2000, month: 7, leap: true, day: 1 })).toBeNull();
    expect(cal.toSolar({ year: 2000, month: 7, leap: false, day: 30 })).toBeNull();
  });

  it('年份干支', () => {
    expect(cal.yearGanzhi(2000)).toBe('庚辰');
    expect(cal.yearGanzhi(2026)).toBe('丙午');
  });
});
