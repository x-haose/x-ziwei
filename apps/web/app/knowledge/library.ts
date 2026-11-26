/**
 * 本机知识包库的纯规则：包的元信息与条目数、生效组合（有序叠放的列表）、组合的增删移、
 * 一层相对下面各层的改动，以及本机包库自己的导入规则。包格式本身的校验与合并由排盘内核做（见 `kernel-pack.ts`）。
 */

/** 内核内嵌的默认包的标识。 */
export const DEFAULT_PACK_ID = 'iztro-docs';

/** 条目段，按界面上的顺序：星曜、格局、宫位、四化、术语、主题。 */
export const SECTIONS = ['stars', 'patterns', 'palaces', 'mutagens', 'concepts', 'topics'] as const;
export type Section = (typeof SECTIONS)[number];
export type Counts = Record<Section, number>;

/** 包的 JSON 原文（已通过内核读入）。 */
export type PackRaw = Record<string, unknown>;

/** 存在本机的包：原文与导入时间（毫秒时间戳）。 */
export interface StoredPack {
  id: string;
  raw: PackRaw;
  importedAt: number;
}

/** 列表与组合里用到的包信息。默认包的 `raw` 为 null（全文在内核里，见 `kernel-pack.ts`），`importedAt` 为 null。 */
export interface Pack {
  id: string;
  /** `source.name`，缺省时用 `id`。 */
  name: string;
  version: string | null;
  language: string | null;
  /** 包声明的 `extends`（建议叠在哪个包之上）；没有声明为 null。 */
  extends: string | null;
  counts: Counts;
  /** 各段的条目标识，算一层相对下面各层的改动用。 */
  keys: Record<Section, string[]>;
  license: string | null;
  author: string | null;
  raw: PackRaw | null;
  importedAt: number | null;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** 一段里的条目标识。 */
export function sectionKeys(raw: PackRaw, s: Section): string[] {
  const v = raw[s];
  return isRecord(v) ? Object.keys(v) : [];
}

/** 各段的条目数：段是对象时数它的键，没有这一段为 0。 */
export function sectionCounts(raw: PackRaw): Counts {
  const out = {} as Counts;
  for (const s of SECTIONS) out[s] = sectionKeys(raw, s).length;
  return out;
}

/** 由原文得出包信息。原文须已有字符串 `id`（本机包库的导入规则保证）。默认包传 `importedAt` 为 null，不留原文。 */
export function describePack(raw: PackRaw, importedAt: number | null): Pack {
  const id = str(raw.id);
  if (!id) throw new Error('包没有 id，不该进到本机包库');
  const source = isRecord(raw.source) ? raw.source : {};
  const keys = {} as Record<Section, string[]>;
  for (const s of SECTIONS) keys[s] = sectionKeys(raw, s);
  return {
    id,
    name: str(source.name) ?? id,
    version: str(raw.version),
    language: str(raw.language),
    extends: str(raw.extends),
    counts: sectionCounts(raw),
    keys,
    license: str(source.license),
    author: str(source.author),
    raw: importedAt === null ? null : raw,
    importedAt,
  };
}

/**
 * 生效组合：一个有序的包标识列表，从下到上叠放，排在后面的覆盖前面的（合并按列表顺序，由内核做）。
 * 默认包 `iztro-docs` 也是普通的一层，可以移出、放在任意位置；列表至少有一层。
 * 包的 `extends` 只是声明（建议放在所声明的包之上），不限制它能否生效、放在哪里。
 */
export interface Use {
  layers: string[];
}

export const DEFAULT_USE: Use = { layers: [DEFAULT_PACK_ID] };

/** 列表为空时退回只有默认包：释义总要有一套。 */
function nonEmpty(layers: string[]): Use {
  return { layers: layers.length ? layers : [...DEFAULT_USE.layers] };
}

/**
 * 核对组合：至少一层、不重复、每层是默认包或本机的包。组合与包库在同一个事务里改，对不上即是代码缺陷，直接报错。
 */
export function checkUse(use: Use, packs: readonly Pack[]): void {
  if (use.layers.length === 0) throw new Error('生效组合至少要有一层');
  if (new Set(use.layers).size !== use.layers.length) throw new Error(`生效组合里有重复的包：${use.layers.join(', ')}`);
  for (const id of use.layers) {
    if (id !== DEFAULT_PACK_ID && !packs.some((p) => p.id === id)) throw new Error(`生效组合里的 ${id} 不在本机`);
  }
}

/** 当前生效用到的包标识，按合并顺序（从下到上）。 */
export function activeIds(use: Use): string[] {
  return use.layers;
}

/** 删掉一个包之后的组合：从列表里去掉；列表空了退回默认包。 */
export function withoutPack(use: Use, id: string): Use {
  return nonEmpty(use.layers.filter((x) => x !== id));
}

/** 依次删掉几个包之后的组合（规则同 `withoutPack`）。 */
export function withoutPacks(use: Use, ids: Iterable<string>): Use {
  const gone = new Set(ids);
  return nonEmpty(use.layers.filter((x) => !gone.has(x)));
}

/** 把 `id` 下移（-1，往底下）或上移（1，往上面）一层；不在列表里或已到头时报错。 */
export function moveLayer(use: Use, id: string, dir: -1 | 1): Use {
  const layers = [...use.layers];
  const i = layers.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= layers.length) throw new Error(`生效组合里移不动 ${id}`);
  [layers[i], layers[j]] = [layers[j]!, layers[i]!];
  return { layers };
}

