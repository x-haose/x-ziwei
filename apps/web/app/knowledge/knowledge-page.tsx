import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dialog, Heading, Link, Modal, ModalOverlay } from 'react-aria-components';
import { useLocation, useNavigate } from 'react-router';
import type { KnowledgeIssue } from 'x-iztro';
import * as controls from '../components/controls.css';
import { ChevronIcon, CloseIcon } from '../components/icons';
import { useToast } from '../components/toast';
import { localePath } from '../i18n/lang';
import { fmt, type Messages } from '../i18n/messages';
import { useLang, useMessages } from '../i18n/use-lang';
import { type Kernel, loadKernel, useKernelState } from '../kernel/kernel';
import { type ImportState, fileProblems, runImport } from './import';
import { ImportPanel, ProblemList } from './import-panel';
import { type SectionCoverage, activePack, builtinPack, coverage, defaultPackInfo, packRaw } from './kernel-pack';
import * as css from './knowledge.css';
import {
  DEFAULT_PACK_ID,
  DEFAULT_USE,
  type Draft,
  type ExtendsAdvice,
  type Pack,
  SECTIONS,
  type Section,
  type Use,
  activeIds,
  addLayer,
  diffAgainst,
  extendsAdvice,
  moveLayer,
  removeLayer,
  withoutPack,
  withoutPacks,
} from './library';
import { CountList, activePacks, diffText, importedText, totalOf, useLabel } from './parts';
import { type LibraryState, addPack, deleteDraft, removePack, updateUse, useLibrary } from './use-library';
import { useBrokenPacks, useRepairNotice, useRetireBroken } from './chart-knowledge';
import { ViewDrawer } from './view-drawer';
import { downloadJson } from '../lib/download';
import { draftForPack, editorHref, newDraft } from '../editor/actions';
import { compareOf, draftProblems, sameAsLibrary } from '../editor/model';
import { NewPackDialog } from '../editor/new-dialog';
import { draftLine } from '../editor/write-page';

function packFile(p: Pack): string {
  return `${p.id}-${p.version ?? 'unversioned'}.json`;
}

/** 缺释义的一段：「星曜 3 条（流禄、流羊、流马）」，多于 8 个时只列前 8 个。 */
function missingText(t: Messages, s: Section, keys: readonly string[], nameOf: (s: Section, key: string) => string): string {
  const shown = keys.slice(0, 8).map((k) => nameOf(s, k)).join(t.knowledge.diff.sep);
  return fmt(t.knowledge.use.missing, {
    section: t.knowledge.sections[s],
    n: keys.length,
    names: keys.length > 8 ? fmt(t.knowledge.use.missingMore, { names: shown }) : shown,
  });
}

/**
 * 当前生效（设计规范第 18.4 节）：从下到上叠放的各层（左边是最下面），后面的覆盖前面的；生效卡片写合并后各段的覆盖度与缺释义的条目。
 * 改动立即生效并写进本机。
 */
