import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import type { Astrolabe } from 'x-iztro';
import { OptionGrid, Picker } from '../birth/picker';
import * as controls from '../components/controls.css';
import { Link } from 'react-aria-components';
import { useToast } from '../components/toast';
import { localePath } from '../i18n/lang';
import { fmt, type Messages } from '../i18n/messages';
import { useLang, useMessages } from '../i18n/use-lang';
import { type Kernel, loadKernel, useKernelState } from '../kernel/kernel';
import { useActiveKnowledge, useBrokenPacks } from '../knowledge/chart-knowledge';
import { builtinPack, defaultPackInfo } from '../knowledge/kernel-pack';
import { DEFAULT_PACK_ID, type Draft, type PackRaw, SECTIONS, type Section } from '../knowledge/library';
import { importedText } from '../knowledge/parts';
import { type LibraryState, useLibrary } from '../knowledge/use-library';
import { orderedTopics, topicPalaces } from '../chart/topic';
import { draftForPack, draftOnTop, editorHref, newDraft } from './actions';
import { type ChartChoice, useChartChoices } from './charts';
import * as css from './editor.css';
import { type EntryGroup, chartEntries, compareOf, entryStatus, sameAsLibrary, topLayer, topicEntries, writeTarget, writtenCount } from './model';
import { NewPackDialog } from './new-dialog';

/** 「写进」的一项：本机的包、还没进包库的新包草稿，或「新包（叠在生效组合最上面的包上）」。 */
type Into = { kind: 'pack'; id: string } | { kind: 'draft'; id: string } | { kind: 'new' };

const intoKey = (x: Into) => (x.kind === 'new' ? 'new' : `${x.kind}:${x.id}`);

/** 草稿的一行说明：还没进包库 / N 条改动没保存，上次编辑时间。 */
export function draftLine(d: Draft, t: Messages): string {
  const state = d.editing === null ? t.editor.draftNew : fmt(t.editor.draftDirty, { n: changedEntries(d) });
  return `${state}　${fmt(t.editor.draftWhen, { when: importedText(d.updatedAt) })}`;
}

/** 编辑本机包的草稿相对包库里那一版改了几条。 */
function changedEntries(d: Draft): number {
  if (!d.snapshot) return writtenCount(d.raw);
  let n = 0;
  for (const s of SECTIONS) {
    const a = (d.raw[s] ?? {}) as Record<string, unknown>;
    const b = (d.snapshot[s] ?? {}) as Record<string, unknown>;
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) n++;
  }
  return n;
}

/** 一组条目里本包写了几条。 */
function tally(groups: readonly EntryGroup[], raw: PackRaw, hasCompare: boolean, compare: Parameters<typeof entryStatus>[1]) {
  const all = groups.flatMap((g) => g.entries);
  const written = all.filter((e) => entryStatus(raw, compare, e) !== (hasCompare ? 'inherit' : 'unwritten')).length;
  return { n: all.length, written };
}

/**
 * 第一屏「写自己的释义」（设计规范 20.2）。带 `entry` 参数打开时（看盘的「改写这一条」）不显示第一屏：
 * 按「写进哪个包」的规则找到或新建草稿，直接换到编辑器的这一条。
 */
export function WritePage() {
  const t = useMessages();
  const kstate = useKernelState();
  const lib = useLibrary();
  useEffect(() => {
    loadKernel().catch(() => undefined);
  }, []);
  const kernel = kstate.status === 'ready' ? kstate.kernel : null;
  return (
    <main className={css.writePage}>
      <h1 className={css.writeTitle}>{t.editor.writeTitle}</h1>
      {kernel && lib.status === 'ready' ? (
        <WriteBody kernel={kernel} lib={lib} />
      ) : (
        <p className={css.hint}>
          {kstate.status === 'error' ? fmt(t.knowledge.kernelFailed, { reason: kstate.message }) : lib.status === 'ready' || lib.status === 'loading' ? t.knowledge.kernelLoading : t.knowledge.blockedTitle}
        </p>
      )}
    </main>
  );
}

