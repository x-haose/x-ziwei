import { type ReactNode, useMemo, useRef } from 'react';
import type { Astrolabe, HoroscopeItem, KnowledgePack, PatternHit } from 'x-iztro';
import { CaretIcon } from '../components/icons';
import { Segmented } from '../components/segmented';
import { fmt, type Messages } from '../i18n/messages';
import type { Kernel } from '../kernel/kernel';
import { Markdown } from '../markdown/markdown';
import * as boardCss from './board.css';
import { monthLabel } from './layer-panel';
import { type HuaMark, type LayerView, type PalaceView, type StarView, decadalOfAge, nominalAge } from './model';
import * as css from './reading.css';
import type { ChartView } from './session';

/**
 * 看盘（设计规范 21.4）：给人读的结构化阅读，以盘为索引。事实全部取自排盘内核的结构化结果（星曜、亮度、各层四化与宫名、
 * 格局命中、大限与流年列表），释义取自本机生效的知识包组合；不从提示词文本里摘。
 */

export type ReadingView = 'palace' | 'patterns' | 'decades' | 'years';

/** 看盘的界面状态：子页签、展开了的全文、流年一览翻到的大限（null 为所选大限）。由排盘页持有，换页签不丢。 */
export interface ReadingState {
  view: ReadingView;
  open: ReadonlySet<string>;
  yOrd: number | null;
}

export const INITIAL_READING: ReadingState = { view: 'palace', open: new Set(), yOrd: null };

const HUA_CLASS: Record<HuaMark['source'], string> = {
  n: boardCss.huaNatal,
  d: boardCss.huaDecadal,
  y: boardCss.huaYearly,
  m: boardCss.huaMonthly,
};

/** 摘要层的宽度上限：显示宽度（汉字等全角计 2）不超过它的正文本身就是摘要（与内核的摘要规则一致）。 */
const SUMMARY_WIDTH = 240;

function displayWidth(text: string): number {
  let n = 0;
  for (const ch of text) n += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch) ? 2 : 1;
  return n;
}

interface Texted {
  intro?: string | undefined;
  summary?: string | undefined;
}

/** 摘要层：有摘要用摘要，正文不超过 240 宽用正文，否则没有（只给「全文」）。 */
function noteOf(e: Texted): string | null {
  if (e.summary) return e.summary;
  return e.intro && displayWidth(e.intro) <= SUMMARY_WIDTH ? e.intro : null;
}

function hasFull(e: Texted): boolean {
  return !!e.intro && (!!e.summary || displayWidth(e.intro) > SUMMARY_WIDTH);
}

function Tile({ mark }: { mark: HuaMark }) {
  return <i className={`${boardCss.hua} ${HUA_CLASS[mark.source]} ${css.tile}`}>{mark.text}</i>;
}

function More({ id, label, state, onState, t }: { id: string; label: string; state: ReadingState; onState: (s: ReadingState) => void; t: Messages }) {
  const on = state.open.has(id);
  return (
    <button
      type="button"
      className={css.more}
      aria-expanded={on}
      onClick={() => {
        const open = new Set(state.open);
        if (on) open.delete(id);
        else open.add(id);
        onState({ ...state, open });
      }}
    >
      {on ? t.read.fold : label}
      <span className={css.moreCaret}>
        <CaretIcon />
      </span>
    </button>
  );
}

/** 运限里所选的一层：显示用的标签、该层的内核数据、该层视角命中的格局。 */
interface LayerInfo {
  kind: LayerView['kind'];
  label: string;
  view: LayerView;
  item: HoroscopeItem;
  patterns: PatternHit[];
}

