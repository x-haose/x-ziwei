import type { KnowledgeIssue, KnowledgePack } from 'x-iztro';
import type { Kernel } from '../kernel/kernel';
import { jsonErrorPosition } from './json-position';
import {
  DEFAULT_PACK_ID,
  type LibraryProblem,
  type Pack,
  type PackRaw,
  type Use,
  activeIds,
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

/** 导入时的问题：文件本身、JSON 语法、内核校验出的问题（包格式）、本机包库的规则。 */
export type ImportProblem =
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

/**
 * 覆盖包校验时用的底包：默认包，或本机的独立整包（它本身过不了内核的校验时为 null，只校验这一份）。
 * 独立整包没有底包，为 null。
 */
function baseFor(kernel: Kernel, raw: PackRaw, packs: readonly Pack[]): KnowledgePack | null {
  const target = typeof raw.extends === 'string' ? raw.extends : null;
  if (target === null) return null;
  if (target === DEFAULT_PACK_ID) return builtinPack(kernel);
  const base = packs.find((p) => p.id === target && p.extends === null)?.raw;
  if (!base || kernel.KnowledgePack.check(base).some((i) => i.level === 'error')) return null;
  return kernel.KnowledgePack.fromObject(base);
}

/**
 * 包格式的检查，一律交给排盘内核的 `KnowledgePack.check`：覆盖包连同它的底包一起查（另报相对底包的提醒，
 * 摘要按合并后的条目判断）。error 级必须改，warning 级是提醒。
 */
export function packIssues(kernel: Kernel, raw: unknown, packs: readonly Pack[]): KnowledgeIssue[] {
  const isObject = typeof raw === 'object' && raw !== null && !Array.isArray(raw);
  const base = isObject ? baseFor(kernel, raw as PackRaw, packs) : null;
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
  const issues = packIssues(kernel, parsed, packs);
  const errors: ImportProblem[] = [];
  const warnings: ImportProblem[] = [];
  for (const issue of issues) (issue.level === 'error' ? errors : warnings).push({ code: 'issue', issue });
  const isObject = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
  // id 上内核已报了问题（缺失、类型不对等）时，本机包库的「缺少 id」不再重复列。
  const idReported = issues.some((i) => i.path.length === 1 && i.path[0] === 'id');
  const broken = new Set(brokenPacks(kernel, packs).keys());
  const library = isObject ? libraryProblems(parsed as PackRaw, packs, broken).filter((p) => !(p.code === 'idMissing' && idReported)) : [];
  errors.unshift(...library);
  return errors.length ? { ok: false, errors, warnings } : { ok: true, raw: parsed as PackRaw, warnings };
}

/**
 * 本机每个包按 0.9 起的内核规则的 error 级问题（键为包标识）。旧版本里导入、现在过不了校验的包「需要改」：
 * 可以查看、导出、删除，不能生效。
 */
export function brokenPacks(kernel: Kernel, packs: readonly Pack[]): Map<string, KnowledgeIssue[]> {
  const out = new Map<string, KnowledgeIssue[]>();
  for (const p of packs) {
    if (!p.raw) continue;
    const errors = packIssues(kernel, p.raw, packs).filter((i) => i.level === 'error');
    if (errors.length) out.set(p.id, errors);
  }
  return out;
}

/**
 * 按生效组合合出释义用的包：以底包（默认包或所选整包）为底，按顺序合并叠加的覆盖包。
 * `packs` 是本机的包，组合须已通过 `checkUse`。
 */
export function activePack(kernel: Kernel, use: Use, packs: readonly Pack[]): KnowledgePack {
  const raw = (id: string): PackRaw => {
    const p = packs.find((x) => x.id === id)?.raw;
    if (!p) throw new Error(`生效组合里的 ${id} 不在本机`);
    return p;
  };
  const [base, ...layers] = activeIds(use);
  if (base === undefined) throw new Error('生效组合没有底包');
  const basePack = base === DEFAULT_PACK_ID ? builtinPack(kernel) : kernel.KnowledgePack.fromObject(raw(base));
  return layers.length ? basePack.merged(...layers.map(raw)) : basePack;
}