/** 从列表里移出一层；只剩这一层时报错（界面上不给这个动作）。 */
export function removeLayer(use: Use, id: string): Use {
  if (use.layers.length === 1 && use.layers[0] === id) throw new Error('生效组合至少要有一层');
  return { layers: use.layers.filter((x) => x !== id) };
}

/**
 * 把一个包放进列表的最上面：它声明的 `extends` 若已在组合里，自然就在它下面（「放在所声明的包上面」的建议因此满足）。
 * 已在列表里时不动。
 */
export function addLayer(use: Use, id: string): Use {
  return use.layers.includes(id) ? use : { layers: [...use.layers, id] };
}

/** 两个组合生效的包与顺序是否相同。 */
export function sameActive(a: Use, b: Use): boolean {
  return a.layers.join('\n') === b.layers.join('\n');
}

/**
 * 修复组合与包库对不上的地方（另一个标签页删了包等）：去掉不在本机或重复的层，空了退回默认包。
 * 返回修复后的组合与被移出的包标识（没有修复时为空）。
 */
export function repairUse(use: Use, packs: readonly Pack[]): { use: Use; dropped: string[] } {
  const dropped: string[] = [];
  const layers = use.layers.filter((id, i) => {
    const ok = (id === DEFAULT_PACK_ID || packs.some((p) => p.id === id)) && use.layers.indexOf(id) === i;
    if (!ok) dropped.push(id);
    return ok;
  });
  return { use: nonEmpty(layers), dropped: [...new Set(dropped)] };
}

/**
 * 旧版本存的组合（`{ mode, stack, whole, wholeStack }`，库版本 1、2）转成列表：叠加模式是默认包加它的叠加，
 * 整包模式是所选整包加它的叠加。两种模式里没在用的那一份选择不再保留。认不出的形状返回 null。
 */
export function migrateUse(old: unknown): Use | null {
  if (typeof old !== 'object' || old === null) return null;
  const o = old as Record<string, unknown>;
  const ids = (v: unknown): string[] | null => (Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null);
  if (o.mode === 'stack') {
    const stack = ids(o.stack);
    return stack ? { layers: [DEFAULT_PACK_ID, ...stack] } : null;
  }
  if (o.mode === 'whole' && typeof o.whole === 'string') {
    const wholeStack = o.wholeStack === undefined ? [] : ids(o.wholeStack);
    return wholeStack ? { layers: [o.whole, ...wholeStack] } : null;
  }
  return null;
}

/**
 * 一层的 `extends` 声明与它在组合里的位置对不上时的提醒：所声明的包不在本机（`absent`），
 * 或它在组合里但所声明的包不在它下面（`notBelow`）。没有声明或对得上时为 null。只是提醒，不影响生效。
 */
export type ExtendsAdvice = { kind: 'absent' | 'notBelow'; target: string } | null;

export function extendsAdvice(pack: Pick<Pack, 'id' | 'extends'>, use: Use, packs: readonly Pack[]): ExtendsAdvice {
  const target = pack.extends;
  if (target === null) return null;
  if (target !== DEFAULT_PACK_ID && !packs.some((p) => p.id === target)) return { kind: 'absent', target };
  const at = use.layers.indexOf(pack.id);
  if (at < 0) return null;
  return use.layers.slice(0, at).includes(target) ? null : { kind: 'notBelow', target };
}

/** 一层相对它下面各层的改动：同键条目算「改」，下面没有的键算「新增」。 */
export interface Diff {
  changed: Counts;
  added: Counts;
}

/** `below` 是这一层下面的各层（任意顺序）。 */
export function diffAgainst(layer: Pack, below: readonly Pack[]): Diff {
  const changed = {} as Counts;
  const added = {} as Counts;
  for (const s of SECTIONS) {
    const baseKeys = new Set(below.flatMap((p) => p.keys[s]));
    changed[s] = layer.keys[s].filter((k) => baseKeys.has(k)).length;
    added[s] = layer.keys[s].length - changed[s];
  }
  return { changed, added };
}

/** 本机包库对导入的包的规则，不涉及包格式（包格式交给内核）。 */
export type LibraryProblem = { code: 'idMissing' } | { code: 'idDefault' } | { code: 'idTaken'; id: string };

/**
 * 本机包库的导入规则：本机按 `id` 存包，`id` 必须是非空字符串且不与默认包、本机已有的包重复。
 * `extends` 不在这里管：它只是声明，所声明的包不在本机时导入照常，另给提醒（`extendsAdvice`）。
 */
export function libraryProblems(raw: PackRaw, packs: readonly Pack[]): LibraryProblem[] {
  const id = str(raw.id);
  if (!id) return [{ code: 'idMissing' }];
  if (id === DEFAULT_PACK_ID) return [{ code: 'idDefault' }];
  if (packs.some((p) => p.id === id)) return [{ code: 'idTaken', id }];
  return [];
}

/** 版本里 `+` 之后的构建信息（来源 commit）不进出处与摘要。 */
export function shortVersion(version: string | null): string | null {
  return version === null ? null : (version.split('+')[0] ?? version);
}