function WriteBody({ kernel, lib }: { kernel: Kernel; lib: Extract<LibraryState, { status: 'ready' }> }) {
  const t = useMessages();
  const e = t.editor;
  const lang = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const { hash } = useLocation();
  const def = defaultPackInfo(kernel);
  const top = topLayer(lib.use);
  const broken = useBrokenPacks(kernel, lib);
  const active = useActiveKnowledge(kernel, lib, broken);
  const charts = useChartChoices(kernel, t);
  const [chartHash, setChartHash] = useState<string | null>(null);
  const choice: ChartChoice | undefined = charts.find((c) => c.hash === chartHash) ?? charts[0];
  const [dialog, setDialog] = useState<{ base: string | null } | null>(null);
  const busy = useRef(false);

  const fail = (err: unknown) => {
    console.error(err);
    toast(fmt(t.knowledge.actionFailed, { reason: err instanceof Error ? err.message : String(err) }));
  };

  /* 看盘的「改写这一条」：找到或建草稿，换到编辑器的这一条。 */
  const entry = params.get('entry');
  useEffect(() => {
    if (!entry || busy.current) return;
    busy.current = true;
    const [section, key] = entry.split('/');
    if (!section || !key || !(SECTIONS as readonly string[]).includes(section)) {
      busy.current = false;
      throw new Error(`改写入口的条目参数不对：${entry}`);
    }
    const target = writeTarget(top, lib.packs, lib.drafts);
    const ready = target.kind === 'draft' ? Promise.resolve(target.draft) : target.kind === 'edit' ? draftForPack(target.pack, lib.drafts) : draftOnTop(target.base, e.myPackName, lib.packs, lib.drafts);
    ready.then(
      (d) =>
        navigate(editorHref(lang, { draft: d.id, from: 'read', entry: { section: section as Section, key }, combo: params.get('combo') ?? undefined }, hash.replace(/^#/, '')), {
          replace: true,
        }),
      fail,
    );
  }, [entry]);

  const intos: { into: Into; label: string; sub: string }[] = useMemo(() => {
    const layerOf = (id: string) => lib.use.layers.indexOf(id);
    return [
      ...lib.packs.map((p) => ({
        into: { kind: 'pack' as const, id: p.id },
        label: p.name,
        sub: layerOf(p.id) >= 0 ? fmt(e.writeIntoLayer, { n: layerOf(p.id) + 1 }) : e.writeIntoIdle,
      })),
      ...lib.drafts.filter((d) => d.editing === null).map((d) => ({ into: { kind: 'draft' as const, id: d.id }, label: String((d.raw.source as { name?: string } | undefined)?.name ?? d.raw.id), sub: e.writeIntoDraft })),
      { into: { kind: 'new' as const }, label: fmt(e.writeIntoNew, { base: top === DEFAULT_PACK_ID ? def.name : (lib.packs.find((p) => p.id === top)?.name ?? top) }), sub: e.writeIntoNewNote },
    ];
  }, [lib, e, top, def]);
  const fallback: Into = (() => {
    const tgt = writeTarget(top, lib.packs, lib.drafts);
    if (tgt.kind === 'edit') return { kind: 'pack', id: tgt.pack.id };
    if (tgt.kind === 'draft') return tgt.draft.editing ? { kind: 'pack', id: tgt.draft.editing } : { kind: 'draft', id: tgt.draft.id };
    return { kind: 'new' };
  })();
  const [intoSel, setInto] = useState<string | null>(null);
  const into = intos.find((x) => intoKey(x.into) === intoSel)?.into ?? fallback;

  /* 写进的包此刻的原文与对照：新包是叠在最上面那一层上的空包。 */
  const intoRaw: PackRaw =
    into.kind === 'pack'
      ? (lib.drafts.find((d) => d.editing === into.id)?.raw ?? lib.packs.find((p) => p.id === into.id)!.raw!)
      : into.kind === 'draft'
        ? lib.drafts.find((d) => d.id === into.id)!.raw
        : { schema: 1, id: 'new', extends: top };
  const compare = useMemo(() => compareOf(kernel, intoRaw, lib.packs, def), [kernel, intoRaw, lib.packs, def]);
  const baseName = compare?.label ?? '';

  /** 进编辑器：先找到或建好写进的草稿。 */
  const open = (opts: { entry?: { section: Section; key: string }; scope?: 'chart' | 'all' | { topic: string } }) => {
    const ready =
      into.kind === 'draft'
        ? Promise.resolve(lib.drafts.find((d) => d.id === into.id)!)
        : into.kind === 'pack'
          ? draftForPack(lib.packs.find((p) => p.id === into.id)!, lib.drafts)
          : draftOnTop(top, e.myPackName, lib.packs, lib.drafts);
    ready.then((d) => navigate(editorHref(lang, { draft: d.id, from: 'write', ...opts }, choice?.hash ?? '')), fail);
  };

  if (entry) return null;

  const chart: Astrolabe | null = choice?.chart ?? null;
  const groups = chart ? chartEntries(kernel, chart) : [];
  const counts = tally(groups, intoRaw, compare !== null, compare);
  const majors = groups.find((g) => g.kind === 'majors')?.entries ?? [];
  const topics = active ? orderedTopics(active.pack) : orderedTopics(builtinPack(kernel));
  const intoInfo = intos.find((x) => intoKey(x.into) === intoKey(into))!;
  const resumable = lib.drafts.filter((d) => !sameAsLibrary(d));

  return (
    <>
      <div className={css.writeInto}>
        <span className={css.writeIntoLabel}>{e.writeInto}</span>
        <Picker label={e.writeInto} title={e.writeInto} width={360} placeholder="" value={intoInfo.label} triggerClass={css.writeIntoPicker}>
          {(close) => (
            <OptionGrid
              label={e.writeInto}
              columns={1}
              row
              autoFocus
              options={intos.map((x) => ({
                key: intoKey(x.into),
                text: x.label,
                content: (
                  <>
                    <b>{x.label}</b>
                    <small className={css.radioNote}>{x.sub}</small>
                  </>
                ),
              }))}
              selected={intoKey(into)}
              onSelect={(k) => {
                close();
                setInto(k);
              }}
            />
          )}
        </Picker>
      </div>
      {into.kind === 'new' && <p className={css.hint}>{e.writeNewHint}</p>}
      {into.kind === 'pack' && !lib.use.layers.includes(into.id) && <p className={css.hint}>{e.writeIdleHint}</p>}

      <div className={css.starts}>
        <section className={`${css.start} ${css.startFirst}`} aria-labelledby="start-chart">
          <h2 id="start-chart" className={css.startTitle}>
            {e.fromChart}
          </h2>
          {charts.length > 0 && (
            <ChartPicker t={t} charts={charts} value={choice?.hash ?? ''} onChange={setChartHash} />
          )}
          <p className={css.count}>
            {compare
              ? fmt(e.chartCount, { n: counts.n, changed: counts.written, rest: counts.n - counts.written, base: baseName })
              : fmt(e.chartCountNoBase, { n: counts.n, written: counts.written, rest: counts.n - counts.written })}
          </p>
          <p className={css.majorsTitle}>{e.chartMajors}</p>
          <div className={css.majors}>
            {majors.map((m) => {
              const st = entryStatus(intoRaw, compare, m);
              return (
                <button key={m.key} type="button" className={css.row} onClick={() => open({ entry: { section: m.section, key: m.key } })}>
                  <span className={css.rowName}>{m.name}</span>
                  <span className={css.rowWhere}>{m.where}</span>
                  <span className={st === 'changed' || st === 'added' || st === 'written' ? `${css.tag} ${css.tagOn}` : css.tag}>{e.status[st]}</span>
                </button>
              );
            })}
          </div>
          <button type="button" className={`${controls.ghost} ${css.wide}`} onClick={() => open({ scope: 'chart' })}>
            {fmt(e.byChart, { n: counts.n })}
          </button>
        </section>

        <section className={css.start} aria-labelledby="start-topic">
          <h2 id="start-topic" className={css.startTitle}>
            {e.fromTopic}
          </h2>
          <p className={css.count}>{e.fromTopicNote}</p>
          <div className={css.topicGrid}>
            {chart &&
              topics.map((tp) => {
                const g = topicEntries(kernel, chart, tp, topicPalaces(chart, tp)?.set ?? []);
                const c = tally(g, intoRaw, compare !== null, compare);
                return (
                  <button key={tp.slug} type="button" className={css.topicCell} onClick={() => open({ scope: { topic: tp.slug } })}>
                    <span className={css.topicName}>{tp.title ?? tp.slug}</span>
                    <span className={css.topicSub}>{fmt(e.topicCount, { n: c.n, changed: c.written })}</span>
                  </button>
                );
              })}
          </div>
        </section>

        <section className={css.start} aria-labelledby="start-blank">
          <h2 id="start-blank" className={css.startTitle}>
            {e.fromBlank}
          </h2>
          <button type="button" className={css.blankRow} onClick={() => setDialog({ base: null })}>
            <span className={css.blankName}>{e.blankNew}</span>
            <span className={css.blankNote}>{e.blankNewNote}</span>
          </button>
          <button type="button" className={css.blankRow} onClick={() => setDialog({ base: top })}>
            <span className={css.blankName}>{e.blankBased}</span>
            <span className={css.blankNote}>{e.blankBasedNote}</span>
          </button>
          <Link className={css.blankRow} href={localePath(lang, '/knowledge')}>
            <span className={css.blankName}>{e.blankImport}</span>
            <span className={css.blankNote}>{e.blankImportNote}</span>
          </Link>
          <button type="button" className={css.blankRow} onClick={() => open({ scope: 'all' })}>
            <span className={css.blankName}>{e.blankAll}</span>
            <span className={css.blankNote}>{e.blankAllNote}</span>
          </button>
          {resumable.length > 0 && (
            <>
              <p className={css.resumeTitle}>{e.resume}</p>
              {resumable.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={css.blankRow}
                  onClick={() => navigate(editorHref(lang, { draft: d.id, from: 'write' }, choice?.hash ?? ''))}
                >
                  <span className={css.blankName}>{String((d.raw.source as { name?: string } | undefined)?.name ?? d.raw.id)}</span>
                  <span className={css.blankNote}>{draftLine(d, t)}</span>
                </button>
              ))}
            </>
          )}
        </section>
      </div>
      {dialog && (
        <NewPackDialog
          t={t}
          packs={lib.packs}
          defaultPack={def}
          drafts={lib.drafts}
          base={dialog.base}
          onCancel={() => setDialog(null)}
          onStart={(raw) => {
            setDialog(null);
            newDraft(raw, null).then((d) => navigate(editorHref(lang, { draft: d.id, from: 'write' }, choice?.hash ?? '')), fail);
          }}
        />
      )}
    </>
  );
}

/** 盘的选择器：地址带来的盘、最近排过的与示例盘。 */
export function ChartPicker({ t, charts, value, onChange }: { t: Messages; charts: readonly ChartChoice[]; value: string; onChange: (hash: string) => void }) {
  const cur = charts.find((c) => c.hash === value) ?? charts[0];
  return (
    <Picker label={t.editor.chart} title={t.editor.chart} width={300} placeholder="" value={cur?.label ?? ''}>
      {(close) => (
        <OptionGrid
          label={t.editor.chart}
          columns={1}
          row
          autoFocus
          options={charts.map((c) => ({ key: c.hash, text: c.label, content: <b>{c.label}</b> }))}
          selected={cur?.hash ?? null}
          onSelect={(h) => {
            close();
            onChange(h);
          }}
        />
      )}
    </Picker>
  );
}

