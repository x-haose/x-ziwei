import { type ReactNode, useEffect, useRef, useState } from 'react';
import { OptionGrid, Picker } from '../birth/picker';
import * as controls from '../components/controls.css';
import { CaretIcon, CloseIcon } from '../components/icons';
import { fmt, type Messages } from '../i18n/messages';
import type { Kernel } from '../kernel/kernel';
import { problemText } from '../knowledge/import-panel';
import type { PackRaw } from '../knowledge/library';
import { SUMMARY_MAX, SUMMARY_WIDTH, displayWidth } from '../lib/text-width';
import { Markdown } from '../markdown/markdown';
import * as css from './editor.css';
import { type Compare, type EntryRef, type Problem, compareEntry, entryOf, entryStatus, removeEntry, setField, setSubField } from './model';

/** 改草稿：收到草稿原文，返回新的原文。 */
export type Edit = (f: (raw: PackRaw) => PackRaw) => void;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** 字段位置：条目上的字段，或组合里对方主星那一项（`combinations.tanlangMaj`）。 */
interface Path {
  field: string;
  sub?: string;
}

const pathId = (p: Path) => (p.sub ? `${p.field}.${p.sub}` : p.field);

function read(entry: Record<string, unknown> | undefined, p: Path): unknown {
  if (!entry) return undefined;
  const v = entry[p.field];
  if (p.sub === undefined) return v;
  return isRecord(v) ? v[p.sub] : undefined;
}

function write(raw: PackRaw, e: EntryRef, p: Path, value: unknown): PackRaw {
  return p.sub === undefined ? setField(raw, e, p.field, value) : setSubField(raw, e, p.field, p.sub, value);
}

interface Ctx {
  t: Messages;
  kernel: Kernel;
  entry: EntryRef;
  own: Record<string, unknown> | undefined;
  base: Record<string, unknown> | undefined;
  compare: Compare | null;
  problems: readonly Problem[];
  edit: Edit;
}

function ProblemsAt({ ctx, path }: { ctx: Ctx; path: string | null }) {
  const list = ctx.problems.filter((p) => p.at.field === path);
  if (!list.length) return null;
  return (
    <>
      {list.map((p, i) => {
        const text = problemText(p.issue ? { code: 'issue', issue: p.issue } : p.library!, ctx.t).text;
        return (
          <p key={i} className={p.level === 'error' ? `${css.problem} ${css.problemError}` : css.problem}>
            <span className={css.problemLead}>{p.level === 'error' ? `${ctx.t.editor.problemError}：` : `${ctx.t.editor.problemWarning}：`}</span>
            {text}
          </p>
        );
      })}
    </>
  );
}

/** 宽度条：正文到 480、240 处有刻度；摘要到 100。 */
function WidthBar({ t, text, summary }: { t: Messages; text: string; summary: boolean }) {
  const w = displayWidth(text);
  const max = summary ? SUMMARY_MAX : 480;
  const over = summary ? w > SUMMARY_MAX : w > SUMMARY_WIDTH;
  return (
    <div className={css.widthBar}>
      <span>{summary ? fmt(t.editor.widthSummary, { n: w }) : fmt(t.editor.width, { n: w })}</span>
      <span className={css.widthTrack} aria-hidden="true">
        <span className={css.widthFill} data-over={over ? '' : undefined} style={{ width: `${Math.min(100, (w / max) * 100)}%` }} />
        {!summary && <span className={css.widthTick} style={{ left: `${(SUMMARY_WIDTH / max) * 100}%` }} />}
      </span>
      <span className={over && summary ? css.widthOver : undefined}>
        {summary ? (over ? fmt(t.editor.widthOver, { n: w - SUMMARY_MAX }) : t.editor.widthSummaryNote) : over ? t.editor.widthLong : t.editor.widthShort}
      </span>
    </div>
  );
}

