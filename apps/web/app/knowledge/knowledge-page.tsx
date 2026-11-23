import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dialog, Heading, Link, Modal, ModalOverlay, Radio, RadioGroup } from 'react-aria-components';
import { useLocation, useNavigate } from 'react-router';
import type { KnowledgeIssue } from 'x-iztro';
import * as controls from '../components/controls.css';
import { ChevronIcon, CloseIcon } from '../components/icons';
import { Segmented } from '../components/segmented';
import { useToast } from '../components/toast';
import { localePath } from '../i18n/lang';
import { fmt, type Messages } from '../i18n/messages';
import { useLang, useMessages } from '../i18n/use-lang';
import { type Kernel, loadKernel, useKernelState } from '../kernel/kernel';
import { type ImportState, fileProblems, runImport } from './import';
import { ImportPanel, ProblemList } from './import-panel';
import { defaultPackInfo, packRaw } from './kernel-pack';
import * as css from './knowledge.css';
import {
  DEFAULT_PACK_ID,
  DEFAULT_USE,
  type Pack,
  SECTIONS,
  type Section,
  type Use,
  activeIds,
  diffAgainst,
  addToStack,
  moveInStack,
  overlaysOf,
  pickWhole,
  removeFromStack,
  usePack,
  wholes,
  withoutPack,
  withoutPacks,
} from './library';
import { CountList, activePacks, diffText, importedText, totalOf, useLabel } from './parts';
import { addPack, removePack, updateUse, useLibrary } from './use-library';
import { useBrokenPacks, useRepairNotice, useRetireBroken } from './chart-knowledge';
import { ViewDrawer } from './view-drawer';

