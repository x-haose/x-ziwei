import type { KnowledgeIssue, KnowledgePack } from 'x-iztro';
import type { Kernel } from '../kernel/kernel';
import { jsonErrorPosition } from './json-position';
import {
  DEFAULT_PACK_ID,
  type LibraryProblem,
  type Pack,
  type PackRaw,
  SECTIONS,
  type Section,
  type Use,
  describePack,
  libraryProblems,
} from './library';

/**
 * 交给排盘内核的部分：默认包、包格式的校验（x-iztro 0.9 的 `KnowledgePack.check`）、按生效组合合并出释义用的包。
 * 包格式的规则只在内核里，这里不另写一份。
 */

const builtins = new WeakMap<Kernel, KnowledgePack>();

/** 内核内嵌的默认包（只有 zh-CN）。同一个内核只解析一次。 */
export function builtinPack(kernel: Kernel): KnowledgePack {
  let p = builtins.get(kernel);
  if (!p) {
    p = kernel.KnowledgePack.builtin('zh-CN');
    builtins.set(kernel, p);
  }
  return p;
}

const defaultInfos = new WeakMap<Kernel, Pack>();

/** 默认包的包信息（不带原文；全文用 `builtinPack(kernel).toJSON()` 取）。 */
export function defaultPackInfo(kernel: Kernel): Pack {
  let p = defaultInfos.get(kernel);
  if (!p) {
    p = describePack(builtinPack(kernel).toJSON(), null);
    defaultInfos.set(kernel, p);
  }
  return p;
}

/**
 * 导入时的问题：文件本身、JSON 语法、内核校验出的问题（包格式）、本机包库的规则，
 * 以及只作提醒的 `extendsAbsent`（声明基于的包不在本机：照常导入，生效时没有它垫底）。
 */
export type ImportProblem =
  | { code: 'extendsAbsent'; target: string }
  | { code: 'notJsonFile' }
  | { code: 'tooLarge'; bytes: number }
  | { code: 'unreadable' }
  | { code: 'empty' }
  | { code: 'syntax'; line: number | null; column: number | null; detail: string }
  | { code: 'issue'; issue: KnowledgeIssue }
  | LibraryProblem;

/** 检查结果：`errors` 必须改，`warnings` 是提醒、不影响导入。 */
export type ImportCheck =
  | { ok: true; raw: PackRaw; warnings: ImportProblem[] }
  | { ok: false; errors: ImportProblem[]; warnings: ImportProblem[] };

/** JSON 文件最大 2 MB；默认包全文约 260 KB。 */
export const MAX_PACK_BYTES = 2 * 1024 * 1024;

/** 包的全文：本机包是导入的原文，默认包是内核内置的全文。 */
export function packRaw(kernel: Kernel, pack: Pack): PackRaw {
  return pack.raw ?? builtinPack(kernel).toJSON();
}

/** 本机一个包能否单独构造（过得了内核的校验）；过不了时为 null。 */
function tryPack(kernel: Kernel, raw: PackRaw): KnowledgePack | null {
  return kernel.KnowledgePack.check(raw).some((i) => i.level === 'error') ? null : kernel.KnowledgePack.fromObject(raw);
}

/** 不在生效组合里的包校验时用的底：它声明的 `extends`（默认包或本机的包，后者自己要过得了校验）；没有就不带底。 */
function declaredBase(kernel: Kernel, raw: PackRaw, packs: readonly Pack[]): KnowledgePack | null {
  const target = typeof raw.extends === 'string' ? raw.extends : null;
  if (target === null) return null;
  if (target === DEFAULT_PACK_ID) return builtinPack(kernel);
  const base = packs.find((p) => p.id === target)?.raw;
  return base ? tryPack(kernel, base) : null;
}

/** 在 `below` 之上叠一层（`below` 为 null 时这一层就是最下面）。 */
function stack(kernel: Kernel, below: KnowledgePack | null, layer: KnowledgePack | PackRaw): KnowledgePack {
  if (below) return below.merged(layer);
  return layer instanceof kernel.KnowledgePack ? layer : kernel.KnowledgePack.fromObject(layer);
}

/**
 * 包格式的检查，一律交给排盘内核的 `KnowledgePack.check`。`base` 是这个包下面的内容合并后的结果
 * （在生效组合里时是它下面各层，见 `brokenPacks`；不在组合里时是它声明的 `extends`），给出时另报相对它的提醒，
 * 摘要按合并后的条目判断。error 级必须改，warning 级是提醒。
 */
export function packIssues(kernel: Kernel, raw: unknown, base: KnowledgePack | null): KnowledgeIssue[] {
  return kernel.KnowledgePack.check(raw, base ? { base } : {});
}

/**
 * 校验要导入的 JSON 文本：先解析，再查本机包库的规则（`libraryProblems`）与包格式（`packIssues`）。
 * `packs` 是本机已有的包（不含默认包）。
 */