/** Markdown 编辑框：工具行（加粗、行内代码、列表、引用、预览）、编辑框与宽度条。 */
function MarkdownBox({ t, label, value, short, invalid, onChange, autoFocus }: { t: Messages; label: string; value: string; short: boolean; invalid: boolean; onChange: (v: string) => void; autoFocus?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  const wrap = (before: string, after: string) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    onChange(`${value.slice(0, a)}${before}${value.slice(a, b)}${after}${value.slice(b)}`);
  };
  const prefix = (mark: string) => {
    const el = ref.current;
    if (!el) return;
    const a = value.lastIndexOf('\n', el.selectionStart - 1) + 1;
    const b = el.selectionEnd;
    const lines = value.slice(a, b).split('\n').map((l) => `${mark}${l}`);
    onChange(`${value.slice(0, a)}${lines.join('\n')}${value.slice(b)}`);
  };
  const tools = t.editor.tools;
  return (
    <div>
      <div className={css.toolbar} role="toolbar" aria-label={label}>
        <button type="button" className={css.tool} aria-label={tools.bold} disabled={preview} onClick={() => wrap('**', '**')}>
          B
        </button>
        <button type="button" className={css.tool} aria-label={tools.code} disabled={preview} onClick={() => wrap('`', '`')}>
          `x`
        </button>
        <button type="button" className={css.tool} aria-label={tools.list} disabled={preview} onClick={() => prefix('- ')}>
          •
        </button>
        <button type="button" className={css.tool} aria-label={tools.quote} disabled={preview} onClick={() => prefix('> ')}>
          ❝
        </button>
        <span className={css.toolSpace} />
        <button type="button" className={css.tool} aria-pressed={preview} onClick={() => setPreview((p) => !p)}>
          {tools.preview}
        </button>
      </div>
      {preview ? (
        <div className={css.rendered}>
          <Markdown source={value} variant="preview" />
        </div>
      ) : (
        <textarea
          ref={ref}
          className={short ? `${css.textarea} ${css.textareaShort}` : css.textarea}
          aria-label={label}
          aria-invalid={invalid ? true : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <WidthBar t={t} text={value} summary={short} />
    </div>
  );
}

/** 字段头：名称、状态（沿用 / 已改写 / 已写），右侧恢复或删除。 */
function FieldHead({ ctx, label, own, onRestore }: { ctx: Ctx; label: string; own: boolean; onRestore: () => void }) {
  const e = ctx.t.editor;
  return (
    <div className={css.fieldHead}>
      <h3 className={css.fieldName}>{label}</h3>
      {ctx.compare ? own ? <span className={css.changed}>{e.changedTag}</span> : <span className={css.fieldState}>{e.status.inherit}</span> : null}
      <span className={css.toolSpace} />
      {own && (
        <button type="button" className={css.textButton} onClick={onRestore}>
          {ctx.compare ? e.restore : e.removeField}
        </button>
      )}
    </div>
  );
}

/** 对照的原文（≥1360 在左栏，更窄时在编辑区上方、可收起）。 */
function CompareText({ ctx, children }: { ctx: Ctx; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const label = ctx.compare!.label;
  return (
    <div className={css.compare}>
      <button type="button" className={css.compareToggle} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {fmt(ctx.t.editor.compareToggle, { base: label })}
        <span className={css.caret}>
          <CaretIcon />
        </span>
      </button>
      <div className={css.compareBody} data-closed={open ? undefined : ''}>
        <p className={css.compareLabel}>{fmt(ctx.t.editor.compareWith, { base: label })}</p>
        {children}
      </div>
    </div>
  );
}

/**
 * 一个正文类字段（设计规范 20.3、20.7）。有对照时三态：沿用（换成说明块与「改写」）、已改写（编辑框与「恢复」）；
 * 没有对照时两态：未写（「写这一项」）、已写（编辑框与「删除这一项」）。只有改写过的字段写进本包。
 */
function TextField({ ctx, path, label, short = false }: { ctx: Ctx; path: Path; label: string; short?: boolean }) {
  const e = ctx.t.editor;
  const own = read(ctx.own, path) as string | undefined;
  const base = read(ctx.base, path) as string | undefined;
  const [focus, setFocus] = useState(false);
  const set = (v: string | undefined) => ctx.edit((raw) => write(raw, ctx.entry, path, v));
  const errors = ctx.problems.some((p) => p.level === 'error' && p.at.field === pathId(path));
  const editor =
    own === undefined ? (
      ctx.compare ? (
        <div className={css.inherit}>
          {base !== undefined ? fmt(e.inherit, { base: ctx.compare.label }) : fmt(e.inheritNone, { base: ctx.compare.label })}
          <div>
            <button
              type="button"
              className={`${controls.ghost} ${css.inheritButton}`}
              onClick={() => {
                setFocus(true);
                set(base ?? '');
              }}
            >
              {base !== undefined ? e.rewrite : e.writeField}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={`${controls.ghost} ${css.inheritButton}`}
          onClick={() => {
            setFocus(true);
            set('');
          }}
        >
          {e.writeField}
        </button>
      )
    ) : (
      <MarkdownBox t={ctx.t} label={label} value={own} short={short} invalid={errors} onChange={set} autoFocus={focus} />
    );
  return (
    <section className={css.field} data-field={pathId(path)}>
      <FieldHead ctx={ctx} label={label} own={own !== undefined} onRestore={() => set(undefined)} />
      {ctx.compare ? (
        <div className={css.fieldGrid}>
          <CompareText ctx={ctx}>{base !== undefined ? <Markdown source={base} variant="preview" /> : <p>{fmt(e.inheritNone, { base: ctx.compare.label })}</p>}</CompareText>
          <div>{editor}</div>
        </div>
      ) : (
        <div className={css.fieldGridSingle}>{editor}</div>
      )}
      <ProblemsAt ctx={ctx} path={pathId(path)} />
    </section>
  );
}

/** 摘要栏：按与对照合并后的正文判断要不要给编辑区（设计规范 20.7「摘要栏」）。 */
function SummaryField({ ctx, intro, summary, label }: { ctx: Ctx; intro: Path; summary: Path; label: string }) {
  const e = ctx.t.editor;
  const ownIntro = read(ctx.own, intro) as string | undefined;
  const mergedIntro = ownIntro ?? (read(ctx.base, intro) as string | undefined);
  const ownSummary = read(ctx.own, summary) as string | undefined;
  const baseSummary = read(ctx.base, summary) as string | undefined;
  const w = mergedIntro === undefined ? 0 : displayWidth(mergedIntro);
  if (ownSummary === undefined && mergedIntro !== undefined && w <= SUMMARY_WIDTH) {
    return (
      <section className={css.field} data-field={pathId(summary)}>
        <FieldHead ctx={{ ...ctx, compare: null }} label={label} own={false} onRestore={() => undefined} />
        <p className={css.lead}>{fmt(e.summaryUseIntro, { n: w })}</p>
        <ProblemsAt ctx={ctx} path={pathId(summary)} />
      </section>
    );
  }
  if (ownSummary === undefined && ownIntro !== undefined && w > SUMMARY_WIDTH && baseSummary !== undefined) {
    return (
      <section className={css.field} data-field={pathId(summary)}>
        <FieldHead ctx={{ ...ctx, compare: null }} label={label} own={false} onRestore={() => undefined} />
        <p className={css.lead}>{fmt(e.summaryStale, { n: w })}</p>
        <button type="button" className={controls.button} onClick={() => ctx.edit((raw) => write(raw, ctx.entry, summary, ''))}>
          {e.writeSummary}
        </button>
        <ProblemsAt ctx={ctx} path={pathId(summary)} />
      </section>
    );
  }
  return <TextField ctx={ctx} path={summary} label={label} short />;
}

/** 单行字段（名称、标题、分组）。没有对照时留空即删掉该字段。 */
function LineField({ ctx, field, label }: { ctx: Ctx; field: string; label: string }) {
  const own = ctx.own?.[field] as string | undefined;
  const base = ctx.base?.[field] as string | undefined;
  const errors = ctx.problems.some((p) => p.level === 'error' && p.at.field === field);
  return (
    <label className={css.infoField}>
      <span className={css.infoLabel}>
        {label}
        {ctx.compare && own !== undefined && (
          <button type="button" className={css.textButton} style={{ marginLeft: 12 }} onClick={() => ctx.edit((raw) => setField(raw, ctx.entry, field, undefined))}>
            {ctx.t.editor.restore}
          </button>
        )}
      </span>
      <input
        className={css.input}
        value={own ?? ''}
        placeholder={base ?? ''}
        aria-invalid={errors ? true : undefined}
        onChange={(ev) => ctx.edit((raw) => setField(raw, ctx.entry, field, ev.target.value === '' ? undefined : ev.target.value))}
      />
      <ProblemsAt ctx={ctx} path={field} />
    </label>
  );
}

/** 分段按钮（阴阳、五行、天干、分类）：选中即写进本包，再点一次已选的一项回到沿用。 */
function Choices({ label, options, value, onChange }: { label: string; options: readonly { value: string; text: string }[]; value: string | undefined; onChange: (v: string | undefined) => void }) {
  return (
    <div className={css.tags} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? `${css.chip} ${css.tagOn}` : css.chip} onClick={() => onChange(value === o.value ? undefined : o.value)}>
          {o.text}
        </button>
      ))}
    </div>
  );
}

