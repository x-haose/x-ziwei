import type { KnowledgePack } from 'x-iztro';
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
 * 交给排盘内核的部分：默认包、包格式的校验、按生效组合合并出释义用的包。
 * 包格式的规则只在内核里（x-iztro `KnowledgePack`），这里不另写一份。
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

/** 内核读不进或合并不了这个包时，内核给出的原因（英文原文）；能用时为 null。 */
function kernelRefusal(kernel: Kernel, run: () => unknown): string | null {
  try {
    run();
    return null;
  } catch (err) {
    if (err instanceof kernel.IztroError) return err.message;
    throw err;
  }
}

/** 导入时的问题：文件本身、JSON 语法、内核拒绝（包格式）、本机包库的规则。 */
export type ImportProblem =
  | { code: 'notJsonFile' }
  | { code: 'tooLarge'; bytes: number }
  | { code: 'unreadable' }
  | { code: 'empty' }
  | { code: 'syntax'; line: number | null; column: number | null; detail: string }
  | { code: 'kernel'; detail: string }
  | LibraryProblem;

/** 检查结果：`errors` 必须改，`warnings` 是提醒、不影响导入。 */
export type ImportCheck =
  | { ok: true; raw: PackRaw; warnings: ImportProblem[] }
  | { ok: false; errors: ImportProblem[]; warnings: ImportProblem[] };

/** 包格式的检查结果。 */
interface FormatFindings {
  errors: ImportProblem[];
  warnings: ImportProblem[];
}

/** JSON 文件最大 2 MB；默认包全文约 260 KB。 */
export const MAX_PACK_BYTES = 2 * 1024 * 1024;

/** 包的全文：本机包是导入的原文，默认包是内核内置的全文。 */
export function packRaw(kernel: Kernel, pack: Pack): PackRaw {
  return pack.raw ?? builtinPack(kernel).toJSON();
}

/**
 * 包格式的检查，一律交给排盘内核：读入（是否为对象、`schema`），再按它的底包合并一次（各段的结构与类型）。
 * x-iztro 0.8.0 只能在这两步拒绝（只报第一处、不带字段路径），没有提醒；内核提供逐条校验后换成它，
 * 返回的形状不变。底包不在本机或是覆盖包时不做合并检查（本机包库的规则会报出来）。
 */
function formatFindings(kernel: Kernel, parsed: unknown, packs: readonly Pack[]): FormatFindings {
  const read = kernelRefusal(kernel, () => kernel.KnowledgePack.fromObject(parsed as object));
  if (read !== null) return { errors: [{ code: 'kernel', detail: read }], warnings: [] };
  const raw = parsed as PackRaw;
  const target = typeof raw.extends === 'string' ? raw.extends : null;
  let merge: (() => unknown) | null = null;
  if (target === null) merge = () => kernel.KnowledgePack.fromObject(raw).merged();
  else if (target === DEFAULT_PACK_ID) merge = () => builtinPack(kernel).merged(raw);
  else {
    const base = packs.find((p) => p.id === target && p.extends === null)?.raw;
    if (base) merge = () => kernel.KnowledgePack.fromObject(base).merged(raw);
  }
  const refused = merge ? kernelRefusal(kernel, merge) : null;
  return { errors: refused === null ? [] : [{ code: 'kernel', detail: refused }], warnings: [] };
}

/**
 * 校验要导入的 JSON 文本：先解析，再查本机包库的规则（`libraryProblems`）与包格式（`formatFindings`）。
 * `packs` 是本机已有的包（不含默认包）。
 */
export function checkImport(kernel: Kernel, text: string, packs: readonly Pack[]): ImportCheck {
  if (text.trim() === '') return { ok: false, errors: [{ code: 'empty' }], warnings: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
    const at = jsonErrorPosition(text);
    return { ok: false, errors: [{ code: 'syntax', line: at?.line ?? null, column: at?.column ?? null, detail: err.message }], warnings: [] };
  }
  const isObject = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
  const format = formatFindings(kernel, parsed, packs);
  const errors = [...(isObject ? libraryProblems(parsed as PackRaw, packs) : []), ...format.errors];
  return errors.length ? { ok: false, errors, warnings: format.warnings } : { ok: true, raw: parsed as PackRaw, warnings: format.warnings };
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
