import { useMemo, useState } from 'react';
import type { Astrolabe, KnowledgePack } from 'x-iztro';
import { BRANCH_CELL, isBranch } from '../chart/layout';
import { Segmented } from '../components/segmented';
import { fmt, type Messages } from '../i18n/messages';
import type { Kernel } from '../kernel/kernel';
import { builtinPack } from '../knowledge/kernel-pack';
import { DEFAULT_PACK_ID, type Draft, type Pack, type PackRaw } from '../knowledge/library';
import { Markdown } from '../markdown/markdown';
import type { ChartChoice } from './charts';
import * as css from './editor.css';
import { entryName } from './entry-editor';
import { type Compare, type EntryRef, entryOf } from './model';
import { ChartPicker } from './write-page';

/** 预览用的合并（设计规范 20.9）：叠在当前生效上（编辑的包本来在组合里时用原位），或只用这个包。`order` 是实际合并的各层，从下到上。 */
function mergedFor(kernel: Kernel, raw: PackRaw, draft: Draft, layers: readonly string[], packs: readonly Pack[], only: boolean): { pack: KnowledgePack; order: string[] } {
  const own = draft.editing ?? '\u0000draft';
  if (only) return { pack: kernel.KnowledgePack.fromObject(raw), order: [own] };
  const list = layers.includes(own) ? [...layers] : [...layers, own];
  let merged: KnowledgePack | null = null;
  const order: string[] = [];
  for (const id of list) {
    const layer = id === own ? raw : id === DEFAULT_PACK_ID ? builtinPack(kernel) : packs.find((p) => p.id === id)?.raw;
    if (!layer) continue;
    order.push(id);
    merged = merged ? merged.merged(layer) : layer instanceof kernel.KnowledgePack ? layer : kernel.KnowledgePack.fromObject(layer);
  }
  if (!merged) throw new Error('预览的合并结果是空的');
  return { pack: merged, order };
}