export function checkImport(kernel: Kernel, text: string, packs: readonly Pack[]): ImportCheck {
  if (text.trim() === '') return { ok: false, errors: [{ code: 'empty' }], warnings: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
    // JSON 语法错误由网页自己定位行列（内核对非法 JSON 只给出解析器的原话），不再交给内核重复报。
    const at = jsonErrorPosition(text);
    return { ok: false, errors: [{ code: 'syntax', line: at?.line ?? null, column: at?.column ?? null, detail: err.message }], warnings: [] };
  }
  const isObject = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
  // 新导入的包还不在生效组合里：按它声明的 extends 取底来查。
  const issues = packIssues(kernel, parsed, isObject ? declaredBase(kernel, parsed as PackRaw, packs) : null);
  const errors: ImportProblem[] = [];
  const warnings: ImportProblem[] = [];
  for (const issue of issues) (issue.level === 'error' ? errors : warnings).push({ code: 'issue', issue });
  // id 上内核已报了问题（缺失、类型不对等）时，本机包库的「缺少 id」不再重复列。
  const idReported = issues.some((i) => i.path.length === 1 && i.path[0] === 'id');
  const library = isObject ? libraryProblems(parsed as PackRaw, packs).filter((p) => !(p.code === 'idMissing' && idReported)) : [];
  errors.unshift(...library);
  const target = isObject && typeof (parsed as PackRaw).extends === 'string' ? ((parsed as PackRaw).extends as string) : null;
  if (target !== null && target !== DEFAULT_PACK_ID && !packs.some((p) => p.id === target)) warnings.unshift({ code: 'extendsAbsent', target });
  return errors.length ? { ok: false, errors, warnings } : { ok: true, raw: parsed as PackRaw, warnings };
}

/**
 * 本机每个包按 0.9 起的内核规则的 error 级问题（键为包标识）。在生效组合里的包以它下面各层（不含「需要改」的）合并后的结果为底来查，
 * 不在组合里的以它声明的 extends 为底（见 `packIssues`）。旧版本里导入、现在过不了校验的包「需要改」：可以查看、导出、删除，不能生效。
 */
export function brokenPacks(kernel: Kernel, packs: readonly Pack[], use: Use): Map<string, KnowledgeIssue[]> {
  const out = new Map<string, KnowledgeIssue[]>();
  let below: KnowledgePack | null = null;
  for (const id of use.layers) {
    if (id === DEFAULT_PACK_ID) {
      below = stack(kernel, below, builtinPack(kernel));
      continue;
    }
    const raw = packs.find((p) => p.id === id)?.raw;
    if (!raw) continue;
    const errors = packIssues(kernel, raw, below).filter((i) => i.level === 'error');
    if (errors.length) out.set(id, errors);
    else below = stack(kernel, below, raw);
  }
  for (const p of packs) {
    if (!p.raw || use.layers.includes(p.id)) continue;
    const errors = packIssues(kernel, p.raw, declaredBase(kernel, p.raw, packs)).filter((i) => i.level === 'error');
    if (errors.length) out.set(p.id, errors);
  }
  return out;
}

/**
 * 按生效组合合出释义用的包：从最下面一层起，按列表顺序逐层合并（排在后面的覆盖前面的）。
 * `packs` 是本机的包，组合须已通过 `checkUse`、且不含「需要改」的包。
 */
export function activePack(kernel: Kernel, use: Use, packs: readonly Pack[]): KnowledgePack {
  let merged: KnowledgePack | null = null;
  for (const id of use.layers) {
    if (id === DEFAULT_PACK_ID) {
      merged = stack(kernel, merged, builtinPack(kernel));
      continue;
    }
    const raw = packs.find((x) => x.id === id)?.raw;
    if (!raw) throw new Error(`生效组合里的 ${id} 不在本机`);
    merged = stack(kernel, merged, raw);
  }
  if (!merged) throw new Error('生效组合是空的');
  return merged;
}

/** 一段的覆盖度：有释义正文的条目数；`total` 是内核认识的标识数（术语、主题由包自定，为 null），`missing` 是缺释义的标识。 */
export interface SectionCoverage {
  have: number;
  total: number | null;
  missing: string[];
}

/** 内核认识的标识（星曜含各层流耀与四组十二神；宫位是十二宫，不含身宫、来因）。术语与主题由包起名，不在其中。 */
export function domains(kernel: Kernel): Partial<Record<Section, string[]>> {
  const values = (...objs: Record<string, string>[]) => [...new Set(objs.flatMap((o) => Object.values(o)))];
  const k = kernel;
  return {
    stars: values(k.MajorStar, k.MinorStar, k.AdjectiveStar, k.HoroscopeStar, k.Changsheng12, k.Boshi12, k.Suiqian12, k.Jiangqian12),
    patterns: values(k.PatternKey),
    palaces: values(k.PalaceName).filter((p) => p !== k.PalaceName.BODY && p !== k.PalaceName.ORIGINAL),
    mutagens: values(k.Mutagen),
  };
}

/** 合并后的包各段有多少条带释义正文，内核认识的标识里缺哪些。 */
export function coverage(kernel: Kernel, pack: KnowledgePack): Record<Section, SectionCoverage> {
  const json = pack.toJSON();
  const dom = domains(kernel);
  const out = {} as Record<Section, SectionCoverage>;
  for (const s of SECTIONS) {
    const entries = (typeof json[s] === 'object' && json[s] !== null ? json[s] : {}) as Record<string, { intro?: unknown }>;
    const withText = (k: string) => typeof entries[k]?.intro === 'string' && entries[k].intro !== '';
    const domain = dom[s];
    out[s] = domain
      ? { have: domain.filter(withText).length, total: domain.length, missing: domain.filter((k) => !withText(k)) }
      : { have: Object.keys(entries).filter(withText).length, total: null, missing: [] };
  }
  return out;
}