function UsePanel({
  t,
  use,
  packs,
  defaultPack,
  blocked,
  cover,
  nameOf,
  onChange,
}: {
  t: Messages;
  use: Use;
  /** 本机能生效的包（不含「需要改」的）。 */
  packs: readonly Pack[];
  defaultPack: Pack;
  /** 存储不可用或读库失败：组合改不了，只有默认包。 */
  blocked: boolean;
  /** 合并后各段的覆盖度；内核装好之前为 null。 */
  cover: Record<Section, SectionCoverage> | null;
  /** 标识的显示名（缺释义的条目用）。 */
  nameOf: (s: Section, key: string) => string;
  /** 改组合：传入由库里此刻的组合算出新组合的函数（见 `updateUse`）。 */
  onChange: (next: (use: Use) => Use) => void;
}) {
  const u = t.knowledge.use;
  const active = activePacks(use, packs, defaultPack);
  const all = [defaultPack, ...packs];
  const addable = all.filter((p) => !use.layers.includes(p.id));
  const counts = cover ? (Object.fromEntries(SECTIONS.map((s) => [s, cover[s].have])) as Record<Section, number>) : null;
  const totals = Object.fromEntries(SECTIONS.map((s) => [s, cover?.[s].total ?? defaultPack.counts[s]])) as Record<Section, number>;
  const missing = cover ? SECTIONS.filter((s) => cover[s].missing.length > 0) : [];
  return (
    <section className={css.use} aria-labelledby="knowledge-use-title">
      <div className={css.useHead}>
        <h2 id="knowledge-use-title" className={css.sectionTitle}>
          {u.title}
        </h2>
      </div>
      <div className={css.row}>
        {active.map((p, i) => (
          <Layer
            key={p.id}
            t={t}
            pack={p}
            index={i}
            count={active.length}
            blocked={blocked}
            note={
              p.id === DEFAULT_PACK_ID && i === 0
                ? u.defaultNote
                : i === 0
                  ? fmt(u.total, { n: totalOf(p.counts) })
                  : diffText(diffAgainst(p, active.slice(0, i)), t)
            }
            advice={extendsAdvice(p, use, packs)}
            onMove={(dir) => onChange((now) => moveLayer(now, p.id, dir))}
            onRemove={() => onChange((now) => removeLayer(now, p.id))}
          />
        ))}
        <span className={`${css.op} ${css.opEq}`} aria-hidden="true">
          =
        </span>
        <div className={`${css.sheet} ${css.sheetResult}`} aria-live="polite">
          <small className={css.sheetKind}>{u.result}</small>
          <b className={css.sheetName}>{useLabel(active)}</b>
          {counts && <CountList counts={counts} base={totals} t={t} label={u.coverLabel} />}
          {cover && (
            <p className={css.sheetNote}>
              {missing.length ? (
                <>
                  {u.missingTitle}
                  {missing.map((s) => missingText(t, s, cover[s].missing, nameOf)).join(t.knowledge.diff.sep)}
                </>
              ) : (
                u.fullCover
              )}
            </p>
          )}
          <p className={css.sheetNote}>{u.resultNote}</p>
        </div>
      </div>
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
                disabled={blocked}
                onClick={() => onChange((now) => addLayer(now, p.id))}
              >
                {p.name}
              </button>
            ))}
            <span>{u.addHint}</span>
          </>
        ) : (
          <span>{u.allIn}</span>
        )}
      </p>
    </section>
  );
}

