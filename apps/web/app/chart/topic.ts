import type { Astrolabe, KnowledgePack, MutagenLanding, PatternHit, Star, TopicEntry, TopicGroup, TopicSelection } from 'x-iztro';
import { type Messages, fmt } from '../i18n/messages';
import type { LayerView } from './model';

/**
 * 看盘第二版（设计规范第 21 节）的取材：一个主题看哪几宫、五步里每一步盘上有什么、列哪些释义。
 * 宫位、星曜、四化、格局全部取自内核的结构化结果；主题选哪几宫、落在这几宫的生年四化与运限四化取自内核的
 * `topicPalaces`（按生效组合的主题定义，本命或所选运限层）。这里只编组、拼事实句，不下判断（事实句只有宫名、地支、
 * 星名、亮度、四化、格局名、岁数与年份）。
 */

/** 事实句里可点开的术语：标识对应生效组合 `concepts` 的条目 slug。 */
export const TERM_SLUGS = {
  benGong: 'ben-gong',
  duiGong: 'dui-gong',
  sanHe: 'san-he-wei',
  sanFang: 'san-fang-si-zheng',
  kongGong: 'kong-gong',
  geJu: 'ge-ju',
  daXian: 'da-xian-pan',
  liuNian: 'liu-nian-pan',
  siHua: 'yun-xian-si-hua',
  shenGong: 'shen-gong',
  laiYin: 'lai-yin-gong',
  tongGong: 'tong-gong',
  huiZhao: 'hui-zhao',
} as const;

export type TermId = keyof typeof TERM_SLUGS;

/**
 * 带术语的一段文字。`term` 是固定术语（文字取界面语言的说法）；`brightness` 是亮度字（庙、旺……），
 * 能不能点开由生效组合里有没有对应的术语条目决定（见 `brightnessConcept`）。
 */
export type RichPart = string | { term: TermId; text: string } | { brightness: string };
export type Rich = readonly RichPart[];

/** 按 `{name}` 占位拼出带术语的文字；占位缺值即文案写错，直接失败。 */
export function rich(template: string, values: Record<string, Rich | string | number>): RichPart[] {
  const out: RichPart[] = [];
  let last = 0;
  for (const m of template.matchAll(/\{(\w+)\}/g)) {
    if (m.index > last) out.push(template.slice(last, m.index));
    const v = values[m[1]!];
    if (v === undefined) throw new Error(`文案占位 {${m[1]}} 没有给值：${template}`);
    if (typeof v === 'string' || typeof v === 'number') out.push(String(v));
    else out.push(...v);
    last = m.index + m[0].length;
  }
  if (last < template.length) out.push(template.slice(last));
  return out;
}

/** 依次连接几段：两项用「和」，更多时前面用顿号。 */
function joinAnd(items: readonly Rich[], t: Messages): RichPart[] {
  if (items.length <= 1) return [...(items[0] ?? [])];
  const out: RichPart[] = [];
  items.slice(0, -1).forEach((x, i) => {
    if (i > 0) out.push(t.read.sep);
    out.push(...x);
  });
  out.push(t.read.and, ...items.at(-1)!);
  return out;
}

function joinSep(items: readonly Rich[], sep: string): RichPart[] {
  const out: RichPart[] = [];
  items.forEach((x, i) => {
    if (i > 0) out.push(sep);
    out.push(...x);
  });
  return out;
}

/**
 * 点盘上的宫读哪个主题：在所选层（`select` 给出该层的选宫结果）以它为本宫（第一组是 `surround` 且落在这一宫）的
 * 第一个主题；没有为 null。
 */
export function topicOfPalace(select: (slug: string) => TopicSelection, topics: readonly TopicEntry[], index: number): string | null {
  for (const t of topics) {
    const g = select(t.slug).groups[0];
    if (g?.kind === 'surround' && g.target === index) return t.slug;
  }
  return null;
}

/**
 * 一条格局命中的标识：格局、本宫、口径、破格与所用的星（按星与所在宫去重排序）都相同才算同一条。
 * 同一格局在同一本宫可以有几条命中（口径不同或所用的星不同），各自成条。
 */
export function hitId(h: PatternHit): string {
  const stars = [...new Set(h.stars.map((s) => `${s.key}@${s.palaceIndex}`))].sort();
  return `${h.key}@${h.palaceIndex}/${h.variant ?? ''}/${h.broken ? 1 : 0}/${stars.join(',')}`;
}

