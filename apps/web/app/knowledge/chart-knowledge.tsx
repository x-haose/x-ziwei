import { useMemo } from 'react';
import type { KnowledgePack } from 'x-iztro';
import type { Lang } from '../i18n/lang';
import { fmt, type Messages } from '../i18n/messages';
import type { Kernel } from '../kernel/kernel';
import { activePack, builtinPack, defaultPackInfo } from './kernel-pack';
import { DEFAULT_USE, type Use } from './library';
import { KnowledgeMark } from './mark';
import * as css from './mark.css';
import { activePacks, provenance, useLabel } from './parts';
import type { LibraryState } from './use-library';

/** 排盘页释义用的包与提示词里的出处（「iztro-docs 2026-08-19 + my-notes 2026-11-20」）。 */
export interface ActiveKnowledge {
  pack: KnowledgePack;
  source: string;
}

/**
 * 按本机当前生效的组合合出释义用的包。分享链接不带知识包，打开别人的链接也用这台设备上的组合。
 * 本机包库还在读取时为 null；存储不可用或读库失败时只有默认包（读库失败时标记下方写明原因）。
 */
export function useActiveKnowledge(kernel: Kernel | null, lib: LibraryState): ActiveKnowledge | null {
  return useMemo(() => {
    if (!kernel || lib.status === 'loading') return null;
    const def = defaultPackInfo(kernel);
    if (lib.status !== 'ready') return { pack: builtinPack(kernel), source: provenance([def]) };
    return { pack: activePack(kernel, lib.use, lib.packs), source: provenance(activePacks(lib.use, lib.packs, def)) };
  }, [kernel, lib]);
}

/** 提示词区的释义标记，本机包库读取失败时下方写明原因。`onPick` 收到新组合与它的组合名。 */
export function ChartKnowledgeMark({
  t,
  lang,
  kernel,
  lib,
  onPick,
}: {
  t: Messages;
  lang: Lang;
  kernel: Kernel;
  lib: LibraryState;
  onPick: (next: Use, label: string) => void;
}) {
  const def = defaultPackInfo(kernel);
  const use = lib.status === 'ready' ? lib.use : DEFAULT_USE;
  const packs = lib.status === 'ready' ? lib.packs : [];
  return (
    <div className={css.area}>
      <KnowledgeMark
        t={t}
        lang={lang}
        use={use}
        packs={packs}
        defaultPack={def}
        onPick={(next) => onPick(next, useLabel(activePacks(next, packs, def)))}
      />
      {lib.status === 'failed' && (
        <p className={css.failed} role="alert">
          {fmt(t.chart.knowFailed, { reason: lib.message })}
        </p>
      )}
    </div>
  );
}