const ATTR_CHOICES: Record<string, readonly string[]> = {
  yinYang: ['yin', 'yang'],
  fiveElements: ['wood', 'fire', 'earth', 'metal', 'water'],
  stem: ['jia', 'yi', 'bing', 'ding', 'wu', 'ji', 'geng', 'xin', 'ren', 'gui'],
};
const ATTR_LINES = ['dipper', 'chemistry', 'career', 'duty'] as const;

/** 门派属性（设计规范 20.7）：逐项改写，没改的沿用对照的值；别号整组替换。 */
function Attributes({ ctx }: { ctx: Ctx }) {
  const e = ctx.t.editor;
  const own = (isRecord(ctx.own?.attributes) ? ctx.own.attributes : {}) as Record<string, unknown>;
  const base = (isRecord(ctx.base?.attributes) ? ctx.base.attributes : {}) as Record<string, unknown>;
  const set = (k: string, v: unknown) => ctx.edit((raw) => setSubField(raw, ctx.entry, 'attributes', k, v));
  const valueText = (v: unknown) => (Array.isArray(v) ? v.join('、') : typeof v === 'string' ? (e.attrValues[v] ?? v) : '');
  const [alias, setAlias] = useState('');
  const aliases = (own.aliases ?? base.aliases ?? []) as string[];
  return (
    <section className={css.field} data-field="attributes">
      <div className={css.fieldHead}>
        <h3 className={css.fieldName}>{e.fields.attributes}</h3>
      </div>
      <table className={css.attrTable}>
        <thead>
          <tr>
            <th>{e.attrCols.name}</th>
            {ctx.compare && <th className={css.attrBase}>{e.attrCols.base}</th>}
            <th>{e.attrCols.own}</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(ATTR_CHOICES).map(([k, opts]) => (
            <tr key={k}>
              <td>{e.attrs[k as keyof typeof e.attrs]}</td>
              {ctx.compare && <td className={css.attrBase}>{valueText(base[k])}</td>}
              <td>
                <Choices label={e.attrs[k as keyof typeof e.attrs]} options={opts.map((v) => ({ value: v, text: e.attrValues[v] ?? v }))} value={own[k] as string | undefined} onChange={(v) => set(k, v)} />
              </td>
            </tr>
          ))}
          {ATTR_LINES.map((k) => (
            <tr key={k}>
              <td>{e.attrs[k]}</td>
              {ctx.compare && <td className={css.attrBase}>{valueText(base[k])}</td>}
              <td>
                <input className={css.input} aria-label={e.attrs[k]} value={(own[k] as string | undefined) ?? ''} placeholder={valueText(base[k])} onChange={(ev) => set(k, ev.target.value === '' ? undefined : ev.target.value)} />
              </td>
            </tr>
          ))}
          <tr>
            <td>{e.attrs.aliases}</td>
            {ctx.compare && <td className={css.attrBase}>{valueText(base.aliases)}</td>}
            <td>
              <div className={css.tags}>
                {aliases.map((a) => (
                  <span key={a} className={css.chip}>
                    {a}
                    <button type="button" className={css.chipX} aria-label={fmt(e.aliasRemove, { name: a })} onClick={() => set('aliases', aliases.filter((x) => x !== a))}>
                      <CloseIcon />
                    </button>
                  </span>
                ))}
                <input
                  className={css.input}
                  style={{ width: 160 }}
                  aria-label={e.aliasAdd}
                  placeholder={e.aliasAdd}
                  value={alias}
                  onChange={(ev) => setAlias(ev.target.value)}
                  onKeyDown={(ev) => {
                    if (ev.key !== 'Enter' || ev.nativeEvent.isComposing || !alias.trim()) return;
                    ev.preventDefault();
                    if (!aliases.includes(alias.trim())) set('aliases', [...aliases, alias.trim()]);
                    setAlias('');
                  }}
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <ProblemsAt ctx={ctx} path="attributes" />
    </section>
  );
}

