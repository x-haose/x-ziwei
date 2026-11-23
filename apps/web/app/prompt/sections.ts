import type { Astrolabe, KnowledgeOptions } from 'x-iztro';
import type { Birth } from '../birth/birth';
import { PERIODS } from '../birth/birth';
import type { LunarCalendar } from '../birth/calendar';
import { hourName, periodName } from '../birth/labels';
import type { LayerSelection } from '../chart/model';
import { fmt, type Messages } from '../i18n/messages';

/** 提示词里勾选的盘面各段。 */
export interface PromptChoice {
  /** 本命盘。 */
  natal: boolean;
  /** 各段附上知识包的释义摘要。 */
  know: boolean;
  /** 所选流年的运限（选在流月层时写到流月）。 */
  year: boolean;
  /** 大限一览。 */
  decades: boolean;
  /** 所选大限内十年的流年一览。 */
  years: boolean;
}

/**
 * 盘面各段的原文：全部是内核的语义化文本（与 MCP 工具返回给模型的是同一种 Markdown），这里不改写。
 * 勾了释义摘要时，各段都带上内嵌知识包的摘要层释义。
 */
export function chartSections({
  chart,
  sel,
  choice,
  knowledge,
  lunar,
}: {
  chart: Astrolabe;
  sel: LayerSelection;
  choice: PromptChoice;
  knowledge: KnowledgeOptions['knowledge'];
  lunar: LunarCalendar;
}): string[] {
  const opts: KnowledgeOptions = choice.know ? { knowledge, knowledgeDepth: 'summary' } : {};
  const out: string[] = [];
  if (choice.natal) out.push(chart.toText(opts));
  if (choice.year) {
    if (sel.layer === 'monthly' && sel.month.part === 'normal') {
      out.push(chart.horoscopeOfMonth(sel.year, sel.month.month).toText(opts));
    } else if (sel.layer === 'monthly') {
      // 闰月的前后两段：取该段首日（初一或十六）发起运限，写到流月为止。
      const start = lunar.toSolar({ year: sel.year, month: sel.month.month, leap: true, day: sel.month.part === 'first' ? 1 : 16 });
      if (!start) throw new Error(`农历 ${sel.year} 年没有闰 ${sel.month.month} 月`);
      out.push(chart.horoscope(`${start.year}-${start.month}-${start.day}`).toText({ ...opts, through: 'monthly' }));
    } else {
      out.push(chart.horoscopeOfYear(sel.year).toText(opts));
    }
  }
  if (choice.decades) out.push(chart.decadalListToText(opts));
  if (choice.years) {
    const d = chart.decadalList()[sel.decadal];
    if (!d) throw new Error(`大限序号越界：${sel.decadal}`);
    out.push(chart.yearlyOverviewToText(d.yearRange[0], d.yearRange[1], opts));
  }
  return out;
}

/** 只知道大概时段时，提示词开头写明时辰未定、候选与这张盘用的时辰。 */
export function approxNote(t: Messages, birth: Birth, hour: number): string | null {
  if (birth.time.kind !== 'period') return null;
  const p = PERIODS[birth.time.period];
  return fmt(t.chart.approxPrompt, {
    period: periodName(t, birth.time.period),
    range: p.range,
    hours: p.hours.map((h) => hourName(t, h)).join(t.form.listSep),
    hour: hourName(t, hour),
  });
}
