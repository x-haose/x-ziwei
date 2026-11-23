import { describe, expect, it } from 'vitest';
import { type Birth, type BirthDraft, EMPTY_DRAFT, PERIODS, decodeBirth, encodeBirth, periodTime, validateBirth } from './birth';
import type { LunarCalendar } from './calendar';
import { parseRecent, withEntry } from './recent';

/**
 * 测试用的农历：2020 年有闰四月（29 天），七月是小月；2100 年腊月换算到公历 2101 年。
 * 只为驱动校验规则，不是真实换算（真实换算的测试见 kernel/lunar.test.ts）。
 */
const lunar: LunarCalendar = {
  months: (year) =>
    year === 2020
      ? [
          { month: 4, leap: false, days: 30 },
          { month: 4, leap: true, days: 29 },
          { month: 7, leap: false, days: 29 },
        ]
      : [
          { month: 7, leap: false, days: 29 },
          { month: 12, leap: false, days: 30 },
        ],
  toLunar: () => ({ year: 2020, month: 4, leap: true, day: 1 }),
  toSolar: ({ year, month }) => (year === 2100 && month === 12 ? { year: 2101, month: 1, day: 20 } : { year, month: 5, day: 23 }),
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

  it('可排范围只按公历定义一次：公历年份越界，农历换算出的公历越界，都报超出范围', () => {
    expect(validateBirth(draft({ year: 2101 }), null)).toEqual({ errors: { year: { code: 'outOfRange' } } });
    expect(validateBirth(draft({ year: 1899 }), null)).toEqual({ errors: { year: { code: 'outOfRange' } } });
    expect(validateBirth(draft({ cal: 'lunar', year: 2100, month: 12, day: 1 }), lunar)).toEqual({ errors: { year: { code: 'outOfRange' } } });
    expect(validateBirth(draft({ cal: 'lunar', year: 2100, month: 7, day: 1 }), lunar)).toHaveProperty('birth');
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

  it('大概时段的候选必须属于该时段', () => {
    expect(validateBirth(draft({ time: { kind: 'period', period: 'morning', pick: 1 } }), null)).toEqual({ errors: { time: { code: 'invalid' } } });
    expect(validateBirth(draft({ time: periodTime('morning') }), null)).toHaveProperty('birth');
  });
});

describe('大概时段', () => {
  it('夜里的候选是所填日期当天的早子、丑、寅与晚子', () => {
    expect(PERIODS.night.hours).toEqual([0, 1, 2, 12]);
  });

  it('缺省先看的候选都在该时段的候选里', () => {
    for (const p of Object.values(PERIODS)) expect(p.hours as readonly number[]).toContain(p.preferred);
  });
});

describe('生辰写进地址', () => {
  it('公历与大概时段往返不变，候选写进 h', () => {
    expect(encodeBirth(birth)).toBe('cal=solar&d=2000-8-16&t=2&g=f');
    expect(decodeBirth(`#${encodeBirth(birth)}`, null)).toEqual({ kind: 'ok', birth });
    const approx: Birth = { ...birth, time: { kind: 'period', period: 'night', pick: 12 } };
    expect(encodeBirth(approx)).toBe('cal=solar&d=2000-8-16&p=night&h=12&g=f');
    expect(decodeBirth(encodeBirth(approx), null)).toEqual({ kind: 'ok', birth: approx });
  });

  it('农历闰月带 leap=1；没有农历能力时是 unsupported', () => {
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
    'cal=solar&d=2101-1-1&t=2&g=f',
    'cal=solar&d=2000-8-16&t=13&g=f',
    'cal=solar&d=2000-8-16&t=2&p=night&h=1&g=f',
    'cal=solar&d=2000-8-16&p=night&g=f',
    'cal=solar&d=2000-8-16&p=night&h=5&g=f',
    'cal=solar&d=2000-8-16&p=toString&h=1&g=f',
    'cal=solar&d=2000-8-16&t=2&g=x',
    'cal=solar&d=2000-8-16&leap=1&t=2&g=f',
    'cal=moon&d=2000-8-16&t=2&g=f',
    'cal=solar&d=2000-8-1e1&t=2&g=f',
    'cal=solar&d=2000-08-016&t=2&g=f',
    'cal=solar&d=2000-8-16&t=02&g=f',
    'cal=solar&d=2000-8-16&t=2&t=3&g=f',
    'cal=solar&d=2000-8-16&t=2&g=f&x=1',
    'd=2000-8-16&cal=solar&t=2&g=f',
  ])('不完整、不合法或不是规范写法：%s', (hash) => {
    expect(decodeBirth(hash, lunar)).toEqual({ kind: 'invalid' });
  });
});

describe('最近排过', () => {
  const lunarHash = 'cal=lunar&d=2020-4-3&leap=1&t=2&g=f';
  const raw = JSON.stringify([
    { hash: lunarHash, ts: 1 },
    { hash: 'cal=solar&d=1987-2-3&t=12&g=m', ts: 2 },
    { hash: 'cal=solar&d=2000-8-16&p=night&g=f', ts: 3 },
  ]);

  it('内核没装好时农历条目暂时解不出来，但整份记录照样可读，写入时不丢', () => {
    const state = parseRecent(raw, null);
    expect(state.kind).toBe('ok');
    if (state.kind !== 'ok') return;
    expect(state.items.map((i) => i.decoded.kind)).toEqual(['unsupported', 'ok', 'invalid']);
    const next = withEntry(state, encodeBirth(birth), 9);
    expect(next.map((i) => i.hash)).toEqual([encodeBirth(birth), lunarHash, 'cal=solar&d=1987-2-3&t=12&g=m', 'cal=solar&d=2000-8-16&p=night&g=f']);
  });

  it('同一生辰再排一次移到最前，最多留 6 条', () => {
    const many = JSON.stringify(Array.from({ length: 6 }, (_, k) => ({ hash: `cal=solar&d=2000-8-${k + 1}&t=2&g=f`, ts: k })));
    const state = parseRecent(many, null);
    const next = withEntry(state, 'cal=solar&d=2000-8-3&t=2&g=f', 99);
    expect(next).toHaveLength(6);
    expect(next[0]).toEqual({ hash: 'cal=solar&d=2000-8-3&t=2&g=f', ts: 99 });
    expect(withEntry(state, 'cal=solar&d=2000-9-1&t=2&g=f', 99).map((i) => i.hash)).not.toContain('cal=solar&d=2000-8-6&t=2&g=f');
  });

  it('只有存储格式真坏才算损坏', () => {
    expect(parseRecent('{', null)).toEqual({ kind: 'corrupt' });
    expect(parseRecent('{}', null)).toEqual({ kind: 'corrupt' });
    expect(parseRecent(JSON.stringify([{ hash: 1, ts: 1 }]), null)).toEqual({ kind: 'corrupt' });
    expect(parseRecent(JSON.stringify([{ hash: 'x', ts: null }]), null)).toEqual({ kind: 'corrupt' });
  });
});
