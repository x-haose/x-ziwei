import { useMemo } from 'react';
import { useLocation } from 'react-router';
import type { Astrolabe } from 'x-iztro';
import { decodeBirth } from '../birth/birth';
import { birthSummary, hourName } from '../birth/labels';
import { useRecent } from '../birth/recent';
import type { Messages } from '../i18n/messages';
import type { Kernel } from '../kernel/kernel';
import { createLunarCalendar } from '../kernel/lunar';
import { useHydrated } from '../lib/media';
import { castChart, chartHour } from '../chart/session';

/** 编辑器里可选的一张盘：地址参数（不含 `#`）、本页用的随机标识（选择器的键）、显示名与排好的盘。 */
export interface ChartChoice {
  hash: string;
  id: string;
  label: string;
  chart: Astrolabe;
}

/**
 * 盘在选择器里的键：同一个地址参数在本页生命周期内一直用同一个随机标识。键会进选项的 DOM id，不能带生辰；
 * 生辰的取值空间小，哈希能穷举反推，所以用随机标识。
 */
const choiceIds = new Map<string, string>();

function choiceId(hash: string): string {
  let id = choiceIds.get(hash);
  if (!id) {
    id = crypto.randomUUID();
    choiceIds.set(hash, id);
  }
  return id;
}

/** 示例盘：首页与排盘页的示例（公历 2000-8-16 寅时 女）。 */
export const SAMPLE_HASH = 'cal=solar&d=2000-8-16&t=2&g=f';

/**
 * 编辑器里可选的盘（设计规范 20.2、20.6）：地址 `#` 里带来的盘（从看盘来时就是那一张）、本机最近排过的盘与示例盘，
 * 同一张只列一次。生辰只在 `#` 之后与本机存储里，不进查询串。
 */
export function useChartChoices(kernel: Kernel, t: Messages): ChartChoice[] {
  const lunar = useMemo(() => createLunarCalendar(kernel), [kernel]);
  const recent = useRecent(lunar);
  const { hash } = useLocation();
  const hydrated = useHydrated();
  const here = hydrated ? hash.replace(/^#/, '') : '';
  return useMemo(() => {
    const hashes = [here, ...(recent?.kind === 'ok' ? recent.items.map((x) => x.hash.replace(/^#/, '')) : []), SAMPLE_HASH].filter(Boolean);
    const out: ChartChoice[] = [];
    for (const h of hashes) {
      if (out.some((c) => c.hash === h)) continue;
      const d = decodeBirth(`#${h}`, lunar);
      if (d.kind !== 'ok') continue;
      const s = birthSummary(t, d.birth);
      const time = d.birth.time.kind === 'hour' ? s.time : hourName(t, chartHour(d.birth));
      out.push({ hash: h, id: choiceId(h), label: `${s.date} ${time} ${s.gender}`, chart: castChart(kernel, d.birth, chartHour(d.birth)) });
    }
    return out;
  }, [here, recent, lunar, kernel, t]);
}
