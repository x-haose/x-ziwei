import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { Link as RouterLink, useBlocker, useLocation, useNavigate, useSearchParams } from 'react-router';
import type { TopicEntry } from 'x-iztro';
import { orderedTopics, topicPalaces } from '../chart/topic';
import * as controls from '../components/controls.css';
import { CaretIcon, CloseIcon } from '../components/icons';
import { Segmented } from '../components/segmented';
import { useToast } from '../components/toast';
import { localePath } from '../i18n/lang';
import { fmt, type Messages } from '../i18n/messages';
import { useLang, useMessages } from '../i18n/use-lang';
import { type Kernel, loadKernel, useKernelState } from '../kernel/kernel';
import { useActiveKnowledge, useBrokenPacks } from '../knowledge/chart-knowledge';
import { problemText } from '../knowledge/import-panel';
import { builtinPack, defaultPackInfo } from '../knowledge/kernel-pack';
import * as kcss from '../knowledge/knowledge.css';
import { DEFAULT_PACK_ID, type Draft, type PackRaw, SECTIONS, type Section, withoutPacks } from '../knowledge/library';
import { importedText } from '../knowledge/parts';
import { StorageFullError } from '../lib/local-db';
import { downloadJson } from '../lib/download';
import { useMediaQuery } from '../lib/media';
import { type LibraryState, putDraft, saveDraft, updateUse, useLibrary } from '../knowledge/use-library';
import { addLayer } from '../knowledge/library';
import { media } from '../styles/media';
import { type EditorFrom, draftForPack, editorHref, newDraft } from './actions';
import { type ChartChoice, useChartChoices } from './charts';
import * as css from './editor.css';
import { EntryEditor, entryName, starCategory } from './entry-editor';
import {
  type Compare,
  type EntryRef,
  type ListedEntry,
  type Problem,
  chartEntries,
  compareOf,
  draftProblems,
  entryId,
  entryOf,
  entryStatus,
  extendsChain,
  setField,
  topicEntries,
  writtenCount,
} from './model';
import { PackInfo } from './pack-info';
import { Preview } from './preview';
import { ChartPicker } from './write-page';

/** 输入停这么久（毫秒）后存草稿（设计规范 20.11）。 */
const DRAFT_DELAY_MS = 700;
/** 输入停这么久后重新校验（设计规范 20.8）。 */
const CHECK_DELAY_MS = 180;

const timeText = (ms: number) => importedText(ms).split(' ')[1] ?? '';

type Scope = 'chart' | 'all' | { topic: string };

/** 编辑器（设计规范第 20 节）。草稿在本机包库所在的库里；内核与本机包库都就绪后才能编辑。 */
export function EditorPage() {
  const t = useMessages();
  const kstate = useKernelState();
  const lib = useLibrary();
  const [params] = useSearchParams();
  const lang = useLang();
  useEffect(() => {
    loadKernel().catch(() => undefined);
  }, []);
  const id = params.get('draft');
  const kernel = kstate.status === 'ready' ? kstate.kernel : null;
  if (!kernel || lib.status !== 'ready') {
    return (
      <main className={css.page}>
        <div className={css.empty}>
          <h1 className={css.emptyTitle}>{kstate.status === 'error' ? fmt(t.knowledge.kernelFailed, { reason: kstate.message }) : t.knowledge.kernelLoading}</h1>
          <p className={css.emptyBody}>{t.editor.kernelBody}</p>
        </div>
      </main>
    );
  }
  const draft = lib.drafts.find((d) => d.id === id);
  if (!draft) {
    return (
      <main className={css.page}>
        <div className={css.empty}>
          <h1 className={css.emptyTitle}>{t.editor.draftGone}</h1>
          <p className={css.emptyBody}>{t.editor.draftGoneBody}</p>
          <RouterLink className={controls.ghost} to={localePath(lang, '/knowledge')}>
            {t.editor.toKnowledge}
          </RouterLink>
        </div>
      </main>
    );
  }
  return <Editor key={draft.id} kernel={kernel} lib={lib} stored={draft} />;
}

type Ready = Extract<LibraryState, { status: 'ready' }>;

