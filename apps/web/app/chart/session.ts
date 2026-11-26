import { useMemo, useState } from 'react';
import type { Astrolabe, Horoscope } from 'x-iztro';
import type { Birth } from '../birth/birth';
import type { LunarCalendar } from '../birth/calendar';
import type { Kernel } from '../kernel/kernel';
import {
  type LayerKind,
  type LayerSelection,
  type MonthKey,
  decadalOfAge,
  huaTexts,
  nominalAge,
  palaceViews,
  selectedLayer,
  surround,
  yearRange,
} from './model';

/** 今天的农历年月日，在浏览器里按本地日期求得（不进预渲染）。 */
export interface Today {
  year: number;
  month: number;
  leap: boolean;
  day: number;
}

export function todayOf(lunar: LunarCalendar, now: Date): Today {
  return lunar.toLunar({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });
}

/** 闰月按日拆段（初一至十五为前段），其余月份整月一段。 */
export function monthKeyOf(month: number, leap: boolean, day: number): MonthKey {
  return { month, part: leap ? (day <= 15 ? 'first' : 'second') : 'normal' };
}

/** 排盘用的时辰：确定时辰直接用；只知道大概时段时用当前看的那一张候选。 */
export function chartHour(birth: Birth): number {
  return birth.time.kind === 'hour' ? birth.time.index : birth.time.pick;
}

/** 按生辰排盘。日期已经过校验，内核拒绝即是代码缺陷，照样抛出。 */
export function castChart(kernel: Kernel, birth: Birth, hour: number): Astrolabe {
  const date = `${birth.year}-${birth.month}-${birth.day}`;
  const gender = birth.gender === 'f' ? 'female' : 'male';
  return birth.cal === 'solar'
    ? kernel.astro.bySolar(date, hour as Parameters<Kernel['astro']['bySolar']>[1], gender)
    : kernel.astro.byLunar(date, hour as Parameters<Kernel['astro']['byLunar']>[1], gender, { isLeapMonth: birth.leap });
}

/**
 * 所选流月段的运限。常规月按农历月查；闰月的前后两段没有按月的查询，取该段首日（初一或十六）按日查，
 * 用到流月为止（`toText` 时传 `through: 'monthly'`）。
 */
export function monthHoroscope(chart: Astrolabe, lunar: LunarCalendar, year: number, key: MonthKey): Horoscope {
  if (key.part === 'normal') return chart.horoscopeOfMonth(year, key.month);
  const start = lunar.toSolar({ year, month: key.month, leap: true, day: key.part === 'first' ? 1 : 16 });
  if (!start) throw new Error(`农历 ${year} 年没有闰 ${key.month} 月`);
  return chart.horoscope(`${start.year}-${start.month}-${start.day}`);
}

/** 某个流年内选流月段：沿用原月号（闰月段换年后落到同号常规月），该年没有就取正月。 */
function monthIn(chart: Astrolabe, year: number, want: MonthKey): MonthKey {
  const list = chart.monthlyList(year);
  const same = list.find((m) => m.month === want.month && m.part === want.part) ?? list.find((m) => m.month === want.month);
  const m = same ?? list[0];
  if (!m) throw new Error(`农历 ${year} 年没有流月`);
  return { month: m.month, part: m.part };
}

/**
 * 打开一张盘时的初始选择（设计规范 21.3）：停在本命；大限、流年预先放在今天（超出可选范围时取最近的一端），
 * 流月取今天所在的那一段。
 */
export function initialSelection(chart: Astrolabe, today: Today): LayerSelection {
  const [from, to] = yearRange(chart);
  const year = Math.min(Math.max(today.year, from), to);
  const decadal = decadalOfAge(chart, nominalAge(chart, year));
  if (decadal < 0) throw new Error(`流年 ${year} 不在任何大限内`);
  return {
    layer: 'natal',
    decadal,
    year,
    month: monthIn(chart, year, monthKeyOf(today.month, today.leap, today.day)),
  };
}

/** 某层的命宫宫位索引；本命为本命命宫。 */
function soulOf(chart: Astrolabe, sel: LayerSelection): number {
  const act = selectedLayer(chart, sel);
  if (act) return act.soul;
  const soul = chart.palace('soulPalace');
  if (!soul) throw new Error('盘上没有命宫');
  return soul.index;
}

/**
 * 排盘页的盘面状态：运限层的选择与选中宫，以及由它们算出的视图数据。
 * 规则（设计规范第 12 节）：选大限会把流年移进该大限；选流年会把大限移到包含它的那一段；
 * 换层时选中宫跳到该层命宫。
 */
export function useChartView(kernel: Kernel, chart: Astrolabe, today: Today) {
  const [sel, setSel] = useState<LayerSelection>(() => initialSelection(chart, today));
  const [palace, setPalace] = useState<number>(() => soulOf(chart, initialSelection(chart, today)));
  const hua = useMemo(() => huaTexts(kernel), [kernel]);
  const layer = useMemo(() => selectedLayer(chart, sel), [chart, sel]);
  const layers = useMemo(() => (layer ? [layer] : []), [layer]);
  const palaces = useMemo(() => palaceViews(chart, layers, hua), [chart, layers, hua]);
  const set = useMemo(() => surround(chart, palace), [chart, palace]);

  const apply = (next: LayerSelection) => {
    setSel(next);
    setPalace(soulOf(chart, next));
  };

  return {
    sel,
    palace,
    layer,
    layers,
    palaces,
    surround: set,
    hua,
    select: setPalace,
    setLayer: (layer: LayerKind) => apply({ ...sel, layer }),
    pickDecadal: (decadal: number) => {
      const item = chart.decadalList()[decadal];
      if (!item) throw new Error(`大限序号越界：${decadal}`);
      const [y0, y1] = item.yearRange;
      const year = sel.year >= y0 && sel.year <= y1 ? sel.year : today.year >= y0 && today.year <= y1 ? today.year : y0;
      apply({ ...sel, layer: 'decadal', decadal, year, month: monthIn(chart, year, sel.month) });
    },
    pickYear: (year: number) => {
      const decadal = decadalOfAge(chart, nominalAge(chart, year));
      if (decadal < 0) throw new Error(`流年 ${year} 不在任何大限内`);
      apply({ ...sel, layer: 'yearly', decadal, year, month: monthIn(chart, year, sel.month) });
    },
    pickMonth: (month: MonthKey) => apply({ ...sel, layer: 'monthly', month }),
    /** 换到某年的某个农历月（流月层，闰月取本月那一段），大限随之移到包含该年的一段。 */
    showMonth: (year: number, month: number) => {
      const decadal = decadalOfAge(chart, nominalAge(chart, year));
      if (decadal < 0) throw new Error(`流年 ${year} 不在任何大限内`);
      apply({ ...sel, layer: 'monthly', decadal, year, month: monthIn(chart, year, { month, part: 'normal' }) });
    },
  };
}

export type ChartView = ReturnType<typeof useChartView>;
