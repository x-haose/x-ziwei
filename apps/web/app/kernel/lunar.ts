import type { Astrolabe } from 'x-iztro';
import type { LunarCalendar, LunarDate, LunarMonth, SolarDate } from '../birth/calendar';
import type { Kernel } from './kernel';

/**
 * 由排盘内核实现的农历能力。本仓库不做农历换算，全部取自内核：
 * - 某农历年的月份、闰月与月长：内核的流月一览（闰月不拆段时每月一项，项内的日区间即月长）；
 * - 公历转农历：按该日排盘取结构化的农历生日；农历转公历：按农历排盘取阳历日期；
 * - 年份干支：该农历年流年的干支。
 *
 * 流月一览与流年要从一张盘发起，它们只依赖历法、与盘无关，这里固定用一张参照盘
 * （公历 2000-1-1 早子时 女）。各年结果在内核里是纯计算，这里按年缓存。
 */
export function createLunarCalendar(kernel: Kernel): LunarCalendar {
  const reference: Astrolabe = kernel.astro.bySolar('2000-1-1', 0, 'female');
  const monthsByYear = new Map<number, readonly LunarMonth[]>();
  const ganzhiByYear = new Map<number, string>();

  const months = (year: number): readonly LunarMonth[] => {
    const cached = monthsByYear.get(year);
    if (cached) return cached;
    const list = reference.monthlyList(year, false).map((m) => {
      const days = m.dayRange[1];
      if (m.dayRange[0] !== 1 || (days !== 29 && days !== 30)) {
        throw new Error(`内核给出的农历 ${year} 年 ${m.month} 月日区间不是整月：${m.dayRange.join('-')}`);
      }
      return { month: m.month, leap: m.isLeapMonth, days: days as 29 | 30 };
    });
    monthsByYear.set(year, list);
    return list;
  };

  return {
    months,
    toLunar({ year, month, day }: SolarDate): LunarDate {
      const d = kernel.astro.bySolar(`${year}-${month}-${day}`, 0, 'female').rawDates.lunarDate;
      return { year: d.lunarYear, month: d.lunarMonth, leap: d.isLeap, day: d.lunarDay };
    },
    toSolar({ year, month, leap, day }: LunarDate): SolarDate | null {
      const m = months(year).find((x) => x.month === month && x.leap === leap);
      if (!m || day < 1 || day > m.days) return null;
      const solar = kernel.astro.byLunar(`${year}-${month}-${day}`, 0, 'female', { isLeapMonth: leap }).solarDate;
      const [y, mo, d] = solar.split('-').map(Number);
      if (y === undefined || mo === undefined || d === undefined) throw new Error(`内核给出的阳历日期格式不对：${solar}`);
      return { year: y, month: mo, day: d };
    },
    yearGanzhi(year: number): string {
      const cached = ganzhiByYear.get(year);
      if (cached) return cached;
      const y = reference.horoscopeOfYear(year).yearly;
      const text = `${y.heavenlyStem}${y.earthlyBranch}`;
      ganzhiByYear.set(year, text);
      return text;
    },
  };
}
