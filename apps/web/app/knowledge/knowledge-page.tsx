import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dialog, Heading, Link, Modal, ModalOverlay, Radio, RadioGroup } from 'react-aria-components';
import { useLocation, useNavigate } from 'react-router';
import * as controls from '../components/controls.css';
import { ChevronIcon, CloseIcon } from '../components/icons';
import { Segmented } from '../components/segmented';
import { useToast } from '../components/toast';
import { localePath } from '../i18n/lang';
import { fmt, type Messages } from '../i18n/messages';
import { useLang, useMessages } from '../i18n/use-lang';
import { type Kernel, loadKernel, useKernelState } from '../kernel/kernel';
import { ImportPanel, type ImportState, fileProblems, runImport } from './import-panel';
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
  moveInStack,
  stackable,
  usePack,
  wholes,
  withoutPack,
} from './library';
import { CountList, activePacks, diffText, importedText, totalOf, useLabel } from './parts';
import { addPack, removePack, setUse, useLibrary } from './use-library';
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
  onChange,
}: {
  t: Messages;
  use: Use;
  packs: readonly Pack[];
  defaultPack: Pack;
  /** 存储不可用或读库失败：组合改不了，只有默认包。 */
  blocked: boolean;
  onChange: (next: Use) => void;
}) {
  const u = t.knowledge.use;
  const active = activePacks(use, packs, defaultPack);
  const overlays = stackable(packs);
  const otherBase = packs.filter((p) => p.extends !== null && p.extends !== DEFAULT_PACK_ID);
  const whole = [defaultPack, ...wholes(packs)];
  const merged: Record<Section, number> = { ...defaultPack.counts };
  const marks: Partial<Record<Section, string>> = {};
  if (use.mode === 'whole') {
    Object.assign(merged, active[0]!.counts);
  } else {
    const keys: Record<Section, Set<string>> = Object.fromEntries(SECTIONS.map((s) => [s, new Set(defaultPack.keys[s])])) as Record<Section, Set<string>>;
    const touched: Record<Section, Set<string>> = Object.fromEntries(SECTIONS.map((s) => [s, new Set<string>()])) as Record<Section, Set<string>>;
    for (const p of active.slice(1)) {
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
  }
  const addable = overlays.filter((p) => !use.stack.includes(p.id));
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
          onChange={(mode) => onChange({ ...use, mode })}
          options={[
            { value: 'stack', label: u.stack, ...(blocked ? { disabledReason: t.knowledge.imp.blocked } : {}) },
            { value: 'whole', label: u.whole, ...(blocked ? { disabledReason: t.knowledge.imp.blocked } : {}) },
          ]}
        />
      </div>
      <div className={css.row}>
        {use.mode === 'stack' ? (
          <>
            <div className={`${css.sheet} ${css.sheetBase}`}>
              <small className={css.sheetKind}>{u.base}</small>
              <b className={css.sheetName}>{defaultPack.name}</b>
              <span className={css.sheetId}>{defaultPack.version}</span>
              <p className={css.sheetNote}>{u.defaultNote}</p>
            </div>
            {active.slice(1).map((p, i) => (
              <Overlay
                key={p.id}
                t={t}
                pack={p}
                index={i}
                last={i === use.stack.length - 1}
                diff={diffText(diffAgainst(p, defaultPack), t)}
                onMove={(dir) => onChange(moveInStack(use, i, dir))}
                onRemove={() => onChange({ ...use, stack: use.stack.filter((x) => x !== p.id) })}
              />
            ))}
          </>
        ) : (
          <RadioGroup
            aria-label={u.whole}
            value={use.whole}
            onChange={(id) => onChange({ ...use, whole: id })}
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
      {use.mode === 'stack' ? (
        <p className={css.addable}>
          {addable.length ? (
            <>
              <span>{u.addable}</span>
              {addable.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={css.addButton}
                  aria-label={fmt(u.addLabel, { name: p.name })}
                  onClick={() => onChange({ ...use, stack: [...use.stack, p.id] })}
                >
                  {p.name}
                </button>
              ))}
              <span>{u.laterWins}</span>
            </>
          ) : (
            <span>{overlays.length ? u.allStacked : u.noOverlay}</span>
          )}
          {otherBase.length > 0 && <span>{fmt(u.otherBase, { names: otherBase.map((p) => p.name).join(t.knowledge.diff.sep) })}</span>}
        </p>
      ) : (
        <p className={css.addable}>{whole.length > 1 ? u.wholeNote : u.noWhole}</p>
      )}
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
          return (
            <li key={p.id} className={css.pack}>
              <div>
                <div className={css.packTitle}>
                  <b className={css.packName}>{p.name}</b>
                  <span className={css.packId}>{p.id}</span>
                  <span className={css.tags}>
                    {isDefault && <span className={css.tag}>{l.default}</span>}
                    {activeSet.has(p.id) && <span className={`${css.tag} ${css.tagOn}`}>{l.active}</span>}
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
                {use.mode === 'whole' ? d.activeWhole : fmt(d.activeStack, { label: useLabel(rest) })}
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

  // 格式说明搬到 /{lang}/knowledge/format 之前，带锚点的旧链接指向这里；把锚点带过去。
  useEffect(() => {
    if (hash) navigate(`${localePath(lang, '/knowledge/format')}${hash}`, { replace: true });
  }, [hash, lang, navigate]);

  const defaultPack = useMemo(() => (kernel ? defaultPackInfo(kernel) : initialDefault), [kernel, initialDefault]);
  const viewingRaw = useMemo(() => (viewing ? (viewing.raw ?? (kernel ? packRaw(kernel, viewing) : null)) : null), [viewing, kernel]);
  const ready = lib.status === 'ready';
  const packs = ready ? lib.packs : [];
  const use = ready ? lib.use : DEFAULT_USE;
  const blocked = lib.status === 'unavailable' || lib.status === 'failed';
  const activeSet = new Set(activeIds(use));

  const act = async (run: () => Promise<void>) => {
    try {
      await run();
    } catch (err) {
      console.error(err);
      toast(fmt(t.knowledge.actionFailed, { reason: err instanceof Error ? err.message : String(err) }));
    }
  };
  const changeUse = (next: Use) => void act(() => setUse(next));
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
      {kstate.status === 'error' && (
        <p className={css.notice} role="alert">
          <b className={css.noticeTitle}>{fmt(t.knowledge.kernelFailed, { reason: kstate.message })}</b>
          <Button className={controls.ghost} onPress={() => loadKernel().catch(() => undefined)}>
            {t.knowledge.retry}
          </Button>
        </p>
      )}
      <UsePanel t={t} use={use} packs={packs} defaultPack={defaultPack} blocked={blocked} onChange={changeUse} />
      <div className={css.grid}>
        <PackList
          t={t}
          packs={packs}
          defaultPack={defaultPack}
          activeSet={activeSet}
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
              if (problems.length) setImp({ phase: 'error', file: file.name, problems });
              else startImport(file.name, () => file.text());
            }}
            onPaste={(text) => startImport(t.knowledge.imp.pasted, async () => text)}
            onReset={() => setImp({ phase: 'idle' })}
            inUse={(id) => activeSet.has(id)}
            base={baseOf}
            onUse={(p) =>
              void act(async () => {
                const next = usePack(use, p);
                await setUse(next);
                toast(fmt(t.knowledge.use.toast, { label: useLabel(activePacks(next, packs, defaultPack)) }));
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

