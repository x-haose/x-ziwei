import * as controls from '../components/controls.css';
import { fmt, type Messages } from '../i18n/messages';
import type { Kernel } from '../kernel/kernel';
import { problemText } from '../knowledge/import-panel';
import { coverage } from '../knowledge/kernel-pack';
import { type Draft, type Pack, type PackRaw, SECTIONS } from '../knowledge/library';
import * as css from './editor.css';
import { type Compare, type Problem, entryStatus, today } from './model';

const LANGS = ['zh-CN', 'zh-TW', 'en-US', 'ja-JP', 'ko-KR', 'vi-VN'] as const;
const SOURCE_FIELDS = ['author', 'license', 'url', 'retrievedAt', 'adapted'] as const;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** 改一个包级字段；空字符串即删掉该字段（不存空值）。 */
function setMeta(raw: PackRaw, field: string, value: string): PackRaw {
  const out = { ...raw };
  if (value === '') delete out[field];
  else out[field] = value;
  return out;
}

function setSource(raw: PackRaw, field: string, value: string): PackRaw {
  const source = isRecord(raw.source) ? { ...raw.source } : {};
  if (value === '') delete source[field];
  else source[field] = value;
  const out = { ...raw };
  if (Object.keys(source).length) out.source = source;
  else delete out.source;
  return out;
}

/**
 * 包信息（设计规范 20.10）：名称、标识（进了包库只读，可另存为新包）、版本、语言、声明基于（只读）、来源与许可，
 * 以及改动表（有对照）或覆盖度表（没有对照）。
 */
export function PackInfo({
  t,
  kernel,
  raw,
  draft,
  compare,
  packs,
  problems,
  edit,
  onSaveAsNew,
  onExport,
}: {
  t: Messages;
  kernel: Kernel;
  raw: PackRaw;
  draft: Draft;
  compare: Compare | null;
  packs: readonly Pack[];
  problems: readonly Problem[];
  edit: (f: (raw: PackRaw) => PackRaw) => void;
  onSaveAsNew: () => void;
  onExport: () => void;
}) {
  const e = t.editor;
  const source = (isRecord(raw.source) ? raw.source : {}) as Record<string, string>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const at = (field: string) =>
    problems
      .filter((p) => p.at.entry === null && p.at.field === field)
      .map((p, i) => (
        <p key={i} className={p.level === 'error' ? `${css.problem} ${css.problemError}` : css.problem}>
          {problemText(p.issue ? { code: 'issue', issue: p.issue } : p.library!, t).text}
        </p>
      ));
  const ext = typeof raw.extends === 'string' ? raw.extends : null;
  const extText = ext === null ? e.infoExtendsNone : compare ? `${ext}（${compare.label}）` : packs.some((p) => p.id === ext) ? ext : fmt(e.infoExtendsAbsent, { id: ext });
  // 覆盖度按本包原文数（草稿可能还有必须改的问题，构造不成内核的包），总数取内核认识的标识数。
  const totals = coverage(kernel, kernel.KnowledgePack.fromObject({ schema: 1, id: 'cover', version: '1', language: 'zh-CN' }));
  const sameVersion = draft.snapshot !== null && draft.snapshot.version === raw.version && JSON.stringify(draft.snapshot) !== JSON.stringify(raw);
  return (
    <article>
      <h2 className={css.entryName} tabIndex={-1}>
        {e.packInfo}
      </h2>
      <label className={css.infoField}>
        <span className={css.infoLabel}>{e.infoName}</span>
        <input className={css.input} value={str(source.name)} onChange={(ev) => edit((r) => setSource(r, 'name', ev.target.value))} />
        <span className={css.infoNote}>{e.infoNameNote}</span>
        {at('source')}
      </label>
      <div className={css.infoField}>
        <label htmlFor="pack-id" className={css.infoLabel}>
          {e.infoId}
        </label>
        <input id="pack-id" className={`${css.input} ${css.mono}`} value={str(raw.id)} readOnly={draft.editing !== null} onChange={(ev) => edit((r) => setMeta(r, 'id', ev.target.value))} />
        {draft.editing !== null && (
          <span className={css.infoNote}>
            {e.infoIdLocked}{' '}
            <button type="button" className={css.textButton} onClick={onSaveAsNew}>
              {e.saveAsNew}
            </button>
          </span>
        )}
        {at('id')}
      </div>
      <label className={css.infoField}>
        <span className={css.infoLabel}>
          {e.infoVersion}{' '}
          <button type="button" className={css.textButton} onClick={() => edit((r) => setMeta(r, 'version', today(new Date())))}>
            {e.useToday}
          </button>
        </span>
        <input className={`${css.input} ${css.mono}`} value={str(raw.version)} onChange={(ev) => edit((r) => setMeta(r, 'version', ev.target.value))} />
        {sameVersion && <span className={css.infoNote}>{e.infoVersionNote}</span>}
        {at('version')}
      </label>
      <div className={css.infoField}>
        <span className={css.infoLabel}>{e.infoLanguage}</span>
        <div className={css.tags} role="radiogroup" aria-label={e.infoLanguage}>
          {LANGS.map((l) => (
            <button key={l} type="button" role="radio" aria-checked={raw.language === l} className={raw.language === l ? `${css.chip} ${css.tagOn}` : css.chip} onClick={() => edit((r) => setMeta(r, 'language', l))}>
              {e.langs[l]}
            </button>
          ))}
        </div>
        {at('language')}
      </div>
      <div className={css.infoField}>
        <span className={css.infoLabel}>{e.infoExtends}</span>
        <span>{extText}</span>
        <span className={css.infoNote}>{e.infoExtendsNote}</span>
      </div>
      <div className={css.infoField}>
        <span className={css.fieldName}>{e.infoSource}</span>
        <span className={css.infoNote}>{e.infoSourceNote}</span>
        {SOURCE_FIELDS.map((f) => (
          <label key={f} className={css.formField}>
            <span className={css.infoLabel}>{e.source[f]}</span>
            <input className={css.input} value={str(source[f])} onChange={(ev) => edit((r) => setSource(r, f, ev.target.value))} />
          </label>
        ))}
      </div>
      <div className={css.infoField}>
        <span className={css.fieldName}>{compare ? e.changesTitle : e.coverageTitle}</span>
        <table className={css.infoTable}>
          <tbody>
            {SECTIONS.map((s) => {
              const keys = isRecord(raw[s]) ? Object.keys(raw[s]) : [];
              const changed = keys.filter((k) => entryStatus(raw, compare, { section: s, key: k }) === 'changed').length;
              return (
                <tr key={s}>
                  <td>{t.knowledge.sections[s]}</td>
                  <td>
                    {compare
                      ? fmt(e.changesRow, { changed, added: keys.length - changed })
                      : totals[s].total === null
                        ? fmt(e.sectionWrittenOnly, { n: keys.length })
                        : fmt(e.coverageRow, { n: keys.filter((k) => typeof (raw[s] as Record<string, { intro?: unknown }>)[k]?.intro === 'string').length, total: totals[s].total })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="button" className={controls.ghost} onClick={onExport}>
        {e.exportJson}
      </button>
    </article>
  );
}
