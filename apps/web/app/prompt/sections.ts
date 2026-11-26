import type { Astrolabe, KnowledgeOptions } from 'x-iztro';
import type { Birth } from '../birth/birth';
import { PERIODS } from '../birth/birth';
import type { LunarCalendar } from '../birth/calendar';
import { candidatesText, hourName, periodName } from '../birth/labels';
import type { LayerSelection } from '../chart/model';
import { monthHoroscope } from '../chart/session';
import { fmt, type Messages } from '../i18n/messages';

/** 提示词里勾选的盘面各段。 */
export interface PromptChoice {
  /** 本命盘。 */
  natal: boolean;
  /** 各段附上知识包的释义摘要。 */
  know: boolean;
  /** 所选流年的运限与该年流月一览；选在流月层时改为所选流月的运限。 */
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
    if (sel.layer === 'monthly') {
      // 闰月的前后两段按该段首日发起运限，写到流月为止（见 monthHoroscope）。
      const h = monthHoroscope(chart, lunar, sel.year, sel.month);
      out.push(h.toText(sel.month.part === 'normal' ? opts : { ...opts, through: 'monthly' }));
    } else {
      // 与 MCP 工具 ziwei_get_horoscope 问某一年时的返回一致：运限写到流年，文末附该年的流月一览。
      out.push(`${chart.horoscopeOfYear(sel.year).toText(opts)}\n${chart.monthlyListToText(sel.year, opts)}`);
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
export function approxNote(t: Messages, birth: Birth): string | null {
  if (birth.time.kind !== 'period') return null;
  return fmt(t.chart.approxPrompt, {
    period: periodName(t, birth.time.period),
    range: PERIODS[birth.time.period].range,
    hours: candidatesText(t, birth.time.period),
    hour: hourName(t, birth.time.pick),
  });
}