/** 双星组合（主星）：每个对方主星一块，组合正文与组合摘要；「添加组合」只列另外 13 颗主星，已有组合的不可选。 */
function Combinations({ ctx, focus }: { ctx: Ctx; focus: string | undefined }) {
  const e = ctx.t.editor;
  const k = ctx.kernel;
  const majors = [...new Set(Object.values(k.MajorStar) as string[])].filter((x) => x !== ctx.entry.key);
  const name = (key: string) => k.i18n.translate(key, 'zh-CN') ?? key;
  const ownC = (isRecord(ctx.own?.combinations) ? ctx.own.combinations : {}) as Record<string, string>;
  const baseC = (isRecord(ctx.base?.combinations) ? ctx.base.combinations : {}) as Record<string, string>;
  const keys = majors.filter((m) => m in ownC || m in baseC);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set([...keys.filter((m) => m in ownC), ...(focus ? [focus] : [])]));
  const self = name(ctx.entry.key);
  return (
    <section className={css.field} data-field="combinations">
      <div className={css.fieldHead}>
        <h3 className={css.fieldName}>{e.fields.combinations}</h3>
      </div>
      {keys.map((m) => {
        const st = m in ownC ? (m in baseC ? e.status.changed : ctx.compare ? e.status.added : e.status.written) : e.status.inherit;
        const isOpen = open.has(m);
        return (
          <div key={m} className={css.block}>
            <button
              type="button"
              className={css.blockHead}
              aria-expanded={isOpen}
              onClick={() =>
                setOpen((o) => {
                  const n = new Set(o);
                  if (n.has(m)) n.delete(m);
                  else n.add(m);
                  return n;
                })
              }
            >
              <b>{fmt(e.combo, { a: self, b: name(m) })}</b>
              <span className={css.barId}>{m}</span>
              <span className={css.toolSpace} />
              <span className={css.fieldState}>{st}</span>
              <span className={css.caret}>
                <CaretIcon />
              </span>
            </button>
            {isOpen && (
              <div className={css.blockBody}>
                <TextField ctx={ctx} path={{ field: 'combinations', sub: m }} label={e.fields.combo} />
                <SummaryField ctx={ctx} intro={{ field: 'combinations', sub: m }} summary={{ field: 'combinationSummaries', sub: m }} label={e.fields.comboSummary} />
              </div>
            )}
          </div>
        );
      })}
      <div style={{ marginTop: 10 }}>
        <Picker label={e.addCombo} title={e.addCombo} width={300} placeholder={e.addCombo} value={null}>
          {(close) => (
            <OptionGrid
              label={e.addCombo}
              columns={2}
              autoFocus
              options={majors.map((m) => ({ key: m, text: name(m), content: <b>{name(m)}</b>, disabledReason: keys.includes(m) ? e.status.written : undefined }))}
              selected={null}
              onSelect={(m) => {
                close();
                ctx.edit((raw) => setSubField(raw, ctx.entry, 'combinations', m, ''));
                setOpen((o) => new Set([...o, m]));
              }}
            />
          )}
        </Picker>
      </div>
    </section>
  );
}

