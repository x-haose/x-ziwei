/**
 * 本机知识包库的纯规则：包的元信息与条目数、生效组合（叠加或整包）、组合的增删移、
 * 覆盖包相对底包的改动，以及本机包库自己的导入规则。包格式本身的校验与合并由排盘内核做（见 `kernel-pack.ts`）。
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
  /** 覆盖包所基于的包；独立整包为 null。 */
  extends: string | null;
  counts: Counts;
  /** 各段的条目标识，算覆盖包相对底包的改动用。 */
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
 * 生效组合。`mode` 为 stack 时在默认包上按 `stack` 的顺序叠加覆盖包（排在后面的覆盖前面的）；
 * 为 whole 时只用 `whole` 这一个独立整包。两种模式各自的选择都保留，来回切换不丢。
 */
export interface Use {
  mode: 'stack' | 'whole';
  stack: string[];
  whole: string;
}

export const DEFAULT_USE: Use = { mode: 'stack', stack: [], whole: DEFAULT_PACK_ID };

/** 能叠加在默认包上的覆盖包：`extends` 为默认包。 */
export function stackable(packs: readonly Pack[]): Pack[] {
  return packs.filter((p) => p.extends === DEFAULT_PACK_ID);
}

/** 本机的独立整包（不含默认包）。 */
export function wholes(packs: readonly Pack[]): Pack[] {
  return packs.filter((p) => p.extends === null);
}

/**
 * 核对组合引用的包都在本机且用法对得上：叠加里只有基于默认包的覆盖包、不重复；整包是默认包或本机的独立整包。
 * 组合与包库在同一个事务里改，对不上即是代码缺陷，直接报错。
 */
export function checkUse(use: Use, packs: readonly Pack[]): void {
  const byId = new Map(packs.map((p) => [p.id, p]));
  if (new Set(use.stack).size !== use.stack.length) throw new Error(`叠加里有重复的包：${use.stack.join(', ')}`);
  for (const id of use.stack) {
    const p = byId.get(id);
    if (!p || p.extends !== DEFAULT_PACK_ID) throw new Error(`叠加里的 ${id} 不是本机基于默认包的覆盖包`);
  }
  if (use.whole !== DEFAULT_PACK_ID) {
    const p = byId.get(use.whole);
    if (!p || p.extends !== null) throw new Error(`整包 ${use.whole} 不是本机的独立整包`);
  }
}

/** 当前生效用到的包标识，按合并顺序；第一个是底包。 */
export function activeIds(use: Use): string[] {
  return use.mode === 'stack' ? [DEFAULT_PACK_ID, ...use.stack] : [use.whole];
}

/** 删掉一个包之后的组合：从叠加里去掉；它是所选整包时改回默认包。 */
export function withoutPack(use: Use, id: string): Use {
  return { mode: use.mode, stack: use.stack.filter((x) => x !== id), whole: use.whole === id ? DEFAULT_PACK_ID : use.whole };
}

/** 叠加里第 `i` 个包前移（-1）或后移（1）。越界即是调用方的缺陷。 */
export function moveInStack(use: Use, i: number, dir: -1 | 1): Use {
  const j = i + dir;
  if (i < 0 || j < 0 || i >= use.stack.length || j >= use.stack.length) throw new Error(`叠加里移不动：${i} → ${j}`);
  const stack = [...use.stack];
  [stack[i], stack[j]] = [stack[j]!, stack[i]!];
  return { ...use, stack };
}

/** 改用一个包：覆盖包排到叠加末尾（已在叠加里则不动）并切到叠加；整包切到整包模式。 */
export function usePack(use: Use, pack: Pack): Use {
  if (pack.extends === DEFAULT_PACK_ID) {
    return { ...use, mode: 'stack', stack: use.stack.includes(pack.id) ? use.stack : [...use.stack, pack.id] };
  }
  if (pack.extends !== null) throw new Error(`${pack.id} 基于 ${pack.extends}，不能叠加在默认包上`);
  return { ...use, mode: 'whole', whole: pack.id };
}

/** 两个组合是否等价（生效的包与顺序相同）。 */
export function sameActive(a: Use, b: Use): boolean {
  return activeIds(a).join('\n') === activeIds(b).join('\n');
}

/** 覆盖包相对底包的改动：同键条目算「改」，底包没有的键算「新增」。 */
export interface Diff {
  changed: Counts;
  added: Counts;
}

export function diffAgainst(overlay: Pack, base: Pack): Diff {
  const changed = {} as Counts;
  const added = {} as Counts;
  for (const s of SECTIONS) {
    const baseKeys = new Set(base.keys[s]);
    changed[s] = overlay.keys[s].filter((k) => baseKeys.has(k)).length;
    added[s] = overlay.keys[s].length - changed[s];
  }
  return { changed, added };
}

/** 本机包库对导入的包的规则，不涉及包格式（包格式交给内核）。 */
export type LibraryProblem =
  | { code: 'idMissing' }
  | { code: 'idDefault' }
  | { code: 'idTaken'; id: string }
  | { code: 'extendsMissing'; target: string }
  | { code: 'extendsOverlay'; target: string };

/**
 * 本机包库的导入规则：本机按 `id` 存包，`id` 必须是非空字符串且不与默认包、本机已有的包重复；
 * 覆盖包只能基于独立整包，`extends` 指向的包必须在本机（或是默认包）且自己不是覆盖包。
 */
export function libraryProblems(raw: PackRaw, packs: readonly Pack[]): LibraryProblem[] {
  const out: LibraryProblem[] = [];
  const id = str(raw.id);
  if (!id) out.push({ code: 'idMissing' });
  else if (id === DEFAULT_PACK_ID) out.push({ code: 'idDefault' });
  else if (packs.some((p) => p.id === id)) out.push({ code: 'idTaken', id });
  const target = str(raw.extends);
  if (target !== null && target !== DEFAULT_PACK_ID) {
    const base = packs.find((p) => p.id === target);
    if (!base) out.push({ code: 'extendsMissing', target });
    else if (base.extends !== null) out.push({ code: 'extendsOverlay', target });
  }
  return out;
}

/** 版本里 `+` 之后的构建信息（来源 commit）不进出处与摘要。 */
export function shortVersion(version: string | null): string | null {
  return version === null ? null : (version.split('+')[0] ?? version);
}