function Layer({
  t,
  pack,
  index,
  count,
  blocked,
  note,
  advice,
  onMove,
  onRemove,
}: {
  t: Messages;
  pack: Pack;
  index: number;
  count: number;
  blocked: boolean;
  note: string;
  advice: ExtendsAdvice;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const u = t.knowledge.use;
  return (
    <>
      {index > 0 && (
        <span className={css.op} aria-hidden="true">
          +
        </span>
      )}
      <div className={index === 0 ? `${css.sheet} ${css.sheetBase}` : css.sheet}>
        <small className={css.sheetKind}>{index === 0 ? u.bottom : fmt(u.layer, { n: index + 1 })}</small>
        <b className={css.sheetName}>{pack.name}</b>
        <span className={css.sheetId}>
          {pack.id}
          <span className={css.sheetVersion}>{pack.version}</span>
        </span>
        <p className={css.sheetNote}>{note}</p>
        {advice && <p className={css.sheetAdvice}>{fmt(advice.kind === 'absent' ? u.adviceAbsent : u.adviceNotBelow, { target: advice.target })}</p>}
        <div className={css.sheetActions}>
          <button type="button" className={css.sheetAction} aria-label={fmt(u.moveDown, { name: pack.name })} disabled={blocked || index === 0} onClick={() => onMove(-1)}>
            <span className={css.arrowH}>
              <ChevronIcon dir="left" />
            </span>
            <span className={css.arrowV}>
              <ChevronIcon dir="up" />
            </span>
          </button>
          <button
            type="button"
            className={css.sheetAction}
            aria-label={fmt(u.moveUp, { name: pack.name })}
            disabled={blocked || index === count - 1}
            onClick={() => onMove(1)}
          >
            <span className={css.arrowH}>
              <ChevronIcon dir="right" />
            </span>
            <span className={css.arrowV}>
              <ChevronIcon dir="down" />
            </span>
          </button>
          <button
            type="button"
            className={css.sheetAction}
            aria-label={fmt(u.remove, { name: pack.name })}
            aria-description={count === 1 ? u.lastLayer : undefined}
            disabled={blocked || count === 1}
            onClick={onRemove}
          >
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
  onEdit,
  onBaseNew,
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
  /** 编辑一个用户包（进编辑器）；本机包库不可用时为 null。 */
  onEdit: ((p: Pack) => void) | null;
  /** 基于一个包新建（打开新建对话框）；本机包库不可用时为 null。 */
  onBaseNew: ((p: Pack) => void) | null;
}) {
  const l = t.knowledge.list;
  const rows = [defaultPack, ...packs];
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
          const declared = p.extends === null ? (isDefault ? '—' : l.whole) : base ? base.name : fmt(t.knowledge.imp.absentBase, { target: p.extends });
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
                    {declared}
                  </span>
                  <span>
                    <small className={css.metaLabel}>{p.savedAt === null ? l.imported : l.saved}</small>
                    {p.importedAt === null ? l.builtin : importedText(p.savedAt ?? p.importedAt)}
                  </span>
                </div>
                <CountList counts={p.counts} base={defaultPack.counts} t={t} className={css.packCounts} />
                {isDefault ? (
                  <p className={css.packSource}>{fmt(l.defaultSource, { license: p.license ?? '—', author: p.author ?? '—' })}</p>
                ) : base ? (
                  <p className={css.packSource}>{fmt(l.overlaySource, { diff: diffText(diffAgainst(p, [base]), t), base: base.name })}</p>
                ) : null}
                {issues && (
                  <>
                    <p className={css.problemLabel}>{fmt(l.brokenNote, { n: issues.length })}</p>
                    <ProblemList problems={issues.map((issue) => ({ code: 'issue' as const, issue }))} t={t} />
                  </>
                )}
              </div>
              <div className={css.packActions} role="group" aria-label={fmt(l.actionsLabel, { name: p.name })}>
                {!isDefault && onEdit && (
                  <Button className={css.packAction} onPress={() => onEdit(p)}>
                    {t.editor.editPack}
                  </Button>
                )}
                <Button className={css.packAction} isDisabled={!readable} onPress={() => onView(p)}>
                  {l.view}
                </Button>
                <Button className={css.packAction} isDisabled={!readable} onPress={() => onExport(p)}>
                  {l.export}
                </Button>
                {onBaseNew && (
                  <Button className={css.packAction} isDisabled={!readable} onPress={() => onBaseNew(p)}>
                    {t.editor.basedNew}
                  </Button>
                )}
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

/**
 * 草稿区（设计规范 20.2「知识包页」）：在「本机的包」下方，有未保存到包库的草稿时才出现（与包库一致的草稿不列）。
 */
function DraftList({ t, kernel, lib, onDiscard }: { t: Messages; kernel: Kernel; lib: Extract<LibraryState, { status: 'ready' }>; onDiscard: (d: Draft) => void }) {
  const lang = useLang();
  const navigate = useNavigate();
  const e = t.editor;
  const def = defaultPackInfo(kernel);
  const drafts = lib.drafts.filter((d) => !sameAsLibrary(d));
  if (!drafts.length) return null;
  return (
    <section aria-labelledby="knowledge-drafts-title" className={css.drafts}>
      <div className={css.sectionHead}>
        <h2 id="knowledge-drafts-title" className={css.sectionTitle}>
          {e.draftsTitle}
        </h2>
        <span className={css.sectionAux}>{e.draftsNote}</span>
      </div>
      <ul className={css.packs}>
        {drafts.map((d) => {
          const compare = compareOf(kernel, d.raw, lib.packs, def);
          const errors = draftProblems(kernel, d, compare, lib.packs, lib.drafts).filter((p) => p.level === 'error').length;
          const name = String((d.raw.source as { name?: string } | undefined)?.name ?? d.raw.id ?? '');
          return (
            <li key={d.id} className={css.pack}>
              <div>
                <b className={css.packName}>{name}</b>
                <div className={css.meta}>
                  <span>{String(d.raw.id ?? '')}</span>
                  <span>{d.editing ? e.draftKindEdit : e.draftKindNew}</span>
                  <span>{compare ? fmt(e.basedOn, { name: compare.label }) : e.newPack}</span>
                  <span>{draftLine(d, t)}</span>
                  {errors > 0 && <span className={css.draftErrors}>{fmt(e.draftErrors, { n: errors })}</span>}
                </div>
              </div>
              <div className={css.packActions} role="group" aria-label={name}>
                <Button className={css.packAction} onPress={() => navigate(editorHref(lang, { draft: d.id, from: 'knowledge' }, ''))}>
                  {e.continueEdit}
                </Button>
                <Button className={css.packAction} onPress={() => onDiscard(d)}>
                  {e.discard}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** 丢弃草稿的确认：默认聚焦「取消」。 */
function DiscardDialog({ t, draft, onCancel, onConfirm }: { t: Messages; draft: Draft; onCancel: () => void; onConfirm: () => void }) {
  const e = t.editor;
  const name = String((draft.raw.source as { name?: string } | undefined)?.name ?? draft.raw.id ?? '');
  return (
    <ModalOverlay isOpen isDismissable onOpenChange={(o) => !o && onCancel()} className={css.scrim}>
      <Modal className={css.dialog}>
        <Dialog role="alertdialog" aria-labelledby="discard-title" aria-describedby="discard-body">
          <Heading slot="title" id="discard-title" className={css.dialogTitle}>
            {fmt(e.discardTitle, { name })}
          </Heading>
          <p id="discard-body" className={css.dialogBody}>
            {draft.editing ? fmt(e.discardBodyOwn, { name }) : e.discardBody}
          </p>
          <div className={css.dialogActions}>
            <Button className={controls.ghost} onPress={onCancel} autoFocus>
              {e.cancel}
            </Button>
            <Button className={`${controls.button} ${css.danger}`} onPress={onConfirm}>
              {e.discard}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
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
  const dependents = packs.filter((p) => p.extends === pack.id);
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
                {fmt(d.activeLeft, { label: useLabel(rest) })}
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
  const [creating, setCreating] = useState<{ base: string | null } | null>(null);
  const [discarding, setDiscarding] = useState<Draft | null>(null);
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
  const changeUse = (next: (u: Use) => Use) =>
    void act(async () => {
      await updateUse(next);
    });
  // 合并后各段的覆盖度：组合里有「需要改」的包时按去掉它们之后的组合算（与排盘页一致）。
  const cover = useMemo(() => (kernel ? coverage(kernel, activePack(kernel, use, usable)) : null), [kernel, use, usable]);
  // 缺释义的条目的名字：取默认包里同一条目的名字（它覆盖内核认识的全部标识），没有就用标识。
  const nameOf = useMemo(() => {
    const names = kernel ? builtinPack(kernel).toJSON() : {};
    return (s: Section, key: string) => {
      const entry = (names[s] as Record<string, { name?: unknown }> | undefined)?.[key];
      return typeof entry?.name === 'string' ? entry.name : key;
    };
  }, [kernel]);
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
          <Link className={`${controls.button} ${css.headAction}`} href={localePath(lang, '/knowledge/write')}>
            {t.editor.writeTitle}
          </Link>
          <Button
            className={`${controls.ghost} ${css.headAction}`}
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
      <UsePanel t={t} use={use} packs={usable} defaultPack={defaultPack} blocked={blocked} cover={cover} nameOf={nameOf} onChange={changeUse} />
      <div className={css.grid}>
        <div>
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
              downloadJson(raw, packFile(p));
              toast(fmt(t.knowledge.exported, { file: packFile(p) }));
            }}
            onDelete={setDeleting}
            onEdit={
              ready && kernel
                ? (p) =>
                    void act(async () => {
                      const d = await draftForPack(p, lib.drafts);
                      navigate(editorHref(lang, { draft: d.id, from: 'knowledge' }, ''));
                    })
                : null
            }
            onBaseNew={ready && kernel ? (p) => setCreating({ base: p.id }) : null}
          />
          {ready && kernel && <DraftList t={t} kernel={kernel} lib={lib} onDiscard={setDiscarding} />}
        </div>
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
                const snap = await updateUse((u) => addLayer(u, p.id));
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
      {creating && ready && kernel && (
        <NewPackDialog
          t={t}
          packs={lib.packs}
          defaultPack={defaultPack}
          drafts={lib.drafts}
          base={creating.base}
          onCancel={() => setCreating(null)}
          onStart={(raw) => {
            setCreating(null);
            void act(async () => {
              const d = await newDraft(raw, null);
              navigate(editorHref(lang, { draft: d.id, from: 'knowledge' }, ''));
            });
          }}
        />
      )}
      {discarding && ready && (
        <DiscardDialog
          t={t}
          draft={discarding}
          onCancel={() => setDiscarding(null)}
          onConfirm={() => {
            const d = discarding;
            setDiscarding(null);
            void act(async () => {
              await deleteDraft(d.id);
            });
          }}
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