/** 一组字符串（古籍引文、主题选宫）：有对照、本包没写时是沿用块与「改写」；写了以后整组属于本包。 */
function ListField({
  ctx,
  field,
  label,
  note,
  render,
}: {
  ctx: Ctx;
  field: string;
  label: string;
  note: string;
  render: (items: string[], set: (items: string[]) => void) => ReactNode;
}) {
  const e = ctx.t.editor;
  const own = ctx.own?.[field] as string[] | undefined;
  const base = ctx.base?.[field] as string[] | undefined;
  const set = (items: string[] | undefined) => ctx.edit((raw) => setField(raw, ctx.entry, field, items));
  return (
    <section className={css.field} data-field={field}>
      <FieldHead ctx={ctx} label={label} own={own !== undefined} onRestore={() => set(undefined)} />
      <p className={css.infoNote}>{note}</p>
      {own === undefined ? (
        ctx.compare ? (
          <div className={css.inherit}>
            {base?.length ? base.map((x, i) => <div key={i}>{x}</div>) : fmt(e.inheritNone, { base: ctx.compare.label })}
            <div>
              <button type="button" className={`${controls.ghost} ${css.inheritButton}`} onClick={() => set([...(base ?? [])])}>
                {base?.length ? e.rewrite : e.writeField}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={`${controls.ghost} ${css.inheritButton}`} onClick={() => set([])}>
            {e.writeField}
          </button>
        )
      ) : (
        render(own, set)
      )}
      <ProblemsAt ctx={ctx} path={field} />
    </section>
  );
}

