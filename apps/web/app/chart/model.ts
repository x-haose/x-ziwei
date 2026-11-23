import type { Astrolabe, HoroscopeItem, Star } from 'x-iztro';
import type { Kernel } from '../kernel/kernel';
import { BRANCH_CELL, type Branch, isBranch } from './layout';

/**
 * 命盘的视图数据：把内核的星盘与运限整理成画盘、读数与左栏要用的形状。
 * 所有事实（星曜、亮度、四化、宫名、大限、三方四正、格局）都取自内核，这里只做编组。
 */

/** 运限层：本命、大限、流年、流月。 */
export type LayerKind = 'natal' | 'decadal' | 'yearly' | 'monthly';

export const LAYER_KINDS: readonly LayerKind[] = ['natal', 'decadal', 'yearly', 'monthly'];

/**
 * 流月的一段：农历月号加分段。闰月在内核里拆成前后两段（初一至十五随本月、十六起随下月），
 * 两段的流月宫位与四化不同，所以分开选。
 */
export interface MonthKey {
  month: number;
  part: 'normal' | 'first' | 'second';
}

/** 四化的来源层：生年（n）、大限（d）、流年（y）、流月（m）。 */
export type HuaSource = 'n' | 'd' | 'y' | 'm';

export interface HuaMark {
  source: HuaSource;
  /** 禄、权、科、忌之一（内核译文）。 */
  text: string;
}

export interface StarView {
  key: string;
  name: string;
  brightness: string | undefined;
  /** 从生年到当前层的全部四化，按层先后。 */
  hua: HuaMark[];
}

export interface PalaceView {
  /** 宫位索引 0–11（0 为寅宫）。 */
  index: number;
  branch: Branch;
  cell: readonly [row: number, col: number];
  name: string;
  stem: string;
  isBody: boolean;
  isOriginal: boolean;
  /** 大限起止虚岁。 */
  decadal: readonly [number, number];
  majors: StarView[];
  minors: StarView[];
  adjectives: StarView[];
}

/** 一个运限层：该层命宫所在宫位、十二宫名、四化星与流耀。 */
export interface LayerView {
  kind: Exclude<LayerKind, 'natal'>;
  /** 该层命宫的宫位索引。 */
  soul: number;
  /** 十二宫名，按宫位索引。 */
  names: readonly string[];
  /** 被化的四颗星标识 [禄, 权, 科, 忌]。 */
  mutagenStarKeys: readonly string[];
  /** 流耀名，按宫位索引；该层没有流耀时为空数组。 */
  stars: readonly (readonly string[])[];
  stem: string;
  branch: string;
}

/** 由宫位索引取地支在盘上的位置。 */
function cellOf(branch: string): { branch: Branch; cell: readonly [number, number] } {
  if (!isBranch(branch)) throw new Error(`内核给出的宫支不是地支：${branch}`);
  return { branch, cell: BRANCH_CELL[branch] };
}

/** 四化文字（禄权科忌），按 [禄, 权, 科, 忌] 的顺序，取内核译文。 */
export function huaTexts(kernel: Kernel): readonly string[] {
  const keys = [kernel.Mutagen.LU, kernel.Mutagen.QUAN, kernel.Mutagen.KE, kernel.Mutagen.JI];
  return keys.map((k) => {
    const t = kernel.i18n.translate(k, 'zh-CN');
    if (!t) throw new Error(`内核没有四化 ${k} 的译文`);
    return t;
  });
}

function layerOf(kind: LayerView['kind'], item: HoroscopeItem): LayerView {
  return {
    kind,
    soul: item.index,
    names: item.palaceNames,
    mutagenStarKeys: item.mutagenStarKeys,
    stars: item.stars ? item.stars.map((s) => s.map((x) => x.name)) : Array.from({ length: 12 }, () => []),
    stem: item.heavenlyStem,
    branch: item.earthlyBranch,
  };
}

/** 运限层的选择：大限序号（按起运先后，0 起）、农历年、流月段。 */
export interface LayerSelection {
  layer: LayerKind;
  decadal: number;
  year: number;
  month: MonthKey;
}

