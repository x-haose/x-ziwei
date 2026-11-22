import { describe, expect, it } from 'vitest';
import { type Birth, type BirthDraft, EMPTY_DRAFT, decodeBirth, encodeBirth, validateBirth } from './birth';
import type { LunarCalendar } from './calendar';

/** 测试用的农历：2020 年有闰四月（29 天），七月是小月；不做真实换算。 */
const lunar: LunarCalendar = {
  months: (year) =>
    year === 2020
      ? [
          { month: 4, leap: false, days: 30 },
          { month: 4, leap: true, days: 29 },
          { month: 7, leap: false, days: 29 },
        ]
      : [{ month: 7, leap: false, days: 29 }],
  toLunar: () => ({ year: 2020, month: 4, leap: true, day: 1 }),
  toSolar: () => ({ year: 2020, month: 5, day: 23 }),
  yearGanzhi: () => '庚子',
};

const birth: Birth = { cal: 'solar', year: 2000, month: 8, leap: false, day: 16, time: { kind: 'hour', index: 2 }, gender: 'f' };
const draft = (patch: Partial<BirthDraft>): BirthDraft => ({ ...birth, ...patch });

describe('validateBirth', () => {
  it('空表单每个字段都报必填', () => {
    const r = validateBirth(EMPTY_DRAFT, null);
    expect('errors' in r && Object.keys(r.errors).sort()).toEqual(['day', 'gender', 'month', 'time', 'year']);
  });

  it('公历日超出当月天数', () => {
    expect(validateBirth(draft({ year: 2001, month: 2, day: 29 }), null)).toEqual({
      errors: { day: { code: 'solarDays', year: 2001, month: 2, days: 28 } },
    });
    expect(validateBirth(draft({ year: 2000, month: 2, day: 29 }), null)).toHaveProperty('birth');
  });

  it('农历：小月没有三十，不存在的闰月报在月份上', () => {
    expect(validateBirth(draft({ cal: 'lunar', year: 2000, month: 7, day: 30 }), lunar)).toEqual({
      errors: { day: { code: 'lunarDays', year: 2000, month: 7, leap: false, days: 29, day: 30 } },
    });
    expect(validateBirth(draft({ cal: 'lunar', year: 2000, month: 7, leap: true, day: 1 }), lunar)).toEqual({
      errors: { month: { code: 'noLeapMonth', year: 2000, month: 7 } },
    });
    expect(validateBirth(draft({ cal: 'lunar', year: 2020, month: 4, leap: true, day: 29 }), lunar)).toHaveProperty('birth.leap', true);
  });

  it('没有农历能力时农历生辰不通过', () => {
    expect(validateBirth(draft({ cal: 'lunar' }), null)).toEqual({ errors: { month: { code: 'lunarUnavailable' } } });
  });
});

describe('生辰写进地址', () => {
  it('公历与大概时段往返不变', () => {
    expect(encodeBirth(birth)).toBe('cal=solar&d=2000-8-16&t=2&g=f');
    expect(decodeBirth(`#${encodeBirth(birth)}`, null)).toEqual({ kind: 'ok', birth });
    const approx: Birth = { ...birth, time: { kind: 'period', period: 'night' } };
    expect(encodeBirth(approx)).toBe('cal=solar&d=2000-8-16&p=night&g=f');
    expect(decodeBirth(encodeBirth(approx), null)).toEqual({ kind: 'ok', birth: approx });
  });

  it('农历闰月带 leap=1', () => {
    const b: Birth = { ...birth, cal: 'lunar', year: 2020, month: 4, leap: true, day: 3 };
    expect(encodeBirth(b)).toBe('cal=lunar&d=2020-4-3&leap=1&t=2&g=f');
    expect(decodeBirth(encodeBirth(b), lunar)).toEqual({ kind: 'ok', birth: b });
    expect(decodeBirth(encodeBirth(b), null)).toEqual({ kind: 'unsupported' });
  });

  it('空串表示没有生辰', () => {
    expect(decodeBirth('', null)).toEqual({ kind: 'none' });
    expect(decodeBirth('#', null)).toEqual({ kind: 'none' });
  });

  it.each([
    'cal=solar&d=2000-8&t=2&g=f',
    'cal=solar&d=2000-2-30&t=2&g=f',
    'cal=solar&d=1899-1-1&t=2&g=f',
    'cal=solar&d=2000-8-16&t=13&g=f',
    'cal=solar&d=2000-8-16&t=2&p=night&g=f',
    'cal=solar&d=2000-8-16&p=toString&g=f',
    'cal=solar&d=2000-8-16&t=2&g=x',
    'cal=solar&d=2000-8-16&leap=1&t=2&g=f',
    'cal=moon&d=2000-8-16&t=2&g=f',
    'cal=solar&d=2000-8-1e1&t=2&g=f',
  ])('不完整或不合法：%s', (hash) => {
    expect(decodeBirth(hash, lunar)).toEqual({ kind: 'invalid' });
  });
});