function Quotes({ ctx }: { ctx: Ctx }) {
  const e = ctx.t.editor;
  return (
    <ListField
      ctx={ctx}
      field="quotes"
      label={e.fields.quotes}
      note={e.quotesNote}
      render={(items, set) => (
        <>
          {items.map((q, i) => (
            <div key={i} className={css.quote}>
              <span className={css.quoteNo}>{i + 1}</span>
              <input className={css.input} aria-label={`${e.fields.quotes} ${i + 1}`} value={q} onChange={(ev) => set(items.map((x, j) => (j === i ? ev.target.value : x)))} />
              <span>
                <button type="button" className={css.iconButton} disabled={i === 0} onClick={() => set(items.map((x, j) => (j === i - 1 ? items[i]! : j === i ? items[i - 1]! : x)))}>
                  {e.moveUp}
                </button>
                <button type="button" className={css.iconButton} disabled={i === items.length - 1} onClick={() => set(items.map((x, j) => (j === i + 1 ? items[i]! : j === i ? items[i + 1]! : x)))}>
                  {e.moveDown}
                </button>
                <button type="button" className={css.iconButton} onClick={() => set(items.filter((_, j) => j !== i))}>
                  {e.remove}
                </button>
              </span>
            </div>
          ))}
          <button type="button" className={css.addEntry} onClick={() => set([...items, ''])}>
            {e.addQuote}
          </button>
        </>
      )}
    />
  );
}

/** 主题选宫：两组带序号的标签，「加一宫」从十二宫里选（只取本宫的另有身宫、来因宫），已在列表里的不可选。 */
function TopicPalaces({ ctx }: { ctx: Ctx }) {
  const e = ctx.t.editor;
  const k = ctx.kernel;
  const twelve = k.data.constants().palaces;
  const name = (key: string) => (key === k.PalaceName.BODY ? e.bodyPalace : key === k.PalaceName.ORIGINAL ? e.originalPalace : (k.i18n.translate(key, 'zh-CN') ?? key));
  const group = (field: 'surround' | 'palaces', label: string, note: string, choices: readonly string[]) => (
    <ListField
      key={field}
      ctx={ctx}
      field={field}
      label={label}
      note={note}
      render={(items, set) => (
        <div className={css.tags}>
          {items.map((p, i) => (
            <span key={p} className={css.chip}>
              {`${i + 1}. ${name(p)}`}
              <button type="button" className={css.chipX} aria-label={fmt(e.aliasRemove, { name: name(p) })} onClick={() => set(items.filter((x) => x !== p))}>
                <CloseIcon />
              </button>
            </span>
          ))}
          <Picker label={e.addPalace} title={e.addPalace} width={300} placeholder={e.addPalace} value={null}>
            {(close) => (
              <OptionGrid
                label={e.addPalace}
                columns={3}
                autoFocus
                options={choices.map((p) => ({ key: p, text: name(p), content: <b>{name(p)}</b>, disabledReason: items.includes(p) ? e.status.written : undefined }))}
                selected={null}
                onSelect={(p) => {
                  close();
                  set([...items, p]);
                }}
              />
            )}
          </Picker>
        </div>
      )}
    />
  );
  const sur = (ctx.own?.surround ?? ctx.base?.surround ?? []) as string[];
  const only = (ctx.own?.palaces ?? ctx.base?.palaces ?? []) as string[];
  return (
    <>
      {group('surround', e.fields.surround, e.surroundNote, twelve)}
      {group('palaces', e.fields.palaces, e.palacesNote, [...twelve, k.PalaceName.BODY, k.PalaceName.ORIGINAL])}
      {sur.length === 0 && only.length === 0 && <p className={`${css.problem}`}>{e.noPalaces}</p>}
    </>
  );
}