/** 本命文本里的一段：标题行与它下面的段落（按空行分开）。 */
function blocks(text: string): { head: string; paras: string[] }[] {
  const out: { head: string; paras: string[] }[] = [];
  for (const chunk of text.split(/\n(?=#{2,3} )/)) {
    const [head = '', ...rest] = chunk.split('\n');
    out.push({ head: head.replace(/^#+\s*/, ''), paras: rest.join('\n').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) });
  }
  return out;
}

export function Preview({
  t,
  kernel,
  raw,
  draft,
  compare,
  entry,
  layers,
  packs,
  charts,
  chart,
  onChart,
}: {
  t: Messages;
  kernel: Kernel;
  raw: PackRaw;
  draft: Draft;
  compare: Compare | null;
  entry: EntryRef | null;
  /** 当前生效组合（不含「需要改」的包）。 */
  layers: readonly string[];
  packs: readonly Pack[];
  charts: readonly ChartChoice[];
  chart: ChartChoice | undefined;
  onChart: (hash: string) => void;
}) {
  const e = t.editor;
  const [mode, setMode] = useState<'stack' | 'only'>('stack');
  const [view, setView] = useState<'prompt' | 'full'>('prompt');
  const result = useMemo(() => {
    try {
      return mergedFor(kernel, raw, draft, layers, packs, mode === 'only');
    } catch (err) {
      if (err instanceof kernel.IztroError) return null;
      throw err;
    }
  }, [kernel, raw, draft, layers, packs, mode]);
  const merged = result?.pack ?? null;
  const ownId = draft.editing ?? '\u0000draft';
  const ownName = String((raw.source as { name?: string } | undefined)?.name ?? raw.id);
  // 说明行按实际合并的顺序写（编辑的包在组合里时在它原来的位置）。
  const stackLabel = (result?.order ?? []).map((id) => (id === ownId ? ownName : id === DEFAULT_PACK_ID ? 'iztro-docs' : (packs.find((p) => p.id === id)?.name ?? id))).join(' + ');
  const c: Astrolabe | undefined = chart?.chart;

  let content: React.ReactNode = null;
  if (!entry) content = null;
  else if (!merged) content = <p className={css.broken}>{e.previewInvalid}</p>;
  else if (view === 'full') {
    const full = entryOf(merged.toJSON(), entry);
    const own = entryOf(raw, entry);
    content = full ? (
      <div className={css.previewBox}>
        {Object.entries(full).map(([k, v]) => (
          <div key={k} className={css.para}>
            <p className={css.previewHead}>
              {(e.fields as Record<string, string>)[k] ?? k}
              {mode === 'stack' && own && k in own && <span className={css.own}>{e.previewOwn}</span>}
            </p>
            {typeof v === 'string' ? <Markdown source={v} variant="preview" /> : <pre className={css.json}>{JSON.stringify(v, null, 2)}</pre>}
          </div>
        ))}
      </div>
    ) : (
      <p className={css.missing}>{e.previewMissing}</p>
    );
  } else if (entry.section === 'palaces' || entry.section === 'concepts') content = <p className={css.previewNote}>{e.previewUseFull}</p>;
  else if (entry.section === 'topics' && c) {
    const topic = merged.topic(entry.key);
    const tp = topic && c.topicPalaces(topic.slug, { knowledge: merged });
    if (!topic) content = <p className={css.missing}>{e.previewMissing}</p>;
    else if (!tp?.groups.length) content = <p className={css.previewNote}>{t.read.noPalacesTitle}</p>;
    else {
      const kind = (i: number) => {
        const g = tp.groups.find((x) => x.target === i);
        if (g?.kind === 'surround') return 'main';
        if (tp.groups.some((x) => x.kind === 'surround' && [x.opposite, x.wealth, x.career].includes(i))) return 'around';
        if (g) return 'only';
        return undefined;
      };
      const list = tp.groups.map((g) => {
        const p = c.palaces[g.target]!;
        const where = fmt(e.previewWhere, { palace: p.name, branch: p.earthlyBranch });
        if (g.key === 'bodyPalace') return fmt(e.previewAt, { name: e.bodyPalace, where });
        if (g.key === 'originalPalace') return fmt(e.previewAt, { name: e.originalPalace, where });
        return g.kind === 'surround' ? fmt(e.previewAround, { where }) : where;
      });
      content = (
        <>
          <div className={css.miniBoard}>
            {c.palaces.map((p) => {
              const cell = isBranch(p.earthlyBranch) ? BRANCH_CELL[p.earthlyBranch] : null;
              return (
                <span key={p.index} className={css.miniCell} data-kind={kind(p.index)} style={cell ? { gridArea: `${cell[0] + 1} / ${cell[1] + 1}` } : undefined}>
                  {p.name}
                </span>
              );
            })}
            <span className={css.miniCentre}>
              {chart?.label}
              <br />
              {topic.title ?? topic.slug}
            </span>
          </div>
          <p className={css.previewNote}>{fmt(e.previewTopic, { list: list.join(e.previewSep) })}</p>
        </>
      );
    }
  } else if (c) {
    const on =
      entry.section === 'mutagens' ||
      (entry.section === 'stars' && c.palaces.some((p) => [...p.majorStars, ...p.minorStars, ...p.adjectiveStars].some((s) => s.key === entry.key))) ||
      (entry.section === 'patterns' && c.patterns().some((h) => h.key === entry.key));
    const name = entryName(kernel, raw, compare, entry);
    if (!on) {
      const has = (x: Astrolabe) =>
        entry.section === 'stars' ? x.palaces.some((p) => [...p.majorStars, ...p.minorStars, ...p.adjectiveStars].some((s) => s.key === entry.key)) : x.patterns().some((h) => h.key === entry.key);
      const others = charts.filter((x) => x.hash !== chart?.hash && has(x.chart));
      content = (
        <>
          <p className={css.previewNote}>{fmt(e.previewNotOnChart, { name })}</p>
          {others.length ? (
            <div className={css.tags}>
              {others.map((x) => (
                <button key={x.hash} type="button" className={css.chip} onClick={() => onChart(x.hash)}>
                  {x.label}
                </button>
              ))}
            </div>
          ) : (
            <p className={css.previewNote}>{e.previewUseFull}</p>
          )}
        </>
      );
    } else {
      let text: string | null = null;
      try {
        text = c.toText({ knowledge: merged, knowledgeDepth: 'summary' });
      } catch (err) {
        if (!(err instanceof kernel.IztroError)) throw err;
      }
      if (text === null) {
        const missing = kernel.KnowledgePack.check(merged.toJSON()).filter((i) => i.code === 'summary_missing');
        content = (
          <div className={css.broken}>
            <p>{e.previewBroken}</p>
            {missing.map((i) => (
              <span key={i.path.join('.')} className={css.issuePath}>
                {i.path.join('.')}
              </span>
            ))}
          </div>
        );
      } else {
        const palaceOf = entry.section === 'stars' ? c.palaces.find((p) => [...p.majorStars, ...p.minorStars, ...p.adjectiveStars].some((s) => s.key === entry.key)) : undefined;
        const all = blocks(text);
        const block =
          entry.section === 'stars'
            ? all.find((b) => palaceOf && b.head.startsWith(`${palaceOf.name} (`))
            : entry.section === 'patterns'
              ? all.find((b) => b.head === '格局')
              : all.find((b) => b.head === '四化释义');
        const isMine = (p: string) => p.startsWith(`**${name}`) || p.startsWith(`- **${name}`) || p.includes(`**化${name}`) || p.includes(`**${name}**`);
        content = block ? (
          <div className={css.previewBox}>
            <p className={css.previewHead}>{fmt(e.previewSegment, { segment: block.head })}</p>
            {block.paras
              .filter((p) => p.startsWith('**') || p.startsWith('- **') || p.startsWith('### ') || entry.section !== 'stars')
              .map((p, i) => (
                <div key={i} className={css.para} data-on={isMine(p) ? '' : undefined}>
                  <Markdown source={p} variant="preview" />
                  {isMine(p) && mode === 'stack' && entryOf(raw, entry) && <span className={css.own}>{e.previewOwn}</span>}
                </div>
              ))}
          </div>
        ) : (
          <p className={css.previewNote}>{fmt(e.previewNotOnChart, { name })}</p>
        );
      }
    }
  }

  return (
    <div>
      <Segmented
        label={e.preview}
        className={css.segmented}
        value={mode}
        options={[
          { value: 'stack', label: e.previewStack },
          { value: 'only', label: e.previewOnly },
        ]}
        onChange={setMode}
      />
      <Segmented
        label={e.preview}
        className={css.segmented}
        value={view}
        options={[
          { value: 'prompt', label: e.previewPrompt },
          { value: 'full', label: e.previewFull },
        ]}
        onChange={setView}
      />
      {charts.length > 0 && <ChartPicker t={t} charts={charts} value={chart?.hash ?? ''} onChange={onChart} />}
      <p className={css.previewNote}>{mode === 'stack' ? fmt(e.previewMerge, { packs: stackLabel }) : e.previewOnlyNote}</p>
      {content}
    </div>
  );
}