/** 当前层及其之上的各层（本命不算一层）：大限 → 流年 → 流月。 */
export function activeLayers(chart: Astrolabe, sel: LayerSelection): LayerView[] {
  const out: LayerView[] = [];
  if (sel.layer === 'natal') return out;
  const decadal = chart.decadalList()[sel.decadal];
  if (!decadal) throw new Error(`大限序号越界：${sel.decadal}`);
  out.push(layerOf('decadal', decadal));
  if (sel.layer === 'decadal') return out;
  out.push(layerOf('yearly', chart.horoscopeOfYear(sel.year).yearly));
  if (sel.layer === 'yearly') return out;
  const month = chart
    .monthlyList(sel.year)
    .find((m) => m.month === sel.month.month && m.part === sel.month.part);
  if (!month) throw new Error(`农历 ${sel.year} 年没有这一段流月：${sel.month.month} ${sel.month.part}`);
  out.push(layerOf('monthly', month));
  return out;
}

function starView(star: Star, layers: readonly LayerView[], hua: readonly string[]): StarView {
  const marks: HuaMark[] = [];
  if (star.mutagen) marks.push({ source: 'n', text: star.mutagen });
  for (const l of layers) {
    const k = l.mutagenStarKeys.indexOf(star.key);
    if (k >= 0) marks.push({ source: l.kind === 'decadal' ? 'd' : l.kind === 'yearly' ? 'y' : 'm', text: hua[k]! });
  }
  return { key: star.key, name: star.name, brightness: star.brightness, hua: marks };
}

/** 十二宫的视图，按宫位索引排列；四化叠到 `layers` 为止。 */
export function palaceViews(chart: Astrolabe, layers: readonly LayerView[], hua: readonly string[]): PalaceView[] {
  return chart.palaces.map((p) => {
    const { branch, cell } = cellOf(p.earthlyBranch);
    return {
      index: p.index,
      branch,
      cell,
      name: p.name,
      stem: p.heavenlyStem,
      isBody: p.isBodyPalace,
      isOriginal: p.isOriginalPalace,
      decadal: p.decadal.range as readonly [number, number],
      majors: p.majorStars.map((s) => starView(s, layers, hua)),
      minors: p.minorStars.map((s) => starView(s, layers, hua)),
      adjectives: p.adjectiveStars.map((s) => starView(s, layers, hua)),
    };
  });
}

/**
 * 三方四正：[本宫, 对宫, 三合（官禄位）, 三合（财帛位）] 的宫位索引，取自内核。
 * 读数区按这个顺序列出对宫与两个三合。
 */
export function surround(chart: Astrolabe, index: number): readonly [number, number, number, number] {
  const s = chart.surroundedPalaces(index);
  if (!s) throw new Error(`宫位索引越界：${index}`);
  return [s.target.index, s.opposite.index, s.career.index, s.wealth.index];
}

/**
 * 大限是否顺时针排：命宫顺时针下一宫（宫位索引 +1）的大限紧接命宫大限即为顺行。
 * 只用来决定外圈刻度的排列方向。
 */
export function decadalClockwise(palaces: readonly PalaceView[]): boolean {
  const soul = palaces.reduce((a, b) => (a.decadal[0] <= b.decadal[0] ? a : b));
  const next = palaces[(soul.index + 1) % 12]!;
  return next.decadal[0] === soul.decadal[1] + 1;
}

/** 某农历年的虚岁：生年为 1 岁。 */
export function nominalAge(chart: Astrolabe, lunarYear: number): number {
  return lunarYear - chart.rawDates.lunarDate.lunarYear + 1;
}

/** 包含某个虚岁的大限序号（按起运先后）；不在任何大限内（童限或超出）为 -1。 */
export function decadalOfAge(chart: Astrolabe, age: number): number {
  return chart.decadalList().findIndex((d) => age >= d.ageRange[0] && age <= d.ageRange[1]);
}

/** 可选的流年范围（农历年，含两端）：第一个大限起运那年到最后一个大限的末年。 */
export function yearRange(chart: Astrolabe): readonly [number, number] {
  const list = chart.decadalList();
  return [list[0]!.yearRange[0], list.at(-1)!.yearRange[1]];
}