/** 名称与分类（星曜）：有对照时收在最后一个可展开块里，有改写时默认展开。 */
function NameBlock({ ctx, fields }: { ctx: Ctx; fields: readonly ('name' | 'category' | 'group' | 'title')[] }) {
  const e = ctx.t.editor;
  const changed = fields.some((f) => ctx.own?.[f] !== undefined);
  const [open, setOpen] = useState(changed);
  const inputs = fields.map((f) =>
    f === 'category' ? (
      <div key={f} className={css.infoField}>
        <span className={css.infoLabel}>{e.fields.category}</span>
        <Choices
          label={e.fields.category}
          options={Object.keys(e.categories).map((c) => ({ value: c, text: e.categories[c]! }))}
          value={ctx.own?.category as string | undefined}
          onChange={(v) => ctx.edit((raw) => setField(raw, ctx.entry, 'category', v))}
        />
      </div>
    ) : (
      <LineField key={f} ctx={ctx} field={f} label={e.fields[f]} />
    ),
  );
  if (!ctx.compare) return <section className={css.field}>{inputs}</section>;
  const baseName = (ctx.base?.name ?? ctx.base?.title ?? '') as string;
  const baseCat = ctx.base?.category ? (e.categories[ctx.base.category as string] ?? '') : '';
  return (
    <section className={css.field}>
      <button type="button" className={css.blockHead} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <b>{e.nameBlock}</b>
        <span className={css.fieldState}>{changed ? e.changedTag : fmt(e.nameInherit, { base: ctx.compare.label, name: baseName, category: baseCat })}</span>
        <span className={css.toolSpace} />
        <span className={css.caret}>
          <CaretIcon />
        </span>
      </button>
      {open && <div className={css.blockBody}>{inputs}</div>}
    </section>
  );
}

/** 条目的显示名：本包写的，否则对照里的，否则内核的译名。 */
export function entryName(kernel: Kernel, raw: PackRaw, compare: Compare | null, e: EntryRef): string {
  const own = entryOf(raw, e);
  const base = compareEntry(compare, e);
  const pick = (x: Record<string, unknown> | undefined) => (x ? ((x.name ?? x.title) as string | undefined) : undefined);
  return pick(own) ?? pick(base) ?? kernel.i18n.translate(e.key, 'zh-CN') ?? e.key;
}

/** 星曜在内核里的类别（主星、辅星、杂耀、流耀、十二神）。 */
export function starCategory(kernel: Kernel, key: string): 'major' | 'minor' | 'adjective' | 'flow' | 'dec' {
  const has = (o: Record<string, string>) => Object.values(o).includes(key);
  if (has(kernel.MajorStar)) return 'major';
  if (has(kernel.MinorStar)) return 'minor';
  if (has(kernel.AdjectiveStar)) return 'adjective';
  if (has(kernel.HoroscopeStar)) return 'flow';
  return 'dec';
}

/**
 * 条目编辑（设计规范 20.7）：头部（名称、标识、类别与状态、AI 起草、撤销或删除），按段的字段，问题挂在各自字段下。
 */