/** 一条释义：星、两颗主星的同宫组合、四化、格局。UI 按生效组合取原文。 */
export type NoteRef =
  | { kind: 'star'; key: string; label: string }
  | { kind: 'combo'; a: { key: string; name: string }; b: { key: string; name: string } }
  | { kind: 'mutagen'; key: string; label: string }
  | { kind: 'pattern'; key: string; label: string };

/** 收起的一组释义（次要的星），点开才列。 */
export interface NoteGroup {
  id: string;
  title: string;
  notes: NoteRef[];
}

export interface Step {
  /** 盘上的事实，一句一段。 */
  facts: Rich[];
  /** 这一步看的宫。 */
  hl: number[];
  /** 这一步的焦点宫（盘上的选中宫）。 */
  focus: number;
  notes: NoteRef[];
  groups: NoteGroup[];
  /** 第 5 步、看一生时：「看这十年的…」「看今年的…」两个按钮可不可用（今天在不在可选范围里）。 */
  when: { decade: boolean; year: boolean } | null;
}

/** 所选运限的一层：盘上叠的就是这一层；`head` 是第 5 步首句的说法。 */
export interface StepLayer {
  view: LayerView;
  patterns: readonly PatternHit[];
  head:
    | { kind: 'decadal'; ages: readonly [number, number]; years: readonly [number, number] }
    | { kind: 'yearly'; year: number; age: number }
    | { kind: 'monthly'; year: number; month: string };
}

/** 今天所在的大限与流年（看一生时第 5 步用）。 */
export interface StepNow {
  year: number;
  age: number;
  /** 今天所在大限：年岁范围与该大限命宫；童限或超出排盘范围为 null。 */
  decadal: { ages: readonly [number, number]; soul: number } | null;
  /** 今年流年命宫；不在可选流年范围为 null。 */
  yearlySoul: number | null;
}

export interface StepInput {
  chart: Astrolabe;
  topic: TopicEntry;
  /** 主题在所选层的选宫结果（内核 `topicPalaces`）：本命层或 `layer` 那一层，至少一组。 */
  palaces: TopicSelection;
  layer: StepLayer | null;
  now: StepNow;
  /** 四化文字 [禄, 权, 科, 忌]（内核译文）。 */
  hua: readonly string[];
  /** 四化条目的标识 [禄, 权, 科, 忌]（内核的 Mutagen 常量）。 */
  mutagenKeys: readonly string[];
  natalPatterns: readonly PatternHit[];
  t: Messages;
}

/** 宫名的全称：命宫、财帛宫（内核的宫名有的不带「宫」）。 */
export function palaceFull(name: string, t: Messages): string {
  return t.read.palaceName.replace('{name}', name).replace(/宫宫$/, '宫');
}

/**
 * 事实句里宫名的三种写法，按宫位索引：`natal` 本命宫名；`short` 所选层的宫名（「流月兄弟宫」）；
 * `full` 所选层的宫名并注明本命（「流月兄弟宫（本命官禄宫）」）。看本命时三者相同。
 */
function palaceNames(chart: Astrolabe, layer: LayerView | null, t: Messages) {
  const natal = (i: number) => palaceFull(chart.palaces[i]!.name, t);
  if (!layer) return { natal, short: natal, full: natal };
  const f = t.read.facts;
  const name = (i: number) => palaceFull(layer.names[i]!, t);
  const lname = t.layer[layer.kind];
  return {
    natal,
    short: (i: number) => fmt(f.layerName, { layer: lname, name: name(i) }),
    full: (i: number) => fmt(f.layerPalace, { layer: lname, name: name(i), natal: natal(i) }),
  };
}

/** 选宫结果的全部宫位索引（每宫一次，按内核的成段顺序）与本宫（第一组的宫：有 `surround` 时是第一个 `surround` 宫）。 */
function setAndMain(tp: TopicSelection): { set: number[]; main: number } {
  const first = tp.groups[0];
  if (!first) throw new Error(`主题 ${tp.topic} 一个宫都没有选，不该进入逐步阅读`);
  return { set: tp.palaces.map((p) => p.index), main: first.target };
}