function Editor({ kernel, lib, stored }: { kernel: Kernel; lib: Ready; stored: Draft }) {
  const t = useMessages();
  const e = t.editor;
  const lang = useLang();
  const toast = useToast();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const [params, setParams] = useSearchParams();
  const from = (params.get('from') ?? 'knowledge') as EditorFrom;
  const def = defaultPackInfo(kernel);
  const xl = useMediaQuery('(min-width: 1360px)');
  const narrow = useMediaQuery(media.mDown);

  /* 草稿：本页编辑的是内存里的这一份，停 700ms 存进本机。 */
  const [raw, setRaw] = useState<PackRaw>(stored.raw);
  const [savedAt, setSavedAt] = useState<number>(stored.updatedAt);
  const [full, setFull] = useState(false);
  /** 刚保存到包库、之后还没改过。 */
  const [justSaved, setJustSaved] = useState(false);
  const draft: Draft = { ...stored, raw };
  const edit = (f: (r: PackRaw) => PackRaw) => {
    setJustSaved(false);
    setRaw((r) => f(r));
  };
  useEffect(() => {
    if (JSON.stringify(raw) === JSON.stringify(stored.raw)) return;
    const timer = setTimeout(() => {
      const at = Date.now();
      putDraft({ ...stored, raw, updatedAt: at }).then(
        () => {
          setFull(false);
          setSavedAt(at);
        },
        (err: unknown) => {
          if (err instanceof StorageFullError) setFull(true);
          else {
            console.error(err);
            toast(fmt(t.knowledge.actionFailed, { reason: err instanceof Error ? err.message : String(err) }));
          }
        },
      );
    }, DRAFT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [raw]);

  const compare: Compare | null = useMemo(() => compareOf(kernel, raw, lib.packs, def), [kernel, raw.extends, lib.packs, def]);
  const [problems, setProblems] = useState<Problem[]>(() => draftProblems(kernel, draft, compare, lib.packs, lib.drafts));
  useEffect(() => {
    const timer = setTimeout(() => setProblems(draftProblems(kernel, { ...stored, raw }, compare, lib.packs, lib.drafts)), CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [raw, compare, lib.packs, lib.drafts]);
  const errors = problems.filter((p) => p.level === 'error');
  const warnings = problems.filter((p) => p.level === 'warning');
  const inLibrary = lib.packs.find((p) => p.id === draft.editing);
  const synced = draft.snapshot !== null && JSON.stringify(raw) === JSON.stringify(draft.snapshot);
  const empty = writtenCount(raw) === 0 && draft.editing === null;

  /* 当前在看的条目、范围与盘。 */
  const entryParam = params.get('entry');
  const current: EntryRef | 'info' | null = entryParam === 'info' ? 'info' : entryParam ? { section: entryParam.split('/')[0] as Section, key: entryParam.split('/').slice(1).join('/') } : null;
  const select = (next: EntryRef | 'info') => {
    setParams(
      (p) => {
        const q = new URLSearchParams(p);
        q.set('entry', next === 'info' ? 'info' : entryId(next));
        q.delete('combo');
        return q;
      },
      { replace: true, preventScrollReset: true },
    );
    setScreen('entry');
  };
  const [screen, setScreen] = useState<'list' | 'entry'>(current ? 'entry' : 'list');
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, [entryParam]);
  const initialScope: Scope = params.get('scope') === 'all' ? 'all' : params.get('topic') ? { topic: params.get('topic')! } : 'chart';
  const [scope, setScope] = useState<Scope>(initialScope);
  const charts = useChartChoices(kernel, t);
  const [chartHash, setChartHash] = useState<string | null>(null);
  const chart: ChartChoice | undefined = charts.find((c) => c.hash === (chartHash ?? hash.replace(/^#/, ''))) ?? charts[0];
  const broken = useBrokenPacks(kernel, lib);
  const active = useActiveKnowledge(kernel, lib, broken);
  const layers = withoutPacks(lib.use, broken.keys()).layers;
  const topics = active ? orderedTopics(active.pack) : orderedTopics(builtinPack(kernel));
  const topic: TopicEntry | undefined = typeof scope === 'object' ? topics.find((x) => x.slug === scope.topic) : undefined;

  /* 右栏（≥1360）或抽屉（更窄）：预览与问题。 */
  const [panel, setPanel] = useState<'preview' | 'issues'>('preview');
  const [drawer, setDrawer] = useState(false);
  const openPanel = (p: 'preview' | 'issues') => {
    setPanel(p);
    if (!xl) setDrawer(true);
  };

  /* 保存到包库。 */
  const save = async (use: boolean): Promise<boolean> => {
    try {
      const snap = await saveDraft({ ...stored, raw }, use);
      setSavedAt(Date.now());
      setJustSaved(true);
      const id = String(raw.id);
      const name = String((raw.source as { name?: string } | undefined)?.name ?? id);
      toast(fmt(use ? e.savedUsedToast : snap.use.layers.includes(id) ? e.savedActiveToast : e.savedToast, { name }));
      return true;
    } catch (err) {
      console.error(err);
      toast(fmt(e.saveFailed, { reason: err instanceof Error ? err.message : String(err) }));
      return false;
    }
  };
  const file = `${String(raw.id)}-${String(raw.version ?? 'unversioned')}.json`;
  const exportJson = () => {
    downloadJson(raw, file);
    toast(errors.length ? fmt(e.exportedErrorsToast, { file, n: errors.length }) : fmt(e.exportedToast, { file }));
  };

  /* 离开（设计规范 20.12）：有还没进包库的改动、或草稿没能存下时拦下站内跳转，关页面时用浏览器自带的确认。 */
  const dirty = !synced || full;
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!dirty) return;
    const warn = (ev: BeforeUnloadEvent) => ev.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const backHref =
    from === 'read' ? `${localePath(lang, '/chart')}${hash}` : from === 'write' ? `${localePath(lang, '/knowledge/write')}${hash}` : localePath(lang, '/knowledge');
  const name = String((raw.source as { name?: string } | undefined)?.name ?? raw.id ?? '');
  const ext = typeof raw.extends === 'string' ? raw.extends : null;
  const baseText = compare ? fmt(e.basedOn, { name: compare.label }) : ext ? fmt(e.declaredOn, { id: ext }) : e.newPack;
  const status = full ? e.draftFull : synced ? (justSaved ? fmt(e.savedLibrary, { time: timeText(savedAt) }) : e.sameAsLibrary) : fmt(draft.editing ? e.savedDraftOld : e.savedDraft, { time: timeText(savedAt) });
  const canSave = errors.length === 0 && !empty;

  /* 左栏的条目。 */
  const listGroups = useMemo(() => {
    if (!chart || scope === 'all') return [];
    return topic ? topicEntries(kernel, chart.chart, topic, topicPalaces(chart.chart, topic).set) : chartEntries(kernel, chart.chart);
  }, [kernel, chart, scope, topic]);

  const problemOf = (x: EntryRef) => {
    const ps = problems.filter((p) => p.at.entry?.section === x.section && p.at.entry.key === x.key);
    return ps.some((p) => p.level === 'error') ? 'error' : ps.length ? 'warning' : null;
  };

  const center =
    current === 'info' ? (
      <PackInfo
        t={t}
        kernel={kernel}
        raw={raw}
        draft={draft}
        compare={compare}
        packs={lib.packs}
        problems={problems}
        edit={edit}
        onExport={exportJson}
        onSaveAsNew={() => {
          const copy = { ...structuredClone(raw), id: `${String(raw.id)}-2` };
          newDraft(copy, null).then(
            (d) => navigate(editorHref(lang, { draft: d.id, from, entry: 'info' }, hash.replace(/^#/, ''))),
            (err: unknown) => toast(fmt(t.knowledge.actionFailed, { reason: err instanceof Error ? err.message : String(err) })),
          );
        }}
      />
    ) : current ? (
      <EntryEditor key={entryId(current)} t={t} kernel={kernel} raw={raw} compare={compare} entry={current} problems={problems} combo={params.get('combo') ?? undefined} edit={edit} titleRef={titleRef} />
    ) : (
      <div className={css.empty}>
        <h2 className={css.emptyTitle} ref={titleRef} tabIndex={-1}>
          {compare ? e.emptyBased : e.emptyNew}
        </h2>
        <p className={css.emptyBody}>{compare ? fmt(e.emptyBasedNote, { base: compare.label }) : e.emptyNewNote}</p>
        <div className={css.tags} style={{ marginTop: 12 }}>
          {(compare
            ? [
                { section: 'stars' as const, key: kernel.MajorStar.ZIWEI },
                { section: 'patterns' as const, key: kernel.PatternKey.FU_XIANG_CHAO_YUAN },
                ...topics.slice(0, 1).map((x) => ({ section: 'topics' as const, key: x.slug })),
              ]
            : [
                { section: 'stars' as const, key: kernel.MajorStar.ZIWEI },
                { section: 'mutagens' as const, key: kernel.Mutagen.LU },
              ]
          ).map((x) => (
            <button key={entryId(x)} type="button" className={css.chip} onClick={() => select(x)}>
              {entryName(kernel, raw, compare, x)}
            </button>
          ))}
          {!compare && (
            <button type="button" className={css.chip} onClick={() => select('info')}>
              {e.packInfo}
            </button>
          )}
        </div>
      </div>
    );

  const issuesList = (
    <IssueList
      t={t}
      kernel={kernel}
      raw={raw}
      compare={compare}
      problems={problems}
      onPick={(p) => {
        if (p.at.entry) select(p.at.entry);
        else select('info');
        setDrawer(false);
        requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-field="${p.at.field ?? ''}"] textarea, [data-field="${p.at.field ?? ''}"] input`)?.focus());
      }}
    />
  );
  const previewEl = (
    <Preview
      t={t}
      kernel={kernel}
      raw={raw}
      draft={draft}
      compare={compare}
      entry={current && current !== 'info' ? current : null}
      layers={layers}
      packs={lib.packs}
      charts={charts}
      chart={chart}
      onChart={setChartHash}
    />
  );
  const panelEl = (
    <>
      <div className={css.panelTabs} role="tablist" aria-label={e.preview}>
        <button type="button" role="tab" aria-selected={panel === 'preview'} className={css.tab} onClick={() => setPanel('preview')}>
          {e.preview}
        </button>
        <button type="button" role="tab" aria-selected={panel === 'issues'} className={css.tab} onClick={() => setPanel('issues')}>
          {`${e.issuesTitle} ${problems.length}`}
        </button>
      </div>
      {panel === 'preview' ? previewEl : issuesList}
    </>
  );

  return (
    <main className={css.page}>
      <header className={css.bar}>
        <RouterLink className={css.back} to={backHref}>
          {e.back[from]}
        </RouterLink>
        <span className={css.barName}>{name}</span>
        <span className={css.barId}>{String(raw.id ?? '')}</span>
        <span className={css.barBase}>{baseText}</span>
        <span className={css.barSpace} />
        <span className={full ? `${css.barStatus} ${css.barStatusBad}` : css.barStatus} role="status">
          {status}
        </span>
        <button type="button" className={`${controls.ghost} ${css.issuesButton}`} aria-label={fmt(e.issuesLabel, { e: errors.length, w: warnings.length })} onClick={() => openPanel('issues')}>
          {narrow ? (
            fmt(e.issuesShort, { n: problems.length })
          ) : (
            <>
              <span className={errors.length ? css.issuesError : undefined}>{fmt(e.issuesErrorCount, { n: errors.length })}</span>
              <span>{fmt(e.issuesWarningCount, { n: warnings.length })}</span>
            </>
          )}
        </button>
        {!xl && (
          <button type="button" className={`${controls.ghost} ${css.barButton}`} onClick={() => openPanel('preview')}>
            {e.preview}
          </button>
        )}
        {!narrow && (
          <button type="button" className={`${controls.ghost} ${css.barButton}`} onClick={exportJson}>
            {e.exportJson}
          </button>
        )}
        <button type="button" className={`${controls.button} ${css.barButton}`} disabled={!canSave} onClick={() => void save(false)}>
          {e.save}
        </button>
        {!canSave && <p className={css.barNote}>{errors.length ? fmt(e.saveBlockedErrors, { n: errors.length }) : e.saveBlockedEmpty}</p>}
        {synced && inLibrary && !lib.use.layers.includes(inLibrary.id) && (
          <p className={css.barNote}>
            {e.notInUse}{' '}
            <button
              type="button"
              className={css.textButton}
              onClick={() =>
                updateUse((u) => addLayer(u, inLibrary.id)).catch((err: unknown) => toast(fmt(t.knowledge.actionFailed, { reason: err instanceof Error ? err.message : String(err) })))
              }
            >
              {e.addToUse}
            </button>
          </p>
        )}
      </header>
      {draft.editing === null && from === 'read' && compare && (
        <div className={css.strip} role="status">
          <span className={css.stripText}>{fmt(e.newPackNote, { name, id: String(raw.id), base: compare.label })}</span>
          <button type="button" className={css.textButton} onClick={() => select('info')}>
            {e.renamePack}
          </button>
        </div>
      )}
      {ext !== null && !compare && ext !== DEFAULT_PACK_ID && !lib.packs.some((p) => p.id === ext) && (
        <div className={css.strip} role="status">
          <span className={css.stripText}>{fmt(e.compareAbsent, { id: ext })}</span>
          <button type="button" className={css.textButton} onClick={() => edit((r) => ({ ...r, extends: DEFAULT_PACK_ID }))}>
            {e.compareToDefault}
          </button>
        </div>
      )}
      {extendsChain(raw, lib.packs, def)
        .filter((p) => broken.has(p.id))
        .map((p) => (
          <div key={p.id} className={css.strip} role="status">
            <span className={css.stripText}>{fmt(e.compareBroken, { name: p.name, n: broken.get(p.id)!.length })}</span>
            <button
              type="button"
              className={css.textButton}
              onClick={() =>
                draftForPack(p, lib.drafts).then(
                  (d) => navigate(editorHref(lang, { draft: d.id, from: 'knowledge' }, hash.replace(/^#/, ''))),
                  (err: unknown) => toast(fmt(t.knowledge.actionFailed, { reason: err instanceof Error ? err.message : String(err) })),
                )
              }
            >
              {fmt(e.editBroken, { name: p.name })}
            </button>
          </div>
        ))}
      <div className={css.body}>
        <aside className={narrow && screen === 'entry' ? `${css.side} ${css.hiddenNarrow}` : css.side} aria-label={e.entries}>
          <Segmented<string>
            label={e.scopeLabel}
            className={css.segmented}
            value={scope === 'all' ? 'all' : typeof scope === 'object' ? `topic:${scope.topic}` : 'chart'}
            options={[
              { value: 'chart', label: e.scopeChart },
              ...(typeof initialScope === 'object' && topic ? [{ value: `topic:${topic.slug}`, label: topic.title ?? topic.slug }] : []),
              { value: 'all', label: e.scopeAll },
            ]}
            onChange={(v) => setScope(v === 'all' ? 'all' : v.startsWith('topic:') ? { topic: v.slice(6) } : 'chart')}
          />
          <button type="button" className={css.info} aria-current={current === 'info'} onClick={() => select('info')}>
            <span className={css.infoName}>{e.packInfo}</span>
            <span className={css.infoSub}>{`${String(raw.id ?? '')}　${String(raw.version ?? '')}`}</span>
          </button>
          {scope === 'all' ? (
            <AllEntries t={t} kernel={kernel} raw={raw} compare={compare} current={current} problemOf={problemOf} onSelect={select} edit={edit} />
          ) : (
            <ChartList
              t={t}
              charts={charts}
              chart={chart}
              onChart={setChartHash}
              groups={listGroups}
              topic={topic}
              raw={raw}
              compare={compare}
              current={current}
              problemOf={problemOf}
              onSelect={select}
            />
          )}
        </aside>
        <section className={narrow && screen === 'list' ? css.hiddenNarrow : undefined} aria-label={e.entries}>
          {narrow && current && (
            <button type="button" className={css.textButton} onClick={() => setScreen('list')}>
              {fmt(e.backToList, { section: current === 'info' ? e.packInfo : t.knowledge.sections[current.section] })}
            </button>
          )}
          {center}
        </section>
        {xl && <aside className={css.right}>{panelEl}</aside>}
      </div>
      {drawer && !xl && (
        <ModalOverlay isOpen isDismissable onOpenChange={(o) => !o && setDrawer(false)} className={kcss.scrim}>
          <Modal>
            <Dialog className={css.drawer} aria-label={panel === 'preview' ? e.preview : e.issuesTitle}>
              <div className={css.drawerHead}>
                <span />
                <Button className={css.iconButton} aria-label={e.closePanel} onPress={() => setDrawer(false)}>
                  <CloseIcon />
                </Button>
              </div>
              {panelEl}
            </Dialog>
          </Modal>
        </ModalOverlay>
      )}
      {blocker.state === 'blocked' && (
        <LeaveDialog
          t={t}
          draft={draft}
          name={name}
          time={timeText(savedAt)}
          errors={errors.length}
          full={full}
          toChart={from === 'read' && (blocker.location.pathname.endsWith('/chart'))}
          onStay={() => blocker.reset()}
          onLeave={() => blocker.proceed()}
          onExport={exportJson}
          onSave={(use) =>
            save(use).then((ok) => {
              if (ok) blocker.proceed();
              else blocker.reset();
            })
          }
        />
      )}
    </main>
  );
}

/** 一行条目：名称、所在宫或段名、问题点、状态。 */
function EntryRow({ t, item, raw, compare, current, problem, onSelect }: { t: Messages; item: ListedEntry; raw: PackRaw; compare: Compare | null; current: EntryRef | 'info' | null; problem: 'error' | 'warning' | null; onSelect: (e: EntryRef) => void }) {
  const st = entryStatus(raw, compare, item);
  const on = current !== null && current !== 'info' && current.section === item.section && current.key === item.key;
  return (
    <button type="button" className={css.row} aria-current={on} onClick={() => onSelect(item)}>
      <span className={css.rowName}>{item.name}</span>
      <span className={css.rowWhere}>{item.where}</span>
      {problem && <span className={`${css.dot} ${problem === 'error' ? css.dotError : css.dotWarning}`} aria-label={problem === 'error' ? t.editor.problemError : t.editor.problemWarning} role="img" />}
      <span className={st === 'inherit' || st === 'unwritten' ? css.tag : `${css.tag} ${css.tagOn}`}>{t.editor.statusShort[st]}</span>
    </button>
  );
}

function Group({ title, count, open, onToggle, children }: { title: string; count: number; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div>
      <button type="button" className={css.groupHead} aria-expanded={open} onClick={onToggle}>
        <span>{title}</span>
        <span>
          {count}{' '}
          <span className={css.caret}>
            <CaretIcon />
          </span>
        </span>
      </button>
      {open && children}
    </div>
  );
}

/** 左栏「这张盘 / 这个主题」：盘、计数、筛选、按组列条目（设计规范 20.6）。 */
function ChartList({
  t,
  charts,
  chart,
  onChart,
  groups,
  topic,
  raw,
  compare,
  current,
  problemOf,
  onSelect,
}: {
  t: Messages;
  charts: readonly ChartChoice[];
  chart: ChartChoice | undefined;
  onChart: (h: string) => void;
  groups: ReturnType<typeof chartEntries>;
  topic: TopicEntry | undefined;
  raw: PackRaw;
  compare: Compare | null;
  current: EntryRef | 'info' | null;
  problemOf: (e: EntryRef) => 'error' | 'warning' | null;
  onSelect: (e: EntryRef) => void;
}) {
  const e = t.editor;
  const [filter, setFilter] = useState<'all' | 'rest' | 'done'>('all');
  const inCurrent = (g: (typeof groups)[number]) => current !== null && current !== 'info' && g.entries.some((x) => x.section === current.section && x.key === current.key);
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set(groups.filter((g) => g.kind === 'adjectives' && !inCurrent(g)).map((g) => g.id)));
  const all = groups.flatMap((g) => g.entries);
  const done = (x: EntryRef) => {
    const st = entryStatus(raw, compare, x);
    return st !== 'inherit' && st !== 'unwritten';
  };
  const n = all.length;
  const d = all.filter(done).length;
  const keep = (x: EntryRef) => filter === 'all' || (filter === 'done') === done(x);
  return (
    <>
      {charts.length > 0 && <ChartPicker t={t} charts={charts} value={chart?.hash ?? ''} onChange={onChart} />}
      <p className={css.count}>
        {topic
          ? fmt(e.listCountTopic, { topic: topic.title ?? topic.slug, n, changed: d })
          : compare
            ? fmt(e.listCount, { n, changed: d, rest: n - d, base: compare.label })
            : fmt(e.listCountNoBase, { n, written: d, rest: n - d })}
      </p>
      <div className={css.progress} aria-hidden="true">
        <span className={css.progressFill} style={{ width: n ? `${(d / n) * 100}%` : 0 }} />
      </div>
      <Segmented
        label={e.filterLabel}
        className={css.segmented}
        value={filter}
        options={[
          { value: 'all', label: e.filterAll },
          { value: 'rest', label: fmt(compare ? e.filterInherit : e.filterUnwritten, { n: n - d }) },
          { value: 'done', label: fmt(compare ? e.filterChanged : e.filterWritten, { n: d }) },
        ]}
        onChange={setFilter}
      />
      {groups.map((g) => {
        const items = g.entries.filter(keep);
        if (!items.length) return null;
        return (
          <Group
            key={g.id}
            title={e.groups[g.kind]}
            count={g.entries.length}
            open={!closed.has(g.id) || filter !== 'all'}
            onToggle={() =>
              setClosed((c) => {
                const next = new Set(c);
                if (next.has(g.id)) next.delete(g.id);
                else next.add(g.id);
                return next;
              })
            }
          >
            {items.map((x) => (
              <EntryRow key={entryId(x)} t={t} item={x} raw={raw} compare={compare} current={current} problem={problemOf(x)} onSelect={onSelect} />
            ))}
          </Group>
        );
      })}
    </>
  );
}

/** 一段里内核认识的标识（术语与主题由包起名：取对照与本包里有的）。 */
function sectionItems(kernel: Kernel, raw: PackRaw, compare: Compare | null, s: Section): ListedEntry[] {
  const k = kernel;
  const vals = (...o: Record<string, string>[]) => [...new Set(o.flatMap((x) => Object.values(x)))];
  let keys: string[];
  if (s === 'stars') keys = vals(k.MajorStar, k.MinorStar, k.AdjectiveStar, k.HoroscopeStar, k.Changsheng12, k.Boshi12, k.Suiqian12, k.Jiangqian12);
  else if (s === 'patterns') keys = vals(k.PatternKey);
  else if (s === 'palaces') keys = vals(k.PalaceName).filter((p) => p !== k.PalaceName.BODY && p !== k.PalaceName.ORIGINAL);
  else if (s === 'mutagens') keys = vals(k.Mutagen);
  else {
    const fromCompare = compare ? Object.keys((compare.pack.toJSON()[s] ?? {}) as object) : [];
    keys = [...new Set([...fromCompare, ...Object.keys((raw[s] ?? {}) as object)])];
  }
  return keys.map((key) => ({ section: s, key, name: entryName(kernel, raw, compare, { section: s, key }), where: s === 'stars' ? '' : key }));
}

/** 左栏「全部条目」：六段、搜索、筛选，星曜按类别分组（设计规范 20.6）。 */
function AllEntries({
  t,
  kernel,
  raw,
  compare,
  current,
  problemOf,
  onSelect,
  edit,
}: {
  t: Messages;
  kernel: Kernel;
  raw: PackRaw;
  compare: Compare | null;
  current: EntryRef | 'info' | null;
  problemOf: (e: EntryRef) => 'error' | 'warning' | null;
  onSelect: (e: EntryRef) => void;
  edit: (f: (r: PackRaw) => PackRaw) => void;
}) {
  const e = t.editor;
  const [section, setSection] = useState<Section>(current && current !== 'info' ? current.section : 'stars');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'done' | 'problems'>('all');
  const [adding, setAdding] = useState(false);
  const items = useMemo(() => sectionItems(kernel, raw, compare, section), [kernel, raw, compare, section]);
  const done = (x: EntryRef) => {
    const st = entryStatus(raw, compare, x);
    return st !== 'inherit' && st !== 'unwritten';
  };
  const query = q.trim();
  const aliasesOf = (x: EntryRef) => ((entryOf(raw, x)?.attributes as { aliases?: string[] } | undefined)?.aliases ?? []).join(' ');
  const shown = items.filter(
    (x) =>
      (!query || x.name.includes(query) || x.key.includes(query) || aliasesOf(x).includes(query)) &&
      (filter === 'all' || (filter === 'done' ? done(x) : problemOf(x) !== null)),
  );
  const groups: { id: string; title: string; items: ListedEntry[] }[] =
    section === 'stars'
      ? (['major', 'minor', 'adjective', 'flow', 'dec'] as const).map((c) => ({ id: c, title: e.starGroups[c], items: shown.filter((x) => starCategory(kernel, x.key) === c) }))
      : [{ id: section, title: t.knowledge.sections[section], items: shown }];
  const expandedDefault = new Set(['major', section, ...(current && current !== 'info' && current.section === 'stars' ? [starCategory(kernel, current.key)] : []), ...shown.filter(done).map((x) => (section === 'stars' ? starCategory(kernel, x.key) : section))]);
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
  const counts = (s: Section) => {
    const list = sectionItems(kernel, raw, compare, s);
    const d = list.filter(done).length;
    return compare ? fmt(e.sectionCount, { n: d }) : s === 'concepts' || s === 'topics' ? fmt(e.sectionWrittenOnly, { n: d }) : fmt(e.sectionWritten, { n: d, total: list.length });
  };
  return (
    <>
      <div className={css.tabs} role="tablist" aria-label={e.scopeAll}>
        {SECTIONS.map((s) => (
          <button key={s} type="button" role="tab" aria-selected={s === section} className={css.tab} onClick={() => setSection(s)}>
            {t.knowledge.sections[s]}
            <span className={css.tabSub}>{counts(s)}</span>
          </button>
        ))}
      </div>
      <input className={css.search} type="search" aria-label={e.search} placeholder={e.searchPlaceholder} value={q} onChange={(ev) => setQ(ev.target.value)} />
      <Segmented
        label={e.filterLabel}
        className={css.segmented}
        value={filter}
        options={[
          { value: 'all', label: e.filterAll },
          { value: 'done', label: fmt(compare ? e.filterChanged : e.filterWritten, { n: items.filter(done).length }) },
          { value: 'problems', label: fmt(e.filterProblems, { n: items.filter((x) => problemOf(x) !== null).length }) },
        ]}
        onChange={setFilter}
      />
      {groups.map((g) =>
        g.items.length === 0 ? null : (
          <Group
            key={g.id}
            title={g.title}
            count={g.items.length}
            open={query !== '' || filter !== 'all' || expandedDefault.has(g.id) !== toggled.has(g.id)}
            onToggle={() =>
              setToggled((c) => {
                const next = new Set(c);
                if (next.has(g.id)) next.delete(g.id);
                else next.add(g.id);
                return next;
              })
            }
          >
            {g.items.map((x) => (
              <EntryRow key={entryId(x)} t={t} item={x} raw={raw} compare={compare} current={current} problem={problemOf(x)} onSelect={onSelect} />
            ))}
          </Group>
        ),
      )}
      {(section === 'concepts' || section === 'topics') && (
        <button type="button" className={css.addEntry} onClick={() => setAdding(true)}>
          {section === 'concepts' ? e.addConcept : e.addTopic}
        </button>
      )}
      {adding && (
        <AddEntryDialog
          t={t}
          section={section}
          taken={items.map((x) => x.key)}
          onCancel={() => setAdding(false)}
          onAdd={(slug, title) => {
            setAdding(false);
            edit((r) => setField(r, { section, key: slug }, 'title', title));
            onSelect({ section, key: slug });
          }}
        />
      )}
    </>
  );
}

/** 新增术语或主题：标题与标识（小写字母、数字、连字符，建后不能改，不与已有的重复）。 */
function AddEntryDialog({ t, section, taken, onCancel, onAdd }: { t: Messages; section: Section; taken: readonly string[]; onCancel: () => void; onAdd: (slug: string, title: string) => void }) {
  const e = t.editor;
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [err, setErr] = useState<{ title?: string; slug?: string }>({});
  const submit = () => {
    const next: typeof err = {};
    if (!title.trim()) next.title = e.titleMissing;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) next.slug = e.slugBad;
    else if (taken.includes(slug)) next.slug = e.slugTaken;
    setErr(next);
    if (!next.title && !next.slug) onAdd(slug, title.trim());
  };
  return (
    <ModalOverlay isOpen isDismissable onOpenChange={(o) => !o && onCancel()} className={kcss.scrim}>
      <Modal className={kcss.dialog}>
        <Dialog aria-labelledby="add-entry-title">
          <Heading slot="title" id="add-entry-title" className={kcss.dialogTitle}>
            {fmt(e.addEntryTitle, { section: t.knowledge.sections[section] })}
          </Heading>
          <label className={css.formField}>
            <span className={css.infoLabel}>{e.entryTitle}</span>
            <input className={css.input} value={title} aria-invalid={err.title ? true : undefined} onChange={(ev) => setTitle(ev.target.value)} />
            {err.title && <span className={css.formError}>{err.title}</span>}
          </label>
          <label className={css.formField}>
            <span className={css.infoLabel}>{e.entrySlug}</span>
            <input className={`${css.input} ${css.mono}`} value={slug} aria-invalid={err.slug ? true : undefined} onChange={(ev) => setSlug(ev.target.value)} />
            <span className={css.infoNote}>{e.slugHint}</span>
            {err.slug && <span className={css.formError}>{err.slug}</span>}
          </label>
          <div className={kcss.dialogActions}>
            <Button className={controls.ghost} onPress={onCancel}>
              {e.cancel}
            </Button>
            <Button className={controls.button} onPress={submit}>
              {e.create}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** 问题汇总（设计规范 20.8）：必须改与提醒两组，每条写位置、路径、原因；点一条跳到那个字段。 */
function IssueList({ t, kernel, raw, compare, problems, onPick }: { t: Messages; kernel: Kernel; raw: PackRaw; compare: Compare | null; problems: readonly Problem[]; onPick: (p: Problem) => void }) {
  const e = t.editor;
  if (!problems.length) return <p className={css.previewNote}>{e.issuesNone}</p>;
  const item = (p: Problem, i: number) => {
    const pt = problemText(p.issue ? { code: 'issue', issue: p.issue } : p.library!, t);
    const where = p.at.entry ? `${t.knowledge.sections[p.at.entry.section]}　${entryName(kernel, raw, compare, p.at.entry)}　${p.at.field ? ((e.fields as Record<string, string>)[p.at.field] ?? p.at.field) : ''}` : e.packInfo;
    return (
      <button key={i} type="button" className={css.issueItem} data-level={p.level} onClick={() => onPick(p)}>
        <b>{where}</b>
        <span className={css.issuePath}>{pt.where}</span>
        {pt.text}
      </button>
    );
  };
  const errs = problems.filter((p) => p.level === 'error');
  const warns = problems.filter((p) => p.level === 'warning');
  return (
    <div>
      {errs.length > 0 && <p className={css.issueGroup}>{fmt(e.issuesErrors, { n: errs.length })}</p>}
      {errs.map(item)}
      {warns.length > 0 && <p className={css.issueGroup}>{fmt(e.issuesWarnings, { n: warns.length })}</p>}
      {warns.map(item)}
      {warns.some((p) => p.issue?.code === 'summary_missing') && <p className={css.previewNote}>{e.summaryWarning}</p>}
    </div>
  );
}

/** 离开时的确认（设计规范 20.12）：焦点在「继续编辑」，Esc 与点遮罩等于继续编辑。 */
function LeaveDialog({
  t,
  draft,
  name,
  time,
  errors,
  full,
  toChart,
  onStay,
  onLeave,
  onSave,
  onExport,
}: {
  t: Messages;
  draft: Draft;
  name: string;
  time: string;
  errors: number;
  full: boolean;
  toChart: boolean;
  onStay: () => void;
  onLeave: () => void;
  onSave: (use: boolean) => void;
  onExport: () => void;
}) {
  const e = t.editor;
  const changed = draft.snapshot ? SECTIONS.reduce((n, s) => n + Object.keys({ ...((draft.raw[s] ?? {}) as object), ...((draft.snapshot![s] ?? {}) as object) }).filter((k) => JSON.stringify((draft.raw[s] as Record<string, unknown> | undefined)?.[k]) !== JSON.stringify((draft.snapshot![s] as Record<string, unknown> | undefined)?.[k])).length, 0) : 0;
  const title = full ? e.leaveFullTitle : draft.editing ? fmt(e.leaveTitleOwn, { n: changed }) : e.leaveTitleNew;
  const body = full ? e.leaveFullBody : draft.editing ? fmt(e.leaveBodyOwn, { time, name }) : fmt(e.leaveBodyNew, { time });
  return (
    <ModalOverlay isOpen isDismissable onOpenChange={(o) => !o && onStay()} className={kcss.scrim}>
      <Modal className={kcss.dialog}>
        <Dialog role="alertdialog" aria-labelledby="leave-title" aria-describedby="leave-body">
          <Heading slot="title" id="leave-title" className={kcss.dialogTitle}>
            {title}
          </Heading>
          <p id="leave-body" className={kcss.dialogBody}>
            {body}
            {!full && errors > 0 && (
              <>
                <br />
                {fmt(e.leaveErrors, { n: errors })}
              </>
            )}
          </p>
          <div className={kcss.dialogActions}>
            <Button className={controls.ghost} onPress={onStay} autoFocus>
              {e.keepEditing}
            </Button>
            {full ? (
              <>
                <Button className={controls.ghost} onPress={onExport}>
                  {e.exportJson}
                </Button>
                <Button className={`${controls.button} ${kcss.danger}`} onPress={onLeave}>
                  {e.leaveAnyway}
                </Button>
              </>
            ) : (
              <>
                <Button className={controls.ghost} onPress={onLeave}>
                  {e.leaveDraft}
                </Button>
                {errors === 0 && (
                  <Button className={controls.button} onPress={() => onSave(toChart)}>
                    {toChart ? e.saveUseBack : e.saveLeave}
                  </Button>
                )}
              </>
            )}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

