import type { Astrolabe, KnowledgeIssue, KnowledgePack, TopicEntry } from 'x-iztro';
import type { Kernel } from '../kernel/kernel';
import { builtinPack } from '../knowledge/kernel-pack';
import { DEFAULT_PACK_ID, type Draft, type LibraryProblem, type Pack, type PackRaw, type Section, type Use, libraryProblems } from '../knowledge/library';

/**
 * 知识包编辑器（设计规范第 20 节）的纯规则：草稿怎么建、写进哪个包、对照哪个包、一个条目与字段的状态、
 * 一张盘或一个主题用到哪些条目、校验结果落在哪个字段。包格式只认内核的 `KnowledgePack.check`。
 */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** 一个条目：段与标识。 */
export interface EntryRef {
  section: Section;
  key: string;
}

export const entryId = (e: EntryRef) => `${e.section}/${e.key}`;

/** 今天的日期 `YYYY-MM-DD`（本地时间），新包的缺省版本。 */
export function today(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** 新包的原文：只有元字段。`base` 是所基于的包（写进 `extends`），新建知识包为 null。 */
export function blankRaw({ id, name, base, version }: { id: string; name: string; base: string | null; version: string }): PackRaw {
  const raw: PackRaw = { schema: 1, id, version, language: 'zh-CN', source: { name } };
  if (base !== null) raw.extends = base;
  return raw;
}

/** 标识不与默认包、本机的包与其他新包草稿重复时可用。 */
export function idFree(id: string, packs: readonly Pack[], drafts: readonly Draft[], self: string | null): boolean {
  if (id === DEFAULT_PACK_ID || packs.some((p) => p.id === id)) return false;
  return !drafts.some((d) => d.id !== self && d.editing === null && d.raw.id === id);
}

/** 从看盘直达时新包的标识：`my-pack`，重了依次 `my-pack-2`、`my-pack-3`…… */
export function freshId(stem: string, packs: readonly Pack[], drafts: readonly Draft[]): string {
  for (let n = 1; ; n++) {
    const id = n === 1 ? stem : `${stem}-${n}`;
    if (idFree(id, packs, drafts, null)) return id;
  }
}

/**
 * 从看盘直达时写进哪里（设计规范 20.2）：生效组合最上面的包是自己在编辑器里保存过的，就改它（有草稿接着草稿）；
 * 否则（默认包、导入的别人的包）写进叠在它上面的新包，已有这样一份还没进包库的新包草稿时接着用它。
 */
export type WriteTarget = { kind: 'draft'; draft: Draft } | { kind: 'edit'; pack: Pack } | { kind: 'new'; base: string };

export function writeTarget(top: string, packs: readonly Pack[], drafts: readonly Draft[]): WriteTarget {
  const own = packs.find((p) => p.id === top && p.savedAt !== null);
  if (own) {
    const d = drafts.find((x) => x.editing === own.id);
    return d ? { kind: 'draft', draft: d } : { kind: 'edit', pack: own };
  }
  const d = drafts.find((x) => x.editing === null && x.raw.extends === top);
  return d ? { kind: 'draft', draft: d } : { kind: 'new', base: top };
}

/** 生效组合最上面的包。 */
export const topLayer = (use: Use): string => use.layers.at(-1) ?? DEFAULT_PACK_ID;

/** 对照（设计规范 20.3）：包声明的 `extends` 所在的链按从下到上合并的结果。 */
export interface Compare {
  pack: KnowledgePack;
  /** 链上的包，从下到上。 */
  chain: Pack[];
  /** 「iztro-docs + 我的笔记」。 */
  label: string;
}

/** 包声明的 `extends` 所在的链（从下到上）：沿 `extends` 往下找，到默认包、不在本机的包、或回到走过的包为止。 */
export function extendsChain(raw: PackRaw, packs: readonly Pack[], defaultPack: Pack): Pack[] {
  const chain: Pack[] = [];
  const seen = new Set<string>();
  for (let id: string | null = typeof raw.extends === 'string' ? raw.extends : null; id !== null && !seen.has(id); ) {
    seen.add(id);
    if (id === DEFAULT_PACK_ID) {
      chain.unshift(defaultPack);
      break;
    }
    const p = packs.find((x) => x.id === id);
    if (!p) break;
    chain.unshift(p);
    id = p.extends;
  }
  return chain;
}

/** 对照：链合并后的结果。链为空（没声明、声明的包不在本机），或链上有过不了内核校验的包（「需要改」）时没有对照。 */
export function compareOf(kernel: Kernel, raw: PackRaw, packs: readonly Pack[], defaultPack: Pack): Compare | null {
  const chain = extendsChain(raw, packs, defaultPack);
  if (chain.length === 0) return null;
  let merged: KnowledgePack | null = null;
  try {
    for (const p of chain) {
      if (p.id === DEFAULT_PACK_ID) merged = merged ? merged.merged(builtinPack(kernel)) : builtinPack(kernel);
      else {
        if (!p.raw) throw new Error(`本机的包 ${p.id} 没有原文`);
        merged = merged ? merged.merged(p.raw) : kernel.KnowledgePack.fromObject(p.raw);
      }
    }
  } catch (err) {
    if (err instanceof kernel.IztroError) return null;
    throw err;
  }
  return { pack: merged!, chain, label: chain.map((p) => p.name).join(' + ') };
}

/** 一段里的一个条目（原文对象）；没有为 undefined。 */
export function entryOf(raw: PackRaw, e: EntryRef): Record<string, unknown> | undefined {
  const sec = raw[e.section];
  if (!isRecord(sec)) return undefined;
  const v = sec[e.key];
  return isRecord(v) ? v : undefined;
}

/** 对照里的一个条目（合并后的原文）。 */
export function compareEntry(compare: Compare | null, e: EntryRef): Record<string, unknown> | undefined {
  if (!compare) return undefined;
  return entryOf(compare.pack.toJSON(), e);
}

/** 去掉空的对象与数组字段，空了的条目与段一并去掉（不存空值，SCHEMA 不允许用空值表示「不改」）。 */
function prune(raw: PackRaw, e: EntryRef): PackRaw {
  const sec = isRecord(raw[e.section]) ? { ...(raw[e.section] as Record<string, unknown>) } : {};
  const entry = sec[e.key];
  if (isRecord(entry) && Object.keys(entry).length === 0) delete sec[e.key];
  const out = { ...raw };
  if (Object.keys(sec).length === 0) delete out[e.section];
  else out[e.section] = sec;
  return out;
}

/** 改一个条目：`edit` 收到条目原文的副本（没有时为空对象），返回新的条目；空条目会被去掉。 */
export function editEntry(raw: PackRaw, e: EntryRef, edit: (entry: Record<string, unknown>) => Record<string, unknown>): PackRaw {
  const sec = isRecord(raw[e.section]) ? { ...(raw[e.section] as Record<string, unknown>) } : {};
  const before = isRecord(sec[e.key]) ? structuredClone(sec[e.key] as Record<string, unknown>) : {};
  sec[e.key] = edit(before);
  return prune({ ...raw, [e.section]: sec }, e);
}

/** 设一个字段；`value` 为 undefined 时删掉这个字段（回到对照的原文或未写）。 */
export function setField(raw: PackRaw, e: EntryRef, field: string, value: unknown): PackRaw {
  return editEntry(raw, e, (entry) => {
    if (value === undefined) delete entry[field];
    else entry[field] = value;
    return entry;
  });
}

/** 设一个子字段（`attributes.yinYang`、`combinations.tanlangMaj`）；`value` 为 undefined 时删掉，空了的对象一并去掉。 */
export function setSubField(raw: PackRaw, e: EntryRef, field: string, sub: string, value: unknown): PackRaw {
  return editEntry(raw, e, (entry) => {
    const obj = isRecord(entry[field]) ? { ...(entry[field] as Record<string, unknown>) } : {};
    if (value === undefined) delete obj[sub];
    else obj[sub] = value;
    if (Object.keys(obj).length) entry[field] = obj;
    else delete entry[field];
    return entry;
  });
}

/** 删掉整条（撤销改写 / 删除这一条）。 */
export function removeEntry(raw: PackRaw, e: EntryRef): PackRaw {
  return editEntry(raw, e, () => ({}));
}

/**
 * 一个条目的状态：有对照时 `inherit`（本包没写，沿用）、`changed`（本包改写了对照里有的条目）、`added`（对照里没有、本包新增）；
 * 没有对照时 `written` 或 `unwritten`。
 */
export type EntryStatus = 'inherit' | 'changed' | 'added' | 'written' | 'unwritten';

export function entryStatus(raw: PackRaw, compare: Compare | null, e: EntryRef): EntryStatus {
  const own = entryOf(raw, e) !== undefined;
  if (!compare) return own ? 'written' : 'unwritten';
  if (!own) return 'inherit';
  return compareEntry(compare, e) ? 'changed' : 'added';
}

/** 本包写了几条（各段合计）。 */
export function writtenCount(raw: PackRaw): number {
  let n = 0;
  for (const s of ['stars', 'patterns', 'palaces', 'mutagens', 'concepts', 'topics'] as const) if (isRecord(raw[s])) n += Object.keys(raw[s]).length;
  return n;
}

/** 草稿与包库里的版本是否一致（新包永远不一致：还没进包库）。 */
export function sameAsLibrary(draft: Draft): boolean {
  return draft.snapshot !== null && JSON.stringify(draft.raw) === JSON.stringify(draft.snapshot);
}

/* ── 一张盘、一个主题用到的条目 ── */

export interface ListedEntry extends EntryRef {
  name: string;
  /** 所在宫（宫名）或段名，列表第二列。 */
  where: string;
}

export interface EntryGroup {
  id: string;
  /** 组名（界面文案的键）。 */
  kind: 'majors' | 'minors' | 'adjectives' | 'mutagens' | 'patterns' | 'palaces' | 'topic';
  entries: ListedEntry[];
}

/**
 * 按命宫起的宫序（命宫、兄弟、夫妻……父母）排的宫位索引。内核的十二宫名表从命宫起按另一个方向排（命宫、父母、福德……），
 * 命宫之后的部分倒过来即是。
 */
function palaceOrder(kernel: Kernel, chart: Astrolabe): number[] {
  const [soul, ...rest] = kernel.data.constants().palaces;
  return [soul!, ...rest.reverse()].map((key) => {
    const p = chart.palace(key);
    if (!p) throw new Error(`盘上没有 ${key}`);
    return p.index;
  });
}

/**
 * 一张盘用到的条目（设计规范 20.2「从一张盘开始」）：盘上的星（主星、辅星、杂耀，同一颗只算一次，按命宫起的宫序）、
 * 四化、命中的格局与十二宫。`only` 给出时只列这几宫（主题用）。
 */
export function chartEntries(kernel: Kernel, chart: Astrolabe, only?: readonly number[]): EntryGroup[] {
  const order = palaceOrder(kernel, chart).filter((i) => !only || only.includes(i));
  const seen = new Set<string>();
  const stars = (pick: (i: number) => readonly { key: string; name: string }[]): ListedEntry[] =>
    order.flatMap((i) =>
      pick(i)
        .filter((s) => !seen.has(s.key) && (seen.add(s.key), true))
        .map((s) => ({ section: 'stars' as const, key: s.key, name: s.name, where: chart.palaces[i]!.name })),
    );
  const majors = stars((i) => chart.palaces[i]!.majorStars);
  const minors = stars((i) => chart.palaces[i]!.minorStars);
  const adjectives = only ? [] : stars((i) => chart.palaces[i]!.adjectiveStars);
  const mutagenKeys = [kernel.Mutagen.LU, kernel.Mutagen.QUAN, kernel.Mutagen.KE, kernel.Mutagen.JI];
  const huaAt = new Map<string, number>();
  chart.palaces.forEach((p, i) => [...p.majorStars, ...p.minorStars].forEach((s) => s.mutagenKey && huaAt.set(s.mutagenKey, i)));
  const mutagens: ListedEntry[] = mutagenKeys
    .filter((k) => !only || (huaAt.has(k) && only.includes(huaAt.get(k)!)))
    .map((k) => ({ section: 'mutagens', key: k, name: kernel.i18n.translate(k, 'zh-CN') ?? k, where: '' }));
  const patterns: ListedEntry[] = [];
  for (const h of chart.patterns()) {
    if (only && !only.includes(h.palaceIndex) && !h.stars.some((s) => only.includes(s.palaceIndex))) continue;
    if (!patterns.some((x) => x.key === h.key)) patterns.push({ section: 'patterns', key: h.key, name: h.name, where: chart.palaces[h.palaceIndex]!.name });
  }
  const palaces: ListedEntry[] = order.map((i) => ({ section: 'palaces', key: chart.palaces[i]!.nameKey, name: chart.palaces[i]!.name, where: chart.palaces[i]!.earthlyBranch }));
  return [
    { id: 'majors', kind: 'majors', entries: majors },
    { id: 'minors', kind: 'minors', entries: minors },
    { id: 'adjectives', kind: 'adjectives', entries: adjectives },
    { id: 'mutagens', kind: 'mutagens', entries: mutagens },
    { id: 'patterns', kind: 'patterns', entries: patterns },
    { id: 'palaces', kind: 'palaces', entries: palaces },
  ].filter((g) => g.entries.length > 0) as EntryGroup[];
}

/** 读一个主题时用到的条目：主题本身、它选的宫位、这几宫的星，以及落在这几宫的格局与四化。 */
export function topicEntries(kernel: Kernel, chart: Astrolabe, topic: TopicEntry, palaces: readonly number[]): EntryGroup[] {
  const groups = chartEntries(kernel, chart, palaces);
  return [{ id: 'topic', kind: 'topic', entries: [{ section: 'topics', key: topic.slug, name: topic.title ?? topic.slug, where: '' }] }, ...groups];
}

/* ── 校验 ── */

/** 一处问题：内核的包格式问题或本机包库的规则。`at` 是它落在哪个条目与字段（包级问题为 null）。 */
export interface Problem {
  level: 'error' | 'warning';
  /** 内核的问题；本机包库的规则为 null。 */
  issue: KnowledgeIssue | null;
  library: LibraryProblem | null;
  at: { entry: EntryRef | null; field: string | null };
}

const SECTION_SET = new Set<string>(['stars', 'patterns', 'palaces', 'mutagens', 'concepts', 'topics']);

/** 问题落点：条目段下的路径落到条目与字段（`stars.ziweiMaj.combinations.tanlangMaj` 落到组合），其余是包级。 */
export function problemAt(path: readonly (string | number)[]): Problem['at'] {
  const [s, key, field, sub] = path;
  if (typeof s === 'string' && SECTION_SET.has(s) && typeof key === 'string') {
    const f = typeof field === 'string' ? (field === 'combinations' || field === 'combinationSummaries' ? `${field}.${String(sub ?? '')}` : field) : null;
    return { entry: { section: s as Section, key }, field: f };
  }
  return { entry: null, field: typeof s === 'string' ? s : null };
}

/**
 * 校验草稿：包格式交给内核（有对照时以对照为底一起查，摘要按合并后的条目判断），再加本机包库的规则
 * （编辑本机的包时，标识与它自己相同不算重复）。
 */
export function draftProblems(kernel: Kernel, draft: Draft, compare: Compare | null, packs: readonly Pack[], drafts: readonly Draft[]): Problem[] {
  const out: Problem[] = [];
  for (const p of libraryProblems(draft.raw, packs, draft.editing)) out.push({ level: 'error', issue: null, library: p, at: { entry: null, field: 'id' } });
  const id = typeof draft.raw.id === 'string' ? draft.raw.id : '';
  if (draft.editing === null && id && !idFree(id, packs, drafts, draft.id) && !out.length) out.push({ level: 'error', issue: null, library: { code: 'idTaken', id }, at: { entry: null, field: 'id' } });
  for (const issue of kernel.KnowledgePack.check(draft.raw, compare ? { base: compare.pack } : {})) out.push({ level: issue.level, issue, library: null, at: problemAt(issue.path) });
  return out;
}
