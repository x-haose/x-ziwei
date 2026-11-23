import { useEffect, useMemo } from 'react';
import { useToast } from '../components/toast';
import type { KnowledgeIssue, KnowledgePack } from 'x-iztro';
import type { Lang } from '../i18n/lang';
import { fmt, type Messages } from '../i18n/messages';
import type { Kernel } from '../kernel/kernel';
import { activePack, brokenPacks, builtinPack, defaultPackInfo } from './kernel-pack';
import { DEFAULT_USE, type Use, activeIds, withoutPacks } from './library';
import { KnowledgeMark } from './mark';
import * as css from './mark.css';
import { activePacks, provenance } from './parts';
import { type LibraryState, updateUse } from './use-library';

/** 排盘页释义用的包与提示词里的出处（「iztro-docs 2026-08-19 + my-notes 2026-11-20」）。 */
export interface ActiveKnowledge {
  pack: KnowledgePack;
  source: string;
}

/** 本机过不了内核校验的包（「需要改」）及其 error 级问题；内核或包库没就绪时为空。 */
export function useBrokenPacks(kernel: Kernel | null, lib: LibraryState): Map<string, KnowledgeIssue[]> {
  return useMemo(() => (kernel && lib.status === 'ready' ? brokenPacks(kernel, lib.packs) : new Map()), [kernel, lib]);
}

/**
 * 生效组合里有「需要改」的包时（旧版本里导入、现在过不了校验），按删包的规则把它们移出组合并写回，提示一句。
 * 它们留在本机，可以查看、导出、删除。
 */
export function useRetireBroken(lib: LibraryState, broken: ReadonlyMap<string, KnowledgeIssue[]>, t: Messages): void {
  const toast = useToast();
  useEffect(() => {
    if (lib.status !== 'ready' || broken.size === 0) return;
    const u = lib.use;
    const referenced = [...broken.keys()].filter((id) => u.stack.includes(id) || u.wholeStack.includes(id) || u.whole === id);
    if (referenced.length === 0) return;
    const names = referenced.map((id) => lib.packs.find((p) => p.id === id)?.name ?? id).join(t.knowledge.diff.sep);
    updateUse((now) => withoutPacks(now, referenced)).then(
      () => toast(fmt(t.knowledge.use.retired, { names })),
      (err: unknown) => {
        console.error(err);
        toast(fmt(t.knowledge.actionFailed, { reason: err instanceof Error ? err.message : String(err) }));
      },
    );
  }, [lib, broken, t, toast]);
}

/**
 * 按本机当前生效的组合合出释义用的包。分享链接不带知识包，打开别人的链接也用这台设备上的组合。
 * 「需要改」的包不参与（写回组合之前也不用）。本机包库还在读取时为 null；存储不可用或读库失败时只有默认包
 * （读库失败时标记下方写明原因）。
 */
export function useActiveKnowledge(kernel: Kernel | null, lib: LibraryState, broken: ReadonlyMap<string, KnowledgeIssue[]>): ActiveKnowledge | null {
  return useMemo(() => {
    if (!kernel || lib.status === 'loading') return null;
    const def = defaultPackInfo(kernel);
    if (lib.status !== 'ready') return { pack: builtinPack(kernel), source: provenance([def]) };
    const use = withoutPacks(lib.use, broken.keys());
    return { pack: activePack(kernel, use, lib.packs), source: provenance(activePacks(use, lib.packs, def)) };
  }, [kernel, lib, broken]);
}

/** 提示词区的释义标记，本机包库读取失败时下方写明原因。`onPick` 收到算新组合的函数与新组合名。 */
export function ChartKnowledgeMark({
  t,
  lang,
  kernel,
  lib,
  broken,
  onPick,
}: {
  t: Messages;
  lang: Lang;
  kernel: Kernel;
  lib: LibraryState;
  broken: ReadonlyMap<string, KnowledgeIssue[]>;
  onPick: (next: (use: Use) => Use, label: string) => void;
}) {
  const def = defaultPackInfo(kernel);
  const use = lib.status === 'ready' ? withoutPacks(lib.use, broken.keys()) : DEFAULT_USE;
  const packs = lib.status === 'ready' ? lib.packs.filter((p) => !broken.has(p.id)) : [];
  return (
    <div className={css.area}>
      <KnowledgeMark
        t={t}
        lang={lang}
        use={use}
        packs={packs}
        defaultPack={def}
        onPick={onPick}
      />
      {lib.status === 'failed' && (
        <p className={css.failed} role="alert">
          {fmt(t.chart.knowFailed, { reason: lib.message })}
        </p>
      )}
    </div>
  );
}

/** 读库时从组合里移出了不在本机的包（见 `Library.load`）：提示一句移出了哪些。 */
export function useRepairNotice(lib: LibraryState, t: Messages): void {
  const toast = useToast();
  useEffect(() => {
    if (lib.status === 'ready' && lib.repaired.length) toast(fmt(t.knowledge.use.repaired, { names: lib.repaired.join(t.knowledge.diff.sep) }));
  }, [lib, t, toast]);
}
