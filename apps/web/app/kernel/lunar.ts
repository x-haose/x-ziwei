import type { LunarCalendar, LunarDate, LunarMonth, SolarDate } from '../birth/calendar';
import type { Kernel } from './kernel';

/**
 * 由排盘内核的历法查询（`calendar`）实现的农历能力。本仓库不做农历换算，结果与排盘用的历法同一份。
 * 某年的月份表在内核里是纯计算，这里按年缓存，同一年每次拿到同一个数组。
 */
export function createLunarCalendar(kernel: Kernel): LunarCalendar {
  const monthsByYear = new Map<number, readonly LunarMonth[]>();

  const months = (year: number): readonly LunarMonth[] => {
    const cached = monthsByYear.get(year);
    if (cached) return cached;
    const list = kernel.calendar.lunarMonths(year).map((m): LunarMonth => {
      const days = m.dayCount;
      if (days !== 29 && days !== 30) throw new Error(`内核给出的农历 ${year} 年 ${m.month} 月天数不对：${days}`);
      return { month: m.month, leap: m.isLeap, days };
    });
    monthsByYear.set(year, list);
    return list;
  };

  const zh = (key: string): string => {
    const text = kernel.i18n.translate(key, 'zh-CN');
    if (!text) throw new Error(`内核没有 ${key} 的中文`);
    return text;
  };

  return {
    months,
    toLunar({ year, month, day }: SolarDate): LunarDate {
      const d = kernel.calendar.solarToLunar(year, month, day);
      return { year: d.lunarYear, month: d.lunarMonth, leap: d.isLeap, day: d.lunarDay };
    },
    toSolar({ year, month, leap, day }: LunarDate): SolarDate | null {
      const m = months(year).find((x) => x.month === month && x.leap === leap);
      if (!m || day < 1 || day > m.days) return null;
      const s = kernel.calendar.lunarToSolar(year, month, day, { isLeap: leap });
      return { year: s.solarYear, month: s.solarMonth, day: s.solarDay };
    },
    yearGanzhi(year: number): string {
      const [stem, branch] = kernel.calendar.lunarYearPillar(year);
      return `${zh(stem)}${zh(branch)}`;
    },
  };
}