export function EntryEditor({
  t,
  kernel,
  raw,
  compare,
  entry,
  problems,
  combo,
  edit,
  titleRef,
}: {
  t: Messages;
  kernel: Kernel;
  raw: PackRaw;
  compare: Compare | null;
  entry: EntryRef;
  problems: readonly Problem[];
  /** 进来时要展开的组合（对方主星）。 */
  combo: string | undefined;
  edit: Edit;
  titleRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const e = t.editor;
  const [ai, setAi] = useState(false);
  const own = entryOf(raw, entry);
  const base = compareEntry(compare, entry);
  const status = entryStatus(raw, compare, entry);
  const ctx: Ctx = { t, kernel, entry, own, base, compare, problems: problems.filter((p) => p.at.entry?.section === entry.section && p.at.entry.key === entry.key), edit };
  const name = entryName(kernel, raw, compare, entry);
  const cat = entry.section === 'stars' ? starCategory(kernel, entry.key) : null;
  const statusText =
    status === 'inherit' ? fmt(e.entryInherit, { base: compare!.label }) : status === 'changed' ? e.entryChanged : status === 'added' ? e.entryAdded : status === 'written' ? e.entryWritten : e.entryUnwritten;
  const fields = e.fields;
  let body: ReactNode;
  if (!compare && !own) {
    body = (
      <div className={css.empty}>
        <p className={css.emptyBody}>{e.notWritten}</p>
        <button
          type="button"
          className={controls.button}
          onClick={() =>
            edit((r) => {
              if (entry.section === 'concepts' || entry.section === 'topics') return setField(r, entry, 'title', name);
              const withName = setField(r, entry, 'name', name);
              return cat ? setField(withName, entry, 'category', cat) : withName;
            })
          }
        >
          {e.writeEntry}
        </button>
      </div>
    );
  } else {
    const intro = { field: 'intro' };
    const sum = { field: 'summary' };
    const top = !compare && entry.section !== 'concepts' && entry.section !== 'topics' ? <NameBlock ctx={ctx} fields={entry.section === 'stars' ? ['name', 'category', 'group'] : ['name']} /> : null;
    const titleTop = entry.section === 'concepts' || entry.section === 'topics' ? <NameBlock ctx={ctx} fields={['title']} /> : null;
    const bottom = compare && entry.section !== 'concepts' && entry.section !== 'topics' ? <NameBlock ctx={ctx} fields={entry.section === 'stars' ? ['name', 'category', 'group'] : ['name']} /> : null;
    body = (
      <>
        {compare && status === 'inherit' && <p className={css.lead}>{e.allInherit}</p>}
        {top}
        {titleTop}
        {entry.section === 'patterns' && <Quotes ctx={ctx} />}
        {entry.section === 'patterns' && <TextField ctx={ctx} path={{ field: 'conditions' }} label={fields.conditions} />}
        {entry.section === 'topics' && <TopicPalaces ctx={ctx} />}
        <TextField ctx={ctx} path={intro} label={fields.intro} />
        {entry.section !== 'concepts' && <SummaryField ctx={ctx} intro={intro} summary={sum} label={fields.summary} />}
        {entry.section === 'stars' && <Attributes ctx={ctx} />}
        {entry.section === 'stars' && cat === 'major' && <Combinations ctx={ctx} focus={combo} />}
        {bottom}
        <ProblemsAt ctx={ctx} path={null} />
      </>
    );
  }
  return (
    <article>
      <header className={css.entryHead}>
        <div className={css.entryTitles}>
          <h2 ref={titleRef} className={css.entryName} tabIndex={-1}>
            {name}
            <span className={css.entryKey}>{entry.key}</span>
          </h2>
          <p className={css.entrySub}>
            {cat && <span>{e.categories[cat]}</span>}
            <span>{statusText}</span>
          </p>
        </div>
        <div className={css.entryActions}>
          <button type="button" className={css.ai} aria-expanded={ai} onClick={() => setAi((x) => !x)}>
            {e.aiDraft}
            <span className={css.soon}>{e.aiSoon}</span>
          </button>
          {own && (
            <button type="button" className={css.textButton} onClick={() => edit((r) => removeEntry(r, entry))}>
              {compare ? e.revertEntry : e.deleteEntry}
            </button>
          )}
        </div>
      </header>
      {ai && (
        <div className={css.aiNote}>
          <p>{e.aiNote}</p>
          <div aria-hidden="true">
            {[fields.intro, fields.summary].map((f) => (
              <div key={f} className={css.aiSlot}>
                <span className={css.aiSlotHead}>
                  {f}
                  <span className={css.toolSpace} />
                  <button type="button" className={css.iconButton} disabled tabIndex={-1}>
                    {e.aiAccept}
                  </button>
                  <button type="button" className={css.iconButton} disabled tabIndex={-1}>
                    {e.aiAcceptEdited}
                  </button>
                  <button type="button" className={css.iconButton} disabled tabIndex={-1}>
                    {e.aiDiscard}
                  </button>
                </span>
                <span className={css.aiBar} />
                <span className={css.aiBar} style={{ width: '60%' }} />
              </div>
            ))}
          </div>
        </div>
      )}
      {body}
    </article>
  );
}
