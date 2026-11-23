import { type ImportProblem, MAX_PACK_BYTES, checkImport } from './kernel-pack';
import type { Pack, PackRaw } from './library';
import { LibraryConflictError, StorageFullError } from './store';

/**
 * 导入的流程与结果（不含界面）：读文本 → 大小上限 → 解析与校验 → 存入本机，逐步报告状态。
 */

/** 导入失败的原因：导入前的检查（`ImportProblem`）与写入本机时的失败。 */
export type Problem = ImportProblem | { code: 'full' } | { code: 'storage'; reason: string } | { code: 'unexpected'; reason: string };

/** 导入区的结果：导入中（第几步）、失败（逐条原因）、成功（导入的包）。 */
export type ImportState =
  | { phase: 'idle' }
  | { phase: 'busy'; file: string; step: 0 | 1 | 2 | 3 }
  | { phase: 'error'; file: string; errors: Problem[]; warnings: Problem[] }
  | { phase: 'done'; file: string; pack: Pack; warnings: Problem[] };

/** 选的文件本身的问题：不是 .json、超过 2 MB。 */
export function fileProblems(file: File): Problem[] {
  const out: Problem[] = [];
  if (!/\.json$/i.test(file.name) && file.type !== 'application/json') out.push({ code: 'notJsonFile' });
  if (file.size > MAX_PACK_BYTES) out.push({ code: 'tooLarge', bytes: file.size });
  return out;
}

/**
 * 导入一个包：读文本 → 解析与内核校验 → 本机包库的规则 → 存入本机，逐步更新导入区。
 * `save` 写入失败时（存满了或 IndexedDB 故障）结果区写明原因，库不变。
 */
export async function runImport({
  file,
  read,
  kernel,
  packs,
  save,
  onState,
}: {
  file: string;
  read: () => Promise<string>;
  kernel: Parameters<typeof checkImport>[0];
  packs: readonly Pack[];
  save: (raw: PackRaw) => Promise<Pack>;
  onState: (s: ImportState) => void;
}): Promise<void> {
  onState({ phase: 'busy', file, step: 0 });
  let text: string;
  try {
    text = await read();
  } catch (err) {
    console.error(err);
    onState({ phase: 'error', file, errors: [{ code: 'unreadable' }], warnings: [] });
    return;
  }
  // 粘贴的文本与选的文件同一上限，按 UTF-8 字节数计。
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > MAX_PACK_BYTES) {
    onState({ phase: 'error', file, errors: [{ code: 'tooLarge', bytes }], warnings: [] });
    return;
  }
  onState({ phase: 'busy', file, step: 1 });
  let checked: ReturnType<typeof checkImport>;
  try {
    checked = checkImport(kernel, text, packs);
  } catch (err) {
    // 校验本身没能跑完（如嵌套过深导致解析器或内核爆栈）：写明原因，不让导入区停在「校验中」。
    console.error(err);
    onState({ phase: 'error', file, errors: [{ code: 'unexpected', reason: err instanceof Error ? err.message : String(err) }], warnings: [] });
    return;
  }
  if (!checked.ok) {
    onState({ phase: 'error', file, errors: checked.errors, warnings: checked.warnings });
    return;
  }
  onState({ phase: 'busy', file, step: 3 });
  try {
    const pack = await save(checked.raw);
    onState({ phase: 'done', file, pack, warnings: checked.warnings });
  } catch (err) {
    if (err instanceof StorageFullError) {
      onState({ phase: 'error', file, errors: [{ code: 'full' }], warnings: checked.warnings });
      return;
    }
    if (err instanceof LibraryConflictError) {
      onState({ phase: 'error', file, errors: err.problems, warnings: checked.warnings });
      return;
    }
    console.error(err);
    onState({ phase: 'error', file, errors: [{ code: 'storage', reason: err instanceof Error ? err.message : String(err) }], warnings: checked.warnings });
  }
}