function layerInfos(chart: Astrolabe, view: ChartView, t: Messages): LayerInfo[] {
  const { sel, layers } = view;
  if (sel.layer === 'natal') return [];
  const decadal = chart.decadalList()[sel.decadal];
  if (!decadal) throw new Error(`大限序号越界：${sel.decadal}`);
  const h = chart.horoscopeOfYear(sel.year);
  const out: LayerInfo[] = [];
  for (const l of layers) {
    if (l.kind === 'decadal') {
      out.push({ kind: l.kind, label: fmt(t.read.agesShort, { a: decadal.ageRange[0], b: decadal.ageRange[1] }), view: l, item: decadal, patterns: h.patterns('decadal') });
    } else if (l.kind === 'yearly') {
      out.push({ kind: l.kind, label: String(sel.year), view: l, item: h.yearly, patterns: h.patterns('yearly') });
    } else {
      const m = chart.monthlyList(sel.year).find((x) => x.month === sel.month.month && x.part === sel.month.part);
      if (!m) throw new Error(`农历 ${sel.year} 年没有这一段流月`);
      // 闰月的前后两段没有单独的运限查询，流月格局只在常规月里算。
      const patterns = sel.month.part === 'normal' ? chart.horoscopeOfMonth(sel.year, sel.month.month).patterns('monthly') : [];
      out.push({ kind: l.kind, label: `${sel.year} ${monthLabel(t, m)}`, view: l, item: m, patterns });
    }
  }
  return out;
}

/** 一颗星或一条格局的释义：摘要层，可展开全文（与门派属性）；当前组合里没有这一条时写明。 */
function Note({
  t,
  id,
  entry,
  name,
  packLabel,
  attrs,
  state,
  onState,
}: {
  t: Messages;
  id: string;
  entry: Texted | undefined;
  name: string;
  packLabel: string;
  attrs?: Record<string, unknown> | undefined;
  state: ReadingState;
  onState: (s: ReadingState) => void;
}) {
  if (!entry || (!entry.intro && !entry.summary)) return <p className={css.noteNone}>{fmt(t.read.noEntry, { label: packLabel, name })}</p>;
  const short = noteOf(entry);
  const attrLine = attrs
    ? (Object.keys(t.read.attrs) as (keyof Messages['read']['attrs'])[])
        .filter((k) => attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== '')
        .map((k) => {
          const v = attrs[k];
          const values: Record<string, string> = t.read.attrValues;
          const text = Array.isArray(v) ? v.join(t.read.starsSep) : (values[String(v)] ?? String(v));
          return `${t.read.attrs[k]} ${text}`;
        })
    : [];
  const canOpen = hasFull(entry) || attrLine.length > 0;
  const open = state.open.has(id);
  return (
    <div className={css.note}>
      {short && <Markdown source={short} variant="preview" />}
      {canOpen && <More id={id} label={t.read.full} state={state} onState={onState} t={t} />}
      {open && (
        <div className={css.full}>
          {entry.intro && <Markdown source={entry.intro} variant="preview" />}
          {attrLine.length > 0 && <p className={css.attrs}>{attrLine.join('；')}</p>}
        </div>
      )}
    </div>
  );
}

function StarItem({
  t,
  star,
  pack,
  packLabel,
  id,
  small = false,
  extra,
  state,
  onState,
}: {
  t: Messages;
  star: { key: string; name: string; brightness?: string | undefined; hua?: readonly HuaMark[] };
  pack: KnowledgePack;
  packLabel: string;
  id: string;
  small?: boolean;
  extra?: ReactNode;
  state: ReadingState;
  onState: (s: ReadingState) => void;
}) {
  const entry = pack.star(star.key);
  return (
    <li className={css.star}>
      <div className={css.starHead}>
        <b className={small ? css.starNameSmall : css.starName}>{star.name}</b>
        {star.brightness && <span className={css.brightness}>{star.brightness}</span>}
        {extra}
        {star.hua?.map((h) => (
          <Tile key={h.source} mark={h} />
        ))}
      </div>
      <Note t={t} id={id} entry={entry} name={star.name} packLabel={packLabel} attrs={small ? undefined : (entry?.attributes as Record<string, unknown> | undefined)} state={state} onState={onState} />
    </li>
  );
}

