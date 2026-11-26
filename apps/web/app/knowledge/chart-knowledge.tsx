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
import { activePacks, provenance, useLabel } from './parts';
import { type LibraryState, updateUse } from './use-library';

/** 排盘页释义用的包、提示词里的出处（「iztro-docs 2026-08-19 + my-notes 2026-11-20」）与组合名（「iztro-docs + 我的笔记」）。 */
export interface ActiveKnowledge {
  pack: KnowledgePack;
  source: string;
  label: string;
}

/** 本机过不了内核校验的包（「需要改」）及其 error 级问题；内核或包库没就绪时为空。 */
export function useBrokenPacks(kernel: Kernel | null, lib: LibraryState): Map<string, KnowledgeIssue[]> {
  return useMemo(() => (kernel && lib.status === 'ready' ? brokenPacks(kernel, lib.packs, lib.use) : new Map()), [kernel, lib]);
}

/** 本页已尝试写回移出的包组（排序后以换行连接）。放在模块里，组件重新挂载也不重复尝试。 */
const retireAttempts = new Set<string>();

/**
 * 生效组合里有「需要改」的包时（旧版本里导入、现在过不了校验），按删包的规则把它们移出组合并写回，提示一句。
 * 它们留在本机，可以查看、导出、删除。同一组包只尝试一次，失败时如实提示原因（释义照样不用它们，见 `useActiveKnowledge`）。
 */
export function useRetireBroken(lib: LibraryState, broken: ReadonlyMap<string, KnowledgeIssue[]>, t: Messages): void {
  const toast = useToast();
  useEffect(() => {
    if (lib.status !== 'ready' || broken.size === 0) return;
    const u = lib.use;
    const referenced = [...broken.keys()].filter((id) => u.layers.includes(id));
    if (referenced.length === 0) return;
    // 同一组包只写回一次：写回失败（如存满了）后库会重读、本 effect 会再跑，不能因此反复重试。
    const attempt = referenced.toSorted().join('\n');
    if (retireAttempts.has(attempt)) return;
    retireAttempts.add(attempt);
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
 * 「需要改」的包不参与（写回组合之前也不用）。提示词不等本机包库：库没读好时（读取中、存储不可用、读库失败、
 * 被别的标签页挡住或已被更新的版本接管）先用默认包，读好后按生效组合重算；用默认包的原因写在标记下方（见 `libraryNote`）。
 * 内核没装好时为 null。
 */
export function useActiveKnowledge(kernel: Kernel | null, lib: LibraryState, broken: ReadonlyMap<string, KnowledgeIssue[]>): ActiveKnowledge | null {
  return useMemo(() => {
    if (!kernel) return null;
    const def = defaultPackInfo(kernel);
    if (lib.status !== 'ready') return { pack: builtinPack(kernel), source: provenance([def]), label: useLabel([def]) };
    const use = withoutPacks(lib.use, broken.keys());
    const active = activePacks(use, lib.packs, def);
    return { pack: activePack(kernel, use, lib.packs), source: provenance(active), label: useLabel(active) };
  }, [kernel, lib, broken]);
}

/** 释义暂用默认包的原因（读库失败、被别的标签页挡住、已被更新的版本接管）；读取中、存储不可用与读好时为 null。 */
export function libraryNote(lib: LibraryState, t: Messages): string | null {
  if (lib.status === 'failed') return fmt(t.chart.knowFailed, { reason: lib.message });
  if (lib.status === 'blocked') return t.chart.knowBlocked;
  if (lib.status === 'superseded') return t.chart.knowSuperseded;
  return null;
}

/** 释义标记（对话面板里）或阅读页脚的「换一套释义」；标记形式在本机包库读取失败时下方写明原因。`onPick` 收到算新组合的函数与新组合名。 */
export function ChartKnowledgeMark({
  t,
  lang,
  kernel,
  lib,
  broken,
  trigger,
  onPick,
}: {
  t: Messages;
  lang: Lang;
  kernel: Kernel;
  lib: LibraryState;
  broken: ReadonlyMap<string, KnowledgeIssue[]>;
  /** 只放「换一套释义」触发钮（阅读页脚）；暂用默认包的说明由调用方按 `libraryNote` 另写。 */
  trigger?: { text: string; className: string };
  onPick: (next: (use: Use) => Use, label: string) => void;
}) {
  const def = defaultPackInfo(kernel);
  const note = libraryNote(lib, t);
  const use = lib.status === 'ready' ? withoutPacks(lib.use, broken.keys()) : DEFAULT_USE;
  const packs = lib.status === 'ready' ? lib.packs.filter((p) => !broken.has(p.id)) : [];
  if (trigger) return <KnowledgeMark t={t} lang={lang} use={use} packs={packs} defaultPack={def} trigger={trigger} onPick={onPick} />;
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
      {note && (
        <p className={css.failed} role="alert">
          {note}
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