/** 下载一个包的原文：`id-版本.json`。 */
function download(raw: object, file: string): void {
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(raw, null, 2)}\n`], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = file;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function packFile(p: Pack): string {
  return `${p.id}-${p.version ?? 'unversioned'}.json`;
}

/** 当前生效（设计规范第 18.4 节）：叠加或整包切换，改动立即生效并写进本机。 */
function UsePanel({
  t,
  use,
  packs,
  defaultPack,
  blocked,
  brokenIds,
  onChange,
}: {
  t: Messages;
  use: Use;
  packs: readonly Pack[];
  defaultPack: Pack;
  /** 存储不可用或读库失败：组合改不了，只有默认包。 */
  blocked: boolean;
  /** 「需要改」的包（`packs` 里已不含它们）：基于它们的覆盖包要等底包改好才能叠加。 */
  brokenIds: ReadonlySet<string>;
  /** 改组合：传入由库里此刻的组合算出新组合的函数（见 `updateUse`）。 */
  onChange: (next: (use: Use) => Use) => void;
}) {
  const u = t.knowledge.use;
  const active = activePacks(use, packs, defaultPack);
  const [base, ...layers] = active;
  if (!base) throw new Error('生效组合没有底包');
  const baseOverlays = overlaysOf(packs, base.id);
  const whole = [defaultPack, ...wholes(packs)];
  const merged: Record<Section, number> = { ...base.counts };
  const marks: Partial<Record<Section, string>> = {};
  const keys = Object.fromEntries(SECTIONS.map((s) => [s, new Set(base.keys[s])])) as Record<Section, Set<string>>;
  const touched = Object.fromEntries(SECTIONS.map((s) => [s, new Set<string>()])) as Record<Section, Set<string>>;
  for (const p of layers) {
    for (const s of SECTIONS) {
      for (const k of p.keys[s]) {
        keys[s].add(k);
        touched[s].add(k);
      }
    }
  }
  for (const s of SECTIONS) {
    merged[s] = keys[s].size;
    if (touched[s].size) marks[s] = fmt(u.changedMark, { n: touched[s].size });
  }
  const addable = baseOverlays.filter((p) => !layers.some((l) => l.id === p.id));
  // 叠加模式下，基于本机整包的覆盖包要到整包切换里选那个整包才能叠加。
  const onWhole = (p: Pack) => p.extends !== null && p.extends !== DEFAULT_PACK_ID;
  const elsewhere = use.mode === 'stack' ? packs.filter((p) => onWhole(p) && packs.some((b) => b.id === p.extends)) : [];
  // 底包已被删掉的覆盖包：留在本机，重新导入底包后才能叠加。底包「需要改」的另行说明。
  const brokenBase = (p: Pack) => p.extends !== null && brokenIds.has(p.extends);
  const baseBroken = packs.filter((p) => onWhole(p) && brokenBase(p));
  const orphans = packs.filter((p) => onWhole(p) && !brokenBase(p) && !packs.some((b) => b.id === p.extends));
  // 整包模式选的是默认包时不叠加（叠加默认包用叠加模式）。
  const canLayer = use.mode === 'stack' || base.id !== DEFAULT_PACK_ID;
  return (
    <section className={css.use} aria-labelledby="knowledge-use-title">
      <div className={css.useHead}>
        <h2 id="knowledge-use-title" className={css.sectionTitle}>
          {u.title}
        </h2>
        <Segmented
          label={u.modeLabel}
          className={css.useMode}
          value={use.mode}
          onChange={(mode) => onChange((u) => ({ ...u, mode }))}
          options={[
            { value: 'stack', label: u.stack, ...(blocked ? { disabledReason: t.knowledge.imp.blocked } : {}) },
            { value: 'whole', label: u.whole, ...(blocked ? { disabledReason: t.knowledge.imp.blocked } : {}) },
          ]}
        />
      </div>
      <div className={css.row}>
        {use.mode === 'stack' ? (
          <div className={`${css.sheet} ${css.sheetBase}`}>
            <small className={css.sheetKind}>{u.base}</small>
            <b className={css.sheetName}>{defaultPack.name}</b>
            <span className={css.sheetId}>{defaultPack.version}</span>
            <p className={css.sheetNote}>{u.defaultNote}</p>
          </div>
        ) : (
          <RadioGroup
            aria-label={u.whole}
            value={use.whole}
            onChange={(id) => onChange((u) => pickWhole(u, id))}
            className={css.wholeRow}
            orientation="horizontal"
            isDisabled={blocked}
          >
            {whole.map((p) => (
              <Radio key={p.id} value={p.id} className={`${css.sheet} ${css.sheetPick}`}>
                <span className={css.dot} />
                <small className={css.sheetKind}>{p.id === DEFAULT_PACK_ID ? u.defaultKind : u.wholeKind}</small>
                <b className={css.sheetName}>{p.name}</b>
                <span className={css.sheetId}>
                  {p.id}
                  <span className={css.sheetVersion}>{p.version}</span>
                </span>
                <span className={css.sheetNote}>{fmt(u.total, { n: totalOf(p.counts) })}</span>
              </Radio>
            ))}
          </RadioGroup>
        )}
        {layers.map((p, i) => (
          <Overlay
            key={p.id}
            t={t}
            pack={p}
            index={i}
            last={i === layers.length - 1}
            diff={diffText(diffAgainst(p, base), t)}
            onMove={(dir) => onChange((u) => moveInStack(u, p.id, dir))}
            onRemove={() => onChange((u) => removeFromStack(u, p.id))}
          />
        ))}
        <span className={`${css.op} ${css.opEq}`} aria-hidden="true">
          =
        </span>
        <div className={`${css.sheet} ${css.sheetResult}`} aria-live="polite">
          <small className={css.sheetKind}>{u.result}</small>
          <b className={css.sheetName}>{useLabel(active)}</b>
          <CountList counts={merged} base={defaultPack.counts} marks={marks} t={t} />
          <p className={css.sheetNote}>{u.resultNote}</p>
        </div>
      </div>
      <p className={css.addable}>
        {use.mode === 'whole' && <span>{whole.length > 1 ? u.wholeNote : u.noWhole}</span>}
        {canLayer &&
          (addable.length ? (
            <>
              <span>{u.addable}</span>
              {addable.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={css.addButton}
                  aria-label={fmt(u.addLabel, { name: p.name })}
                  onClick={() => onChange((u) => addToStack(u, p.id))}
                >
                  {p.name}
                </button>
              ))}
              <span>{u.laterWins}</span>
            </>
          ) : (
            <span>{baseOverlays.length ? u.allStacked : fmt(u.noOverlay, { base: base.id })}</span>
          ))}
        {elsewhere.length > 0 && <span>{fmt(u.otherBase, { names: elsewhere.map((p) => p.name).join(t.knowledge.diff.sep) })}</span>}
        {orphans.length > 0 && <span>{fmt(u.orphans, { names: orphans.map((p) => p.name).join(t.knowledge.diff.sep) })}</span>}
        {baseBroken.length > 0 && <span>{fmt(u.baseBroken, { names: baseBroken.map((p) => p.name).join(t.knowledge.diff.sep) })}</span>}
      </p>
    </section>
  );
}

function Overlay({
  t,
  pack,
  index,
  last,
  diff,
  onMove,
  onRemove,
}: {
  t: Messages;
  pack: Pack;
  index: number;
  last: boolean;
  diff: string;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const u = t.knowledge.use;
  return (
    <>
      <span className={css.op} aria-hidden="true">
        +
      </span>
      <div className={css.sheet}>
        <small className={css.sheetKind}>{fmt(u.overlay, { n: index + 1 })}</small>
        <b className={css.sheetName}>{pack.name}</b>
        <span className={css.sheetId}>
          {pack.id}
          <span className={css.sheetVersion}>{pack.version}</span>
        </span>
        <p className={css.sheetNote}>{diff}</p>
        <div className={css.sheetActions}>
          <button type="button" className={css.sheetAction} aria-label={fmt(u.moveEarlier, { name: pack.name })} disabled={index === 0} onClick={() => onMove(-1)}>
            <span className={css.arrowH}>
              <ChevronIcon dir="left" />
            </span>
            <span className={css.arrowV}>
              <ChevronIcon dir="up" />
            </span>
          </button>
          <button type="button" className={css.sheetAction} aria-label={fmt(u.moveLater, { name: pack.name })} disabled={last} onClick={() => onMove(1)}>
            <span className={css.arrowH}>
              <ChevronIcon dir="right" />
            </span>
            <span className={css.arrowV}>
              <ChevronIcon dir="down" />
            </span>
          </button>
          <button type="button" className={css.sheetAction} aria-label={fmt(u.remove, { name: pack.name })} onClick={onRemove}>
            <CloseIcon />
          </button>
        </div>
      </div>
    </>
  );
}

/** 本机的包（设计规范第 18.5 节）：每个包一行，右侧查看、导出、删除；默认包不可删改。 */
function PackList({
  t,
  packs,
  defaultPack,
  activeSet,
  broken,
  blocked,
  canReadDefault,
  onView,
  onExport,
  onDelete,
}: {
  t: Messages;
  packs: readonly Pack[];
  defaultPack: Pack;
  activeSet: ReadonlySet<string>;
  /** 过不了内核校验的包（「需要改」）及其 error 级问题。 */
  broken: ReadonlyMap<string, KnowledgeIssue[]>;
  blocked: boolean;
  /** 默认包的全文在内核里：内核装好之前查看、导出不可用。 */
  canReadDefault: boolean;
  onView: (p: Pack) => void;
  onExport: (p: Pack) => void;
  onDelete: (p: Pack) => void;
}) {
  const l = t.knowledge.list;
  const rows = [defaultPack, ...packs];
  const nameOf = (id: string) => (id === DEFAULT_PACK_ID ? defaultPack.name : (packs.find((p) => p.id === id)?.name ?? id));
  return (
    <section aria-labelledby="knowledge-list-title">
      <div className={css.sectionHead}>
        <h2 id="knowledge-list-title" className={css.sectionTitle}>
          {l.title}
        </h2>
        <span className={css.sectionAux}>{fmt(l.count, { n: rows.length })}</span>
      </div>
      <ul className={css.packs}>
        {rows.map((p) => {
          const isDefault = p.id === DEFAULT_PACK_ID;
          const base = p.extends === null ? null : p.extends === DEFAULT_PACK_ID ? defaultPack : (packs.find((x) => x.id === p.extends) ?? null);
          const readable = !isDefault || canReadDefault;
          const issues = broken.get(p.id);
          return (
            <li key={p.id} className={css.pack}>
              <div>
                <div className={css.packTitle}>
                  <b className={css.packName}>{p.name}</b>
                  <span className={css.packId}>{p.id}</span>
                  <span className={css.tags}>
                    {isDefault && <span className={css.tag}>{l.default}</span>}
                    {activeSet.has(p.id) && <span className={`${css.tag} ${css.tagOn}`}>{l.active}</span>}
                    {issues && <span className={css.tag}>{l.broken}</span>}
                  </span>
                </div>
                <div className={css.meta}>
                  <span>
                    <small className={css.metaLabel}>{l.version}</small>
                    {p.version ?? '—'}
                  </span>
                  <span>
                    <small className={css.metaLabel}>{l.language}</small>
                    {p.language ?? '—'}
                  </span>
                  <span>
                    <small className={css.metaLabel}>{l.base}</small>
                    {p.extends ? nameOf(p.extends) : isDefault ? '—' : l.whole}
                  </span>
                  <span>
                    <small className={css.metaLabel}>{l.imported}</small>
                    {p.importedAt === null ? l.builtin : importedText(p.importedAt)}
                  </span>
                </div>
                <CountList counts={p.counts} base={defaultPack.counts} t={t} className={css.packCounts} />
                {isDefault ? (
                  <p className={css.packSource}>{fmt(l.defaultSource, { license: p.license ?? '—', author: p.author ?? '—' })}</p>
                ) : base ? (
                  <p className={css.packSource}>{fmt(l.overlaySource, { diff: diffText(diffAgainst(p, base), t), base: base.name })}</p>
                ) : null}
                {issues && (
                  <>
                    <p className={css.problemLabel}>{fmt(l.brokenNote, { n: issues.length })}</p>
                    <ProblemList problems={issues.map((issue) => ({ code: 'issue' as const, issue }))} t={t} />
                  </>
                )}
              </div>
              <div className={css.packActions} role="group" aria-label={fmt(l.actionsLabel, { name: p.name })}>
                <Button className={css.packAction} isDisabled={!readable} onPress={() => onView(p)}>
                  {l.view}
                </Button>
                <Button className={css.packAction} isDisabled={!readable} onPress={() => onExport(p)}>
                  {l.export}
                </Button>
                {isDefault ? (
                  <span className={css.packLocked}>{l.locked}</span>
                ) : (
                  <Button className={css.packAction} onPress={() => onDelete(p)}>
                    {l.delete}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
        {packs.length === 0 && <li className={css.packsNone}>{blocked ? l.noneBlocked : l.none}</li>}
      </ul>
    </section>
  );
}

/** 删除确认（设计规范第 18.8 节）：默认聚焦「取消」，Esc 与点遮罩等于取消。 */
function DeleteDialog({
  t,
  pack,
  use,
  packs,
  defaultPack,
  onCancel,
  onConfirm,
}: {
  t: Messages;
  pack: Pack;
  use: Use;
  packs: readonly Pack[];
  defaultPack: Pack;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const d = t.knowledge.del;
  const inUse = activeIds(use).includes(pack.id);
  const after = withoutPack(use, pack.id);
  const rest = activePacks(after, packs.filter((p) => p.id !== pack.id), defaultPack);
  const dependents = overlaysOf(packs, pack.id);
  return (
    <ModalOverlay isOpen isDismissable onOpenChange={(o) => !o && onCancel()} className={css.scrim}>
      <Modal className={css.dialog}>
        <Dialog role="alertdialog" aria-labelledby="knowledge-delete-title" aria-describedby="knowledge-delete-body">
          <Heading slot="title" id="knowledge-delete-title" className={css.dialogTitle}>
            {fmt(d.title, { name: pack.name })}
          </Heading>
          <p id="knowledge-delete-body" className={css.dialogBody}>
            {d.body}
            {inUse && (
              <>
                <br />
                <b className={css.dialogStrong}>{d.active}</b>
                {use.mode === 'whole' && use.whole === pack.id ? d.activeWhole : fmt(d.activeStack, { label: useLabel(rest) })}
              </>
            )}
            {dependents.length > 0 && (
              <>
                <br />
                {fmt(d.overlaysKept, { names: dependents.map((p) => p.name).join(t.knowledge.diff.sep) })}
              </>
            )}
          </p>
          <div className={css.dialogActions}>
            <Button className={controls.ghost} onPress={onCancel} autoFocus>
              {d.cancel}
            </Button>
            <Button className={`${controls.button} ${css.danger}`} onPress={onConfirm}>
              {d.confirm}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/**
 * 知识包页（设计规范第 18 节）。`initialDefault` 是构建时由内核取出的默认包信息，内核装好之前也能显示默认包；
 * 导入、查看与导出默认包要等内核装好。用户包与生效组合在本机的 IndexedDB 里（见 `use-library.ts`）。
 */
export function KnowledgePage({ initialDefault }: { initialDefault: Pack }) {
  const t = useMessages();
  const lang = useLang();
  const toast = useToast();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const kstate = useKernelState();
  const kernel: Kernel | null = kstate.status === 'ready' ? kstate.kernel : null;
  const lib = useLibrary();
  const [imp, setImp] = useState<ImportState>({ phase: 'idle' });
  const [viewing, setViewing] = useState<Pack | null>(null);
  const [deleting, setDeleting] = useState<Pack | null>(null);
  const importRef = useRef<HTMLElement>(null);
  const firstControl = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    loadKernel().catch(() => undefined);
  }, []);
  useRepairNotice(lib, t);
  const broken = useBrokenPacks(kernel, lib);
  useRetireBroken(lib, broken, t);

  // 格式说明搬到 /{lang}/knowledge/format 之前，带锚点的旧链接指向这里；把锚点带过去。
  useEffect(() => {
    if (hash) navigate(`${localePath(lang, '/knowledge/format')}${hash}`, { replace: true });
  }, [hash, lang, navigate]);

  const defaultPack = useMemo(() => (kernel ? defaultPackInfo(kernel) : initialDefault), [kernel, initialDefault]);
  const viewingRaw = useMemo(() => (viewing ? (viewing.raw ?? (kernel ? packRaw(kernel, viewing) : null)) : null), [viewing, kernel]);
  const ready = lib.status === 'ready';
  const packs = ready ? lib.packs : [];
  // 「需要改」的包不能生效：组合与可选的包都不算它们（组合里的引用另由 useRetireBroken 写回移出）。
  const usable = packs.filter((p) => !broken.has(p.id));
  const use = ready ? withoutPacks(lib.use, broken.keys()) : DEFAULT_USE;
  // 库用不了（不可用、读库失败、被别的标签页挡住、已被更新的版本接管）：导入与改组合都关闭，只有默认包。
  const blocked = lib.status === 'unavailable' || lib.status === 'failed' || lib.status === 'blocked' || lib.status === 'superseded';
  const activeSet = new Set(activeIds(use));

  const act = async (run: () => Promise<void>) => {
    try {
      await run();
    } catch (err) {
      console.error(err);
      toast(fmt(t.knowledge.actionFailed, { reason: err instanceof Error ? err.message : String(err) }));
    }
  };
  /** 改组合；换了整包、原来叠加在旧整包上的覆盖包随之移出时，提示一句。 */
  const changeUse = (next: (u: Use) => Use) =>
    void act(async () => {
      const before = use;
      const after = (await updateUse(next)).use;
      const gone = before.whole !== after.whole ? before.wholeStack.filter((id) => !after.wholeStack.includes(id)) : [];
      if (gone.length) {
        const name = (id: string) => packs.find((p) => p.id === id)?.name ?? id;
        toast(fmt(t.knowledge.use.baseChanged, { names: gone.map(name).join(t.knowledge.diff.sep), base: name(before.whole) }));
      }
    });
  const baseOf = (p: Pack): Pack | null =>
    p.extends === null ? null : p.extends === DEFAULT_PACK_ID ? defaultPack : (packs.find((x) => x.id === p.extends) ?? null);
  const startImport = (file: string, read: () => Promise<string>) => {
    if (!kernel || !ready) throw new Error('内核与本机包库就绪之前不能导入');
    void runImport({ file, read, kernel, packs, save: addPack, onState: setImp });
  };

  return (
    <main className={css.page}>
      <header className={css.head}>
        <div>
          <h1 className={css.title}>{t.knowledge.title}</h1>
          <p className={css.lede}>{t.knowledge.lede}</p>
        </div>
        <div className={css.headActions}>
          <Link className={`${controls.ghost} ${css.headAction}`} href={localePath(lang, '/knowledge/format')}>
            {t.knowledge.formatLink}
          </Link>
          <Button
            className={`${controls.button} ${css.headAction}`}
            onPress={() => {
              importRef.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
              const target = firstControl.current;
              if (target && !target.disabled) target.focus({ preventScroll: true });
            }}
          >
            {t.knowledge.importAction}
          </Button>
        </div>
      </header>
      {lib.status === 'unavailable' && (
        <p className={css.notice} role="note">
          <b className={css.noticeTitle}>{t.knowledge.blockedTitle}</b>
          {t.knowledge.blockedBody}
        </p>
      )}
      {lib.status === 'failed' && (
        <p className={css.notice} role="alert">
          <b className={css.noticeTitle}>{t.knowledge.failedTitle}</b>
          {fmt(t.knowledge.failedBody, { reason: lib.message })}
        </p>
      )}
      {lib.status === 'blocked' && (
        <p className={css.notice} role="alert">
          <b className={css.noticeTitle}>{t.knowledge.blockedByTabsTitle}</b>
          {t.knowledge.blockedByTabsBody}
        </p>
      )}
      {lib.status === 'superseded' && (
        <p className={css.notice} role="alert">
          <b className={css.noticeTitle}>{t.knowledge.supersededTitle}</b>
          {t.knowledge.supersededBody}
        </p>
      )}
      {kstate.status === 'error' && (
        <p className={css.notice} role="alert">
          <b className={css.noticeTitle}>{fmt(t.knowledge.kernelFailed, { reason: kstate.message })}</b>
          <Button className={controls.ghost} onPress={() => loadKernel().catch(() => undefined)}>
            {t.knowledge.retry}
          </Button>
        </p>
      )}
      <UsePanel t={t} use={use} packs={usable} defaultPack={defaultPack} blocked={blocked} brokenIds={new Set(broken.keys())} onChange={changeUse} />
      <div className={css.grid}>
        <PackList
          t={t}
          packs={packs}
          defaultPack={defaultPack}
          activeSet={activeSet}
          broken={broken}
          blocked={blocked}
          canReadDefault={kernel !== null}
          onView={setViewing}
          onExport={(p) => {
            const raw = p.raw ?? (kernel ? packRaw(kernel, p) : null);
            if (!raw) throw new Error('内核装好之前不能导出默认包');
            download(raw, packFile(p));
            toast(fmt(t.knowledge.exported, { file: packFile(p) }));
          }}
          onDelete={setDeleting}
        />
        <aside className={css.importBox} aria-labelledby="knowledge-import-title" ref={importRef}>
          <div className={css.sectionHead}>
            <h2 id="knowledge-import-title" className={css.sectionTitle}>
              {t.knowledge.imp.title}
            </h2>
          </div>
          <ImportPanel
            t={t}
            blocked={blocked}
            libraryReady={ready}
            kstate={kstate}
            state={imp}
            firstControl={firstControl}
            onFile={(file) => {
              const problems = fileProblems(file);
              if (problems.length) setImp({ phase: 'error', file: file.name, errors: problems, warnings: [] });
              else startImport(file.name, () => file.text());
            }}
            onPaste={(text) => startImport(t.knowledge.imp.pasted, async () => text)}
            onReset={() => setImp({ phase: 'idle' })}
            inUse={(id) => activeSet.has(id)}
            base={baseOf}
            onUse={(p) =>
              void act(async () => {
                const snap = await updateUse((u) => usePack(u, p));
                toast(fmt(t.knowledge.use.toast, { label: useLabel(activePacks(snap.use, snap.packs, defaultPack)) }));
              })
            }
            onView={setViewing}
          />
        </aside>
      </div>
      {viewing && viewingRaw && (
        <ViewDrawer
          pack={viewing}
          raw={viewingRaw}
          base={baseOf(viewing)}
          defaultPack={defaultPack}
          t={t}
          onClose={() => setViewing(null)}
        />
      )}
      {deleting && ready && (
        <DeleteDialog
          t={t}
          pack={deleting}
          use={use}
          packs={packs}
          defaultPack={defaultPack}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const p = deleting;
            setDeleting(null);
            void act(async () => {
              await removePack(p.id);
              if (imp.phase === 'done' && imp.pack.id === p.id) setImp({ phase: 'idle' });
              toast(fmt(t.knowledge.del.deleted, { name: p.name }));
            });
          }}
        />
      )}
    </main>
  );
}