/** 读一个主题的五步：本宫主星、三方四正、四化、格局、运限（设计规范 21.4）。 */
export function topicSteps(input: StepInput): Step[] {
  const { chart, topic, palaces: tp, layer, now, hua, mutagenKeys, natalPatterns, t } = input;
  if (tp.scope !== (layer?.view.kind ?? 'origin')) throw new Error(`选宫结果的层（${tp.scope}）与所选运限层（${layer?.view.kind ?? 'origin'}）不一致`);
  const f = t.read.facts;
  const P = chart.palaces;
  const N = palaceNames(chart, layer?.view ?? null, t);
  const pl = N.full;
  const term = (id: TermId): Rich => [{ term: id, text: t.read.terms[id] }];
  const starText = (s: Star): Rich => (s.brightness ? rich(f.starBright, { star: s.name, brightness: [{ brightness: s.brightness }] }) : [s.name]);
  const majors = (i: number) => P[i]!.majorStars;
  const minors = (i: number) => P[i]!.minorStars;
  const brief = (i: number): Rich =>
    rich(f.brief, { branch: P[i]!.earthlyBranch, stars: majors(i).length ? majors(i).map((s) => s.name).join(t.read.sep) : f.noMajor });
  /** 宫名加地支与主星：「夫妻宫（申，天机）」；运限层「流月交友宫（本命夫妻宫，申，天机）」。 */
  const withBrief = (i: number): Rich =>
    layer ? [N.short(i), ...rich(f.paren, { x: rich(f.natalBrief, { natal: N.natal(i), brief: brief(i) }) })] : [N.natal(i), ...rich(f.paren, { x: brief(i) })];
  const opp = (i: number) => {
    const s = chart.surroundedPalaces(i);
    if (!s) throw new Error(`宫位索引越界：${i}`);
    return s.opposite.index;
  };
  const { set, main } = setAndMain(tp);
  const sur = tp.groups.filter((g) => g.kind === 'surround');
  const only = tp.groups.filter((g) => g.kind === 'only');
  const baseGroups = sur.length ? sur : only;
  const bases = [...new Set(baseGroups.map((g) => g.target))];
  const steps: Step[] = [];
  const seen = new Set<string>();
  const fresh = (s: Star) => !seen.has(s.key) && (seen.add(s.key), true);
  const combo = (i: number): NoteRef[] => {
    const m = majors(i);
    return m.length === 2 ? [{ kind: 'combo', a: { key: m[0]!.key, name: m[0]!.name }, b: { key: m[1]!.key, name: m[1]!.name } }] : [];
  };
  const starIn = (s: Star, i: number) => f.starIn.replace('{star}', s.name).replace('{palace}', N.short(i));

  /* 1 本宫主星 */
  const headOf = (g: TopicGroup): Rich =>
    g.key === 'bodyPalace'
      ? rich(f.bodyAt, { body: term('shenGong'), palace: N.short(g.target), branch: P[g.target]!.earthlyBranch })
      : g.key === 'originalPalace'
        ? rich(f.bodyAt, { body: term('laiYin'), palace: N.short(g.target), branch: P[g.target]!.earthlyBranch })
        : rich(f.palaceAt, { palace: pl(g.target), branch: P[g.target]!.earthlyBranch });
  const seenBase = new Set<number>();
  const f1: Rich[] = [];
  for (const g of baseGroups) {
    if (g.kind === 'surround' && seenBase.has(g.target)) continue;
    seenBase.add(g.target);
    const i = g.target;
    const mi = minors(i);
    const tail: Rich = mi.length ? rich(f.minorTail, { tong: term('tongGong'), stars: joinAnd(mi.map(starText), t) }) : [];
    if (majors(i).length) {
      f1.push(rich(f.mainStars, { head: headOf(g), stars: joinAnd(majors(i).map(starText), t), tail }));
    } else {
      const o = opp(i);
      const borrowed: Rich = majors(o).length
        ? rich(f.oppositeStars, { dui: term('duiGong'), palace: pl(o), stars: joinAnd(majors(o).map(starText), t) })
        : rich(f.oppositeEmpty, { dui: term('duiGong'), palace: pl(o) });
      f1.push(rich(f.noMain, { head: headOf(g), kong: term('kongGong'), tail, borrowed }));
    }
  }
  const notes1: NoteRef[] = [];
  for (const i of bases) {
    const src = majors(i).length ? i : opp(i);
    for (const s of majors(src).filter(fresh)) notes1.push({ kind: 'star', key: s.key, label: src === i ? s.name : starIn(s, src) });
    notes1.push(...combo(src));
  }
  const minorNotes = bases.flatMap((i) => minors(i)).filter(fresh);
  steps.push({
    facts: f1,
    hl: [...new Set(bases.flatMap((i) => (majors(i).length ? [i] : [i, opp(i)])))],
    focus: bases[0]!,
    notes: notes1,
    groups: minorNotes.length
      ? [{ id: 'g1', title: f.minorNotes.replace('{names}', minorNotes.map((s) => s.name).join(t.read.sep)), notes: minorNotes.map((s) => ({ kind: 'star' as const, key: s.key, label: s.name })) }]
      : [],
    when: null,
  });

  /* 2 三方四正 */
  const f2: Rich[] = [];
  if (sur.length) {
    for (const g of sur) {
      f2.push(
        rich(f.surround, {
          palace: N.short(g.target),
          dui: term('duiGong'),
          opp: withBrief(g.opposite),
          sanhe: term('sanHe'),
          a: withBrief(g.wealth),
          b: withBrief(g.career),
        }),
      );
    }
    const extra = only.filter((g) => !sur.some((s) => s.target === g.target) || g.key === 'bodyPalace' || g.key === 'originalPalace');
    if (extra.length) {
      const items = extra.map((g): Rich =>
        g.key === 'bodyPalace'
          ? rich(f.bodyIn, { body: term('shenGong'), palace: N.short(g.target) })
          : g.key === 'originalPalace'
            ? rich(f.bodyIn, { body: term('laiYin'), palace: N.short(g.target) })
            : withBrief(g.target),
      );
      f2.push(rich(f.alsoSee, { list: joinSep(items, t.read.sep) }));
    }
  } else {
    const items = only.map((g): Rich =>
      g.key === 'bodyPalace'
        ? rich(f.bodyIn, { body: term('shenGong'), palace: N.short(g.target) })
        : g.key === 'originalPalace'
          ? rich(f.bodyIn, { body: term('laiYin'), palace: N.short(g.target) })
          : [pl(g.target)],
    );
    f2.push(rich(f.onlySelf, { topic: topic.title ?? topic.slug, list: joinAnd(items, t), sanfang: term('sanFang') }));
  }
  const others = set.filter((i) => !bases.includes(i));
  const notes2: NoteRef[] = [];
  const names2: string[] = [];
  for (const i of others) {
    const fs = majors(i).filter(fresh);
    for (const s of fs) {
      notes2.push({ kind: 'star', key: s.key, label: starIn(s, i) });
      names2.push(s.name);
    }
    if (fs.length) notes2.push(...combo(i));
  }
  steps.push({
    facts: f2,
    hl: set,
    focus: main,
    notes: [],
    groups: names2.length ? [{ id: 'g2', title: f.othersNotes.replace('{names}', names2.join(t.read.sep)), notes: notes2 }] : [],
    when: null,
  });

  /* 3 四化：落在这几宫的生年四化与所选层四化取自选宫结果；落在别处的生年四化、该层四化的全部落宫取自盘面 */
  type Hua = { h: number; star: string; at: number };
  const starAt = (key: string, at: number): string => {
    const s = [...P[at]!.majorStars, ...P[at]!.minorStars].find((x) => x.key === key);
    if (!s) throw new Error(`四化星 ${key} 不在宫位 ${at}`);
    return s.name;
  };
  const huaOf = (m: MutagenLanding): Hua => {
    const h = mutagenKeys.indexOf(m.mutagenKey);
    if (h < 0) throw new Error(`内核给的四化不是禄权科忌：${m.mutagenKey}`);
    return { h, star: starAt(m.starKey, m.palaceIndex), at: m.palaceIndex };
  };
  const natalHua: Hua[] = [];
  P.forEach((p, i) =>
    [...p.majorStars, ...p.minorStars].forEach((s) => {
      if (!s.mutagen) return;
      const h = hua.indexOf(s.mutagen);
      if (h < 0) throw new Error(`内核给的四化不是禄权科忌：${s.mutagen}`);
      natalHua.push({ h, star: s.name, at: i });
    }),
  );
  natalHua.sort((a, b) => a.h - b.h);
  const huaText = (x: Hua): Rich => rich(f.huaAt, { star: x.star, hua: hua[x.h]!, palace: pl(x.at) });
  const inN = tp.birthMutagens.map(huaOf);
  const outN = natalHua.filter((x) => !set.includes(x.at));
  const f3: Rich[] = [inN.length ? rich(f.natalHuaIn, { sihua: term('siHua'), list: joinSep(inN.map(huaText), t.read.comma) }) : rich(f.natalHuaNone, { sihua: term('siHua') })];
  if (outN.length) f3.push(rich(f.natalHuaOut, { list: joinSep(outN.map(huaText), t.read.comma) }));
  let inL: Hua[] = [];
  if (layer) {
    const lh = layer.view.mutagenStarKeys.map((key, h): Hua => {
      const at = P.findIndex((p) => [...p.majorStars, ...p.minorStars].some((s) => s.key === key));
      if (at < 0) throw new Error(`四化星 ${key} 不在盘上`);
      return { h, star: starAt(key, at), at };
    });
    // 选宫结果含大限至所选层的各层四化；盘上只叠所选这一层，这里也只写这一层。
    inL = tp.scopeMutagens.filter((m) => m.scope === layer.view.kind).map(huaOf);
    f3.push(
      rich(f.layerHua, {
        layer: t.layer[layer.view.kind],
        gz: `${layer.view.stem}${layer.view.branch}`,
        list: joinSep(lh.map(huaText), t.read.comma),
        tail: inL.length ? rich(f.layerHuaIn, { list: joinAnd(inL.map((x) => [`${x.star}${f.huaWord}${hua[x.h]}`]), t) }) : [f.layerHuaNone],
      }),
    );
  }
  const huaShown = [...new Set([...inN, ...inL].map((x) => x.h))].sort();
  steps.push({
    facts: f3,
    hl: [...new Set([...inN, ...inL].map((x) => x.at))],
    focus: main,
    notes: huaShown.map((h) => ({ kind: 'mutagen' as const, key: mutagenKeys[h]!, label: `${f.huaWord}${hua[h]}` })),
    groups: [],
    when: null,
  });

  /* 4 格局：本宫在这几宫的格局（与内核 topicToText 同一规则）；同一条命中只列一次，标出在哪几层成立 */
  const pats = new Map<string, { hit: PatternHit; scopes: string[] }>();
  const add = (list: readonly PatternHit[], scope: string) => {
    for (const h of list) {
      if (!set.includes(h.palaceIndex)) continue;
      const id = hitId(h);
      const same = pats.get(id);
      if (same) {
        if (!same.scopes.includes(scope)) same.scopes.push(scope);
      } else pats.set(id, { hit: h, scopes: [scope] });
    }
  };
  add(natalPatterns, t.layer.natal);
  if (layer) add(layer.patterns, t.layer[layer.view.kind]);
  const pl4 = [...pats.values()];
  const f4: Rich[] = pl4.length
    ? pl4.map(({ hit, scopes }) => {
        const stars = hit.stars.filter((s, k, a) => a.findIndex((y) => y.name === s.name && y.palaceIndex === s.palaceIndex) === k);
        return rich(f.pattern, {
          name: hit.name,
          broken: hit.broken ? f.broken : '',
          benGong: term('benGong'),
          palace: pl(hit.palaceIndex),
          stars: stars.map((s) => f.patternStar.replace('{palace}', N.short(s.palaceIndex)).replace('{star}', s.name)).join(t.read.sep),
          scopes: scopes.join(t.read.sep),
        });
      })
    : [layer ? rich(f.noPatternLayer, { geju: term('geJu'), layer: t.layer[layer.view.kind] }) : rich(f.noPattern, { geju: term('geJu') })];
  const patternKeys = new Set<string>();
  steps.push({
    facts: f4,
    hl: [...new Set(pl4.flatMap(({ hit }) => [hit.palaceIndex, ...hit.stars.map((s) => s.palaceIndex)]))],
    focus: pl4[0]?.hit.palaceIndex ?? main,
    notes: pl4.filter(({ hit }) => !patternKeys.has(hit.key) && (patternKeys.add(hit.key), true)).map(({ hit }) => ({ kind: 'pattern' as const, key: hit.key, label: hit.name })),
    groups: [],
    when: null,
  });

  /* 5 运限 */
  if (!layer) {
    const f5: Rich[] = [];
    const hl: number[] = [];
    if (now.decadal) {
      f5.push(rich(f.nowDecadal, { y: now.year, age: now.age, a: now.decadal.ages[0], b: now.decadal.ages[1], daxian: term('daXian'), branch: P[now.decadal.soul]!.earthlyBranch, palace: N.natal(now.decadal.soul) }));
      hl.push(now.decadal.soul);
    } else f5.push(rich(f.nowNoDecadal, { y: now.year, age: now.age }));
    if (now.yearlySoul !== null) {
      f5.push(rich(f.nowYearly, { y: now.year, liunian: term('liuNian'), branch: P[now.yearlySoul]!.earthlyBranch, palace: N.natal(now.yearlySoul) }));
      if (!hl.includes(now.yearlySoul)) hl.push(now.yearlySoul);
    }
    steps.push({ facts: f5, hl, focus: hl[0] ?? main, notes: [], groups: [], when: { decade: now.decadal !== null, year: now.yearlySoul !== null } });
  } else {
    const L = layer.view;
    const h = layer.head;
    const f5: Rich[] = [
      h.kind === 'decadal'
        ? rich(f.layerDecadal, { a: h.ages[0], b: h.ages[1], daxian: term('daXian'), y0: h.years[0], y1: h.years[1], branch: P[L.soul]!.earthlyBranch, palace: N.natal(L.soul) })
        : h.kind === 'yearly'
          ? rich(f.layerYearly, { y: h.year, gz: `${L.stem}${L.branch}`, age: h.age, liunian: term('liuNian'), branch: P[L.soul]!.earthlyBranch, palace: N.natal(L.soul) })
          : rich(f.layerMonthly, { y: h.year, month: h.month, gz: `${L.stem}${L.branch}`, branch: P[L.soul]!.earthlyBranch, palace: N.natal(L.soul) }),
    ];
    if (main !== L.soul) f5.push(rich(f.layerTopic, { palace: palaceFull(L.names[main]!, t), branch: P[main]!.earthlyBranch, natal: N.natal(main) }));
    steps.push({ facts: f5, hl: [...new Set([L.soul, main])], focus: main, notes: [], groups: [], when: null });
  }
  return steps;
}

