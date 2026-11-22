import { describe, expect, it } from 'vitest';
import { DECADE_COUNT, NO_TYPING, decadeOf, typeYearDigit, yearsOfDecade } from './year-typing';

function typeAll(digits: string, start = 1000, step = 100) {
  let state = NO_TYPING;
  let last = { state, page: null as number | null, focus: null as number | null };
  [...digits].forEach((d, i) => {
    last = typeYearDigit(state, d, start + i * step);
    state = last.state;
  });
  return last;
}

describe('年份弹层的直接键入', () => {
  it('第 3 位跳到年代，第 4 位落到年份', () => {
    expect(typeAll('198')).toMatchObject({ page: decadeOf(1980), focus: null });
    expect(typeAll('1987')).toMatchObject({ page: decadeOf(1980), focus: 1987 });
  });

  it('超出范围的年代与年份不跳', () => {
    expect(typeAll('185')).toMatchObject({ page: null, focus: null });
    expect(typeAll('2105')).toMatchObject({ page: DECADE_COUNT - 1, focus: null });
    expect(typeAll('2100')).toMatchObject({ page: DECADE_COUNT - 1, focus: 2100 });
  });

  it('停顿超过 1.5 秒或已满 4 位后重新开始', () => {
    const first = typeYearDigit(NO_TYPING, '1', 0);
    expect(typeYearDigit(first.state, '9', 1600).state.typed).toBe('9');
    const full = typeAll('1987');
    expect(typeYearDigit(full.state, '2', full.state.at + 10).state.typed).toBe('2');
  });

  it('最后一个年代只有 2100 一年', () => {
    expect(yearsOfDecade(DECADE_COUNT - 1)).toEqual([2100]);
    expect(yearsOfDecade(0)).toHaveLength(10);
  });
});