/** 一条格局：名称、所属各层、破格、本宫（可点）、所用的星与所在宫、摘要与可展开的成立条件和全文。 */
function PatternItem({
  t,
  hit,
  scopes,
  palaces,
  pack,
  packLabel,
  id,
  onPalace,
  state,
  onState,
}: {
  t: Messages;
  hit: PatternHit;
  scopes: readonly ('natal' | LayerView['kind'])[];
  palaces: readonly PalaceView[];
  pack: KnowledgePack;
  packLabel: string;
  id: string;
  onPalace: (index: number) => void;
  state: ReadingState;
  onState: (s: ReadingState) => void;
}) {
  const entry = pack.pattern(hit.key);
  const seen = new Set<string>();
  const stars = hit.stars.filter((s) => {
    const k = `${s.name}@${s.palaceIndex}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const short = entry ? noteOf(entry) : null;
  const canOpen = !!entry && (!!entry.conditions || (entry.quotes?.length ?? 0) > 0 || hasFull(entry));
  const open = state.open.has(id);
  return (
    <div className={css.pattern}>
      <div className={css.patternHead}>
        <b className={css.patternName}>{hit.name}</b>
        {scopes.map((s) => (
          <span key={s} className={css.scope}>
            {t.read.layerNames[s]}
          </span>
        ))}
        {hit.broken && <span className={css.tag}>{t.read.broken}</span>}
        <button type="button" className={`${css.palaceLink} ${css.patternPalace}`} onClick={() => onPalace(hit.palaceIndex)}>
          {palaces[hit.palaceIndex]?.name ?? hit.palaceName}
        </button>
      </div>
      <p className={css.patternStars}>
        {stars.map((s, i) => (
          <span key={`${s.key}@${s.palaceIndex}`}>
            {i > 0 && t.read.starsSep}
            {s.name}
            {s.brightness ? `(${s.brightness})` : ''}
            <span className={css.patternStarPalace}>{palaces[s.palaceIndex]?.name}</span>
          </span>
        ))}
      </p>
      {entry ? (
        <div className={css.note}>
          {short && <Markdown source={short} variant="preview" />}
          {canOpen && <More id={id} label={t.read.patternFull} state={state} onState={onState} t={t} />}
          {open && (
            <div className={css.full}>
              {entry.quotes && entry.quotes.length > 0 && (
                <>
                  <p className={css.fullLabel}>{t.read.quotes}</p>
                  <p className={css.quotes}>
                    {entry.quotes.map((q, i) => (
                      <span key={i}>
                        {i > 0 && <br />}
                        {q}
                      </span>
                    ))}
                  </p>
                </>
              )}
              {entry.conditions && (
                <>
                  <p className={css.fullLabel}>{t.read.conditions}</p>
                  <Markdown source={entry.conditions} variant="preview" />
                </>
              )}
              {entry.intro && (
                <>
                  <p className={css.fullLabel}>{t.read.intro}</p>
                  <Markdown source={entry.intro} variant="preview" />
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className={css.noteNone}>{fmt(t.read.noEntry, { label: packLabel, name: hit.name })}</p>
      )}
    </div>
  );
}

/** 合并同一格局（同键、同本宫）在几层里的命中，层按本命、大限、流年、流月排。 */
function mergeHits(groups: readonly { scope: 'natal' | LayerView['kind']; hits: readonly PatternHit[] }[], keep: (h: PatternHit) => boolean) {
  const out: { hit: PatternHit; scopes: ('natal' | LayerView['kind'])[] }[] = [];
  for (const g of groups) {
    for (const h of g.hits) {
      if (!keep(h)) continue;
      const same = out.find((x) => x.hit.key === h.key && x.hit.palaceIndex === h.palaceIndex);
      if (same) {
        if (!same.scopes.includes(g.scope)) same.scopes.push(g.scope);
      } else out.push({ hit: h, scopes: [g.scope] });
    }
  }
  return out;
}

export function ReadingPanel({
  t,
  kernel,
  chart,
  view,
  pack,
  packLabel,
  todayYear,
  state,
  onState,
  onAsk,
  onToast,
}: {
  t: Messages;
  kernel: Kernel;
  chart: Astrolabe;
  view: ChartView;
  /** 本机生效的知识包组合合并后的包，与它的组合名。 */
  pack: KnowledgePack;
  packLabel: string;
  /** 今天所在的农历年（流年一览标「今年」、大限一览标「现在」）。 */
  todayYear: number;
  state: ReadingState;
  onState: (s: ReadingState) => void;
  /** 「在对话里问…」：预填的问题。 */
  onAsk: (text: string) => void;
  onToast: (text: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const { palaces, sel } = view;
  const layers = useMemo(() => layerInfos(chart, view, t), [chart, view, t]);
  const natalPatterns = useMemo(() => chart.patterns(), [chart]);
  const decadals = useMemo(() => chart.decadalList(), [chart]);
  const starName = (key: string) => kernel.i18n.translate(key, 'zh-CN') ?? key;

  const goPalace = (i: number) => {
    view.select(i);
    onState({ ...state, view: 'palace' });
    if (scroller.current) scroller.current.scrollTop = 0;
    requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
  };

  const views = (
    <Segmented
      label={t.read.viewsLabel}
      className={css.views}
      value={state.view}
      options={(Object.keys(t.read.views) as ReadingView[]).map((v) => ({ value: v, label: t.read.views[v] }))}
      onChange={(v) => onState({ ...state, view: v, yOrd: null })}
    />
  );

  let body: ReactNode;
  if (state.view === 'palace') {
    const i = view.palace;
    const p = palaces[i]!;
    const pal = chart.palaces[i]!;
    const inPalace = [...p.majors, ...p.minors];
    const flyIn = inPalace.flatMap((s) => s.hua.map((h) => ({ mark: h, text: `${t.read.source[h.source]} ${s.name}${t.read.huaFull[view.hua.indexOf(h.text)] ?? h.text}` })));
    const whereStar = (key: string) => palaces.findIndex((q) => [...q.majors, ...q.minors].some((s) => s.key === key));
    const flyOut = pal.mutagenStarKeys.map((key, j) => ({ key, j, to: whereStar(key) }));
    const pats = mergeHits(
      [{ scope: 'natal', hits: natalPatterns }, ...layers.map((l) => ({ scope: l.kind, hits: l.patterns }))],
      (h) => h.palaceIndex === i || h.stars.some((s) => s.palaceIndex === i),
    );
    const flows = layers.flatMap((l) => (l.item.stars?.[i] ?? []).map((s) => ({ star: s, kind: l.kind })));
    const opposite = palaces[(i + 6) % 12]!;
    const combo = p.majors.length === 2 ? comboOf(pack, p.majors[0]!, p.majors[1]!) : null;
    const set = view.surround;
    body = (
      <>
        <div className={css.head}>
          <h3 ref={heading} tabIndex={-1} className={css.headName}>
            {p.name}
          </h3>
          <span className={css.headGz}>{`${p.stem}${p.branch}`}</span>
          {p.isBody && <span className={css.tag}>{t.read.body}</span>}
          {p.isOriginal && <span className={css.tag}>{t.read.original}</span>}
          <span className={css.headAges}>{fmt(t.read.ages, { a: p.decadal[0], b: p.decadal[1] })}</span>
        </div>
        {layers.length > 0 && (
          <ul className={css.layerNames}>
            {layers.map((l) => (
              <li key={l.kind}>
                <span className={css.layerKind}>{`${t.read.layerNames[l.kind]} ${l.label}`}</span>
                <b className={css.layerName}>{`${t.read.layerNames[l.kind]}${l.view.names[i]}`}</b>
              </li>
            ))}
          </ul>
        )}
        <section className={css.section}>
          <h4 className={css.sectionTitle}>{t.read.hua}</h4>
          <p className={css.huaRow}>
            <span className={css.huaLabel}>{t.read.flyIn}</span>
            <span className={css.huaItems}>
              {flyIn.length ? (
                flyIn.map((f, k) => (
                  <span key={k} className={css.huaItem}>
                    <Tile mark={f.mark} />
                    {f.text}
                  </span>
                ))
              ) : (
                <span className={css.none}>{layers.length ? t.read.flyInNone : t.read.flyInNoneNatal}</span>
              )}
            </span>
          </p>
          <p className={css.huaRow}>
            <span className={css.huaLabel}>{fmt(t.read.flyOut, { stem: p.stem })}</span>
            <span className={css.huaItems}>
              {flyOut.map((f) => (
                <span key={f.j} className={css.huaItem}>
                  {`${starName(f.key)}${t.read.huaFull[f.j]}→`}
                  {f.to < 0 ? '—' : f.to === i ? t.read.self : (
                    <button type="button" className={css.palaceLink} onClick={() => goPalace(f.to)}>
                      {palaces[f.to]!.name}
                    </button>
                  )}
                </span>
              ))}
            </span>
          </p>
        </section>
        <section className={css.section}>
          <h4 className={css.sectionTitle}>{t.read.majors}</h4>
          {p.majors.length ? (
            <ul>
              {p.majors.map((s) => (
                <StarItem key={s.key} t={t} star={s} pack={pack} packLabel={packLabel} id={`s-${i}-${s.key}`} state={state} onState={onState} />
              ))}
            </ul>
          ) : (
            <p className={css.none}>
              {opposite.majors.length
                ? fmt(t.read.empty, { palace: opposite.name, stars: opposite.majors.map((s) => s.name).join(t.read.starsSep) })
                : fmt(t.read.emptyNoStars, { palace: opposite.name })}
            </p>
          )}
        </section>
        {combo && (
          <section className={css.section}>
            <h4 className={css.sectionTitle}>{t.read.combo}</h4>
            <div className={css.pattern}>
              <div className={css.patternHead}>
                <b className={css.patternName}>{`${p.majors[0]!.name} × ${p.majors[1]!.name}`}</b>
              </div>
              {combo.text ? (
                <div className={css.note}>
                  {combo.short && <Markdown source={combo.short} variant="preview" />}
                  {combo.long && <More id={`c-${i}`} label={t.read.full} state={state} onState={onState} t={t} />}
                  {combo.long && state.open.has(`c-${i}`) && (
                    <div className={css.full}>
                      <Markdown source={combo.text} variant="preview" />
                    </div>
                  )}
                </div>
              ) : (
                <p className={css.noteNone}>{fmt(t.read.noEntry, { label: packLabel, name: `${p.majors[0]!.name} × ${p.majors[1]!.name}` })}</p>
              )}
            </div>
          </section>
        )}
        {p.minors.length > 0 && (
          <section className={css.section}>
            <h4 className={css.sectionTitle}>{t.read.minors}</h4>
            <ul>
              {p.minors.map((s) => (
                <StarItem key={s.key} t={t} star={s} pack={pack} packLabel={packLabel} id={`s-${i}-${s.key}`} state={state} onState={onState} />
              ))}
            </ul>
          </section>
        )}
        {p.adjectives.length > 0 && (
          <section className={css.section}>
            <h4 className={css.sectionTitle}>
              {t.read.adjectives}
              <span className={css.sectionAside}>{p.adjectives.map((s) => s.name).join(t.read.starsSep)}</span>
            </h4>
            <More id={`a-${i}`} label={t.read.seeNotes} state={state} onState={onState} t={t} />
            {state.open.has(`a-${i}`) && (
              <ul>
                {p.adjectives.map((s) => (
                  <StarItem key={s.key} t={t} star={{ key: s.key, name: s.name }} small pack={pack} packLabel={packLabel} id={`s-${i}-${s.key}`} state={state} onState={onState} />
                ))}
              </ul>
            )}
          </section>
        )}
        {flows.length > 0 && (
          <section className={css.section}>
            <h4 className={css.sectionTitle}>
              {t.read.flows}
              <span className={css.sectionAside}>{flows.map((f) => f.star.name).join(t.read.starsSep)}</span>
            </h4>
            <More id={`o-${i}`} label={t.read.seeNotes} state={state} onState={onState} t={t} />
            {state.open.has(`o-${i}`) && (
              <ul>
                {flows.map((f) => (
                  <StarItem
                    key={`${f.kind}-${f.star.key}`}
                    t={t}
                    star={{ key: f.star.key, name: f.star.name }}
                    small
                    extra={<span className={css.brightness}>{t.read.layerNames[f.kind]}</span>}
                    pack={pack}
                    packLabel={packLabel}
                    id={`o-${i}-${f.kind}-${f.star.key}`}
                    state={state}
                    onState={onState}
                  />
                ))}
              </ul>
            )}
          </section>
        )}
        <section className={css.section}>
          <h4 className={css.sectionTitle}>{t.read.patterns}</h4>
          {pats.length ? (
            pats.map((x) => (
              <PatternItem
                key={`${x.hit.key}@${x.hit.palaceIndex}`}
                t={t}
                hit={x.hit}
                scopes={x.scopes}
                palaces={palaces}
                pack={pack}
                packLabel={packLabel}
                id={`p-${i}-${x.hit.key}-${x.hit.palaceIndex}`}
                onPalace={goPalace}
                state={state}
                onState={onState}
              />
            ))
          ) : (
            <p className={css.none}>{layers.length ? t.read.patternsNone : t.read.patternsNoneNatal}</p>
          )}
        </section>
        <section className={css.section}>
          <h4 className={css.sectionTitle}>{t.read.surround}</h4>
          <ul className={css.surround}>
            {set.slice(1).map((j, k) => {
              const q = palaces[j]!;
              return (
                <li key={j}>
                  <button type="button" className={css.surroundRow} onClick={() => goPalace(j)}>
                    <small className={css.surroundRole}>{t.read.roles[k + 1]}</small>
                    <span className={css.surroundName}>
                      {q.name}
                      <span className={css.surroundBranch}>{q.branch}</span>
                    </span>
                    <span className={css.surroundStars}>
                      {q.majors.length
                        ? q.majors.map((s) => (
                            <span key={s.key} className={css.surroundStar}>
                              {s.name}
                              {s.hua.map((h) => (
                                <Tile key={h.source} mark={h} />
                              ))}
                            </span>
                          ))
                        : t.read.noMajor}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        <div className={css.foot}>
          <button type="button" className={css.footButton} onClick={() => onAsk(fmt(t.read.askText, { palace: p.name }))}>
            {fmt(t.read.ask, { palace: p.name })}
          </button>
        </div>
      </>
    );
  } else if (state.view === 'patterns') {
    const groups: { key: string; title: string; hits: readonly PatternHit[]; scope: 'natal' | LayerView['kind'] }[] = [
      { key: 'natal', title: t.read.layerNames.natal, hits: natalPatterns, scope: 'natal' },
      ...layers.map((l) => ({ key: l.kind, title: `${t.read.layerNames[l.kind]} ${l.label}`, hits: l.patterns, scope: l.kind })),
    ];
    body = (
      <>
        {groups.map((g) => (
          <section key={g.key} className={css.section}>
            <h4 className={css.sectionTitle}>
              {g.title}
              <span className={css.sectionAside}>{fmt(t.read.groupCount, { n: g.hits.length })}</span>
            </h4>
            {g.hits.length ? (
              g.hits.map((h) => (
                <PatternItem
                  key={`${h.key}@${h.palaceIndex}`}
                  t={t}
                  hit={h}
                  scopes={[g.scope]}
                  palaces={palaces}
                  pack={pack}
                  packLabel={packLabel}
                  id={`g-${g.key}-${h.key}-${h.palaceIndex}`}
                  onPalace={goPalace}
                  state={state}
                  onState={onState}
                />
              ))
            ) : (
              <p className={css.none}>{t.read.groupNone}</p>
            )}
          </section>
        ))}
        {sel.layer === 'natal' && <p className={css.hint}>{t.read.patternsHint}</p>}
      </>
    );
  } else if (state.view === 'decades') {
    const nowAge = nominalAge(chart, todayYear);
    const selected = sel.layer === 'natal' ? -1 : sel.decadal;
    body = (
      <>
        <p className={css.hint}>{t.read.decadesHint}</p>
        <div className={css.tableWrap}>
          <table className={css.table}>
            <thead>
              <tr>
                <th>{t.read.colAges}</th>
                <th>{t.read.colGz}</th>
                <th>{t.read.colDecadalSoul}</th>
                <th>{t.read.colHua}</th>
              </tr>
            </thead>
            <tbody>
              {decadals.map((d, k) => (
                <tr key={d.index} className={k === selected ? css.rowOn : undefined}>
                  <td>
                    <button
                      type="button"
                      className={css.rowButton}
                      onClick={() => {
                        view.pickDecadal(k);
                        onToast(fmt(t.read.toastDecade, { a: d.ageRange[0], b: d.ageRange[1] }));
                      }}
                    >
                      {`${d.ageRange[0]}–${d.ageRange[1]}`}
                    </button>
                    {nowAge >= d.ageRange[0] && nowAge <= d.ageRange[1] && <span className={css.nowTag}>{t.read.now}</span>}
                    <span className={css.rowSub}>{`${d.yearRange[0]}–${d.yearRange[1]}`}</span>
                  </td>
                  <td className={css.gz}>{`${d.heavenlyStem}${d.earthlyBranch}`}</td>
                  <td className={css.cellSerif}>
                    {palaces[d.index]!.name}
                    <span className={css.branch}>{palaces[d.index]!.branch}</span>
                  </td>
                  <td className={css.four}>
                    <Four keys={d.mutagenStarKeys} starName={starName} hua={view.hua} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  } else {
    const ord = state.yOrd ?? (sel.decadal >= 0 ? sel.decadal : decadalOfAge(chart, nominalAge(chart, todayYear)));
    const d = decadals[ord]!;
    const years = Array.from({ length: d.yearRange[1] - d.yearRange[0] + 1 }, (_, k) => d.yearRange[0] + k);
    const selected = sel.layer === 'yearly' || sel.layer === 'monthly' ? sel.year : null;
    body = (
      <>
        <div className={css.pager}>
          <button type="button" className={css.pagerButton} aria-label={t.read.prevDecade} disabled={ord === 0} onClick={() => onState({ ...state, yOrd: ord - 1 })}>
            ‹
          </button>
          <span className={css.pagerText}>
            <b className={css.pagerAges}>{fmt(t.read.agesShort, { a: d.ageRange[0], b: d.ageRange[1] })}</b>
            {fmt(t.read.decadeBar, { gz: `${d.heavenlyStem}${d.earthlyBranch}`, a: d.yearRange[0], b: d.yearRange[1] })}
          </span>
          <button
            type="button"
            className={css.pagerButton}
            aria-label={t.read.nextDecade}
            disabled={ord === decadals.length - 1}
            onClick={() => onState({ ...state, yOrd: ord + 1 })}
          >
            ›
          </button>
        </div>
        <p className={css.hint}>{t.read.yearsHint}</p>
        <div className={css.tableWrap}>
          <table className={css.table}>
            <thead>
              <tr>
                <th>{t.read.colYear}</th>
                <th>{t.read.colGz}</th>
                <th>{t.read.colYearlySoul}</th>
                <th>{t.read.colHua}</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => {
                const item = chart.horoscopeOfYear(y).yearly;
                return (
                  <tr key={y} className={y === selected ? css.rowOn : undefined}>
                    <td>
                      <button
                        type="button"
                        className={css.rowButton}
                        onClick={() => {
                          view.pickYear(y);
                          onState({ ...state, yOrd: ord });
                          onToast(fmt(t.read.toastYear, { y }));
                        }}
                      >
                        {y}
                      </button>
                      {y === todayYear && <span className={css.nowTag}>{t.read.thisYear}</span>}
                      <span className={css.rowSub}>{fmt(t.read.nominalAge, { n: nominalAge(chart, y) })}</span>
                    </td>
                    <td className={css.gz}>{`${item.heavenlyStem}${item.earthlyBranch}`}</td>
                    <td className={css.cellSerif}>
                      {palaces[item.index]!.name}
                      <span className={css.branch}>{palaces[item.index]!.branch}</span>
                    </td>
                    <td className={css.four}>
                      <Four keys={item.mutagenStarKeys} starName={starName} hua={view.hua} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <div className={css.reading}>
      <div ref={scroller} className={css.scroller}>
        {views}
        <div className={css.body}>{body}</div>
      </div>
    </div>
  );
}

/** 「天梁禄 紫微权 ……」：一项一组不断开。 */
function Four({ keys, starName, hua }: { keys: readonly string[]; starName: (key: string) => string; hua: readonly string[] }) {
  return (
    <>
      {keys.map((k, j) => (
        <span key={j} className={css.fourItem}>
          {starName(k)}
          <i className={css.fourMark}>{hua[j]}</i>
        </span>
      ))}
    </>
  );
}

/** 同宫两颗主星的组合释义：取任一颗的组合里写了对方的那一条；`short` 是摘要层，`long` 为正文长于摘要层。 */
function comboOf(pack: KnowledgePack, a: StarView, b: StarView): { text: string | null; short: string | null; long: boolean } {
  for (const [x, y] of [
    [a, b],
    [b, a],
  ] as const) {
    const e = pack.star(x.key);
    const text = e?.combinations[y.key];
    if (text) {
      const summary = e?.combinationSummaries[y.key];
      const short = summary ?? (displayWidth(text) <= SUMMARY_WIDTH ? text : null);
      return { text, short, long: !!summary || displayWidth(text) > SUMMARY_WIDTH };
    }
  }
  return { text: null, short: null, long: false };
}