const conceptTitles = new WeakMap<KnowledgePack, [slug: string, title: string][]>();

/**
 * 亮度字（庙、旺……）对应的术语条目：生效组合 `concepts` 里标题以「亮度」开头的那一条，各亮度字共用。
 * 没有为 null（照常显示文字）。
 */
export function brightnessConcept(pack: KnowledgePack): string | null {
  let list = conceptTitles.get(pack);
  if (!list) {
    const concepts = (pack.toJSON() as { concepts?: Record<string, { title?: string }> }).concepts ?? {};
    list = Object.entries(concepts).map(([slug, c]) => [slug, c.title ?? '']);
    conceptTitles.set(pack, list);
  }
  return list.find(([, title]) => title.startsWith('亮度'))?.[0] ?? null;
}

/**
 * 选宫句：「看命宫连同它的三方四正，另看身宫、福德宫。」只取本宫的主题写「只看……这几宫本身。」
 * 选了运限层时宫名按那一层写（「看流月兄弟宫连同它的三方四正」）。
 */
export function selectionText(chart: Astrolabe, layer: LayerView | null, tp: TopicSelection, t: Messages): RichPart[] {
  const r = t.read;
  const pl = palaceNames(chart, layer, t).short;
  const term = (id: TermId): Rich => [{ term: id, text: r.terms[id] }];
  const a = tp.groups.filter((g) => g.kind === 'surround').map((g) => rich(r.selSurround, { palace: pl(g.target), sanfang: term('sanFang') }));
  const b = tp.groups
    .filter((g) => g.kind === 'only')
    .map((g): Rich => (g.key === 'bodyPalace' ? term('shenGong') : g.key === 'originalPalace' ? term('laiYin') : [pl(g.target)]));
  if (!a.length) return rich(r.selOnly, { b: joinSep(b, r.sep) });
  return b.length ? rich(r.selBoth, { a: joinSep(a, r.sep), b: joinSep(b, r.sep) }) : rich(r.selSurroundOnly, { a: joinSep(a, r.sep) });
}
