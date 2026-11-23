import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { Astrolabe } from 'x-iztro';
import { type Birth, EMPTY_DRAFT, PERIODS, decodeBirth, draftOf, encodeBirth } from '../birth/birth';
import { BirthForm } from '../birth/birth-form';
import type { LunarCalendar } from '../birth/calendar';
import { birthSummary, hourName } from '../birth/labels';
import { type RecentState, pushRecent, removeRecent, useRecent } from '../birth/recent';
import * as controls from '../components/controls.css';
import { CaretIcon, CloseIcon } from '../components/icons';
import { Segmented } from '../components/segmented';
import { useToast } from '../components/toast';
import { HTML_LANG, type Lang } from '../i18n/lang';
import { fmt, type Messages } from '../i18n/messages';
import { useLang, useMessages } from '../i18n/use-lang';
import { type Kernel, loadKernel, useKernelState } from '../kernel/kernel';
import { createLunarCalendar } from '../kernel/lunar';
import { useHydrated } from '../lib/media';
import { buildPrompt, questionHeading } from '../prompt/build';
import { READING_METHOD } from '../prompt/method';
import { type PromptChoice, approxNote, chartSections } from '../prompt/sections';
import { Board } from './board';
import type { Density } from './geometry';
import { CentreState, ChartCentre, LoadingBar } from './centre';
import * as css from './chart-page.css';
import { LayerPanel, monthLabel } from './layer-panel';
import { decadalClockwise, decadalOfAge, nominalAge } from './model';
import { PromptPanel } from './prompt-panel';
import { ReadPanel } from './read-panel';
import { type Today, castChart, chartHour, todayOf, useChartView } from './session';
import * as boardCss from './board.css';

/**
 * 地址 `#` 之后的生辰。预渲染的 HTML 里没有 `#`，水合那一次也按没有处理，水合后再读真实地址，
 * 否则首帧会与预渲染的 HTML 对不上。
 */
function useBirthHash(): string {
  const { hash } = useLocation();
  return useHydrated() ? hash : '';
}

function RecentList({ state, onOpen, t }: { state: RecentState | null; onOpen: (hash: string) => void; t: Messages }) {
  const lang = useLang();
  const toast = useToast();
  return (
    <div className={css.recent}>
      <h3 className={css.recentTitle}>{t.form.recent}</h3>
      {state?.kind === 'unavailable' && <p className={css.recentNone}>{t.form.recentUnavailable}</p>}
      {state?.kind === 'corrupt' && <p className={css.recentNone}>{t.form.recentCorrupt}</p>}
      {state?.kind === 'ok' && state.items.length === 0 && <p className={css.recentNone}>{t.form.recentNone}</p>}
      {state?.kind === 'ok' && state.items.length > 0 && (
        <ul>
          {state.items.map((item) => {
            const s = item.decoded.kind === 'ok' ? birthSummary(t, item.decoded.birth) : null;
            const when = new Date(item.ts).toLocaleDateString(HTML_LANG[lang]);
            return (
              <li key={item.hash} className={css.recentRow}>
                {item.decoded.kind === 'invalid' ? (
                  <span className={css.recentGo}>
                    <b className={css.recentBirth}>{t.form.recentBroken}</b>
                    <small className={css.recentMeta}>{when}</small>
                  </span>
                ) : (
                  <button type="button" className={css.recentGo} onClick={() => onOpen(item.hash)}>
                    <b className={css.recentBirth}>{s ? `${s.date} ${s.time}` : t.form.recentPending}</b>
                    <small className={css.recentMeta}>{s ? `${s.gender}　${when}` : when}</small>
                  </button>
                )}
                <button
                  type="button"
                  className={css.recentDelete}
                  aria-label={t.form.recentDelete}
                  onClick={() => {
                    if (!removeRecent(item.hash, state)) toast(t.form.recentUnavailable);
                  }}
                >
                  <CloseIcon />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** 已排盘时的生辰摘要：点开可修改；时辰未定时下面一行是候选时辰。 */
function BirthSummary({
  birth,
  chart,
  hour,
  open,
  onToggle,
  onCandidate,
  buttonRef,
  t,
}: {
  birth: Birth;
  chart: Astrolabe | null;
  hour: number;
  open: boolean;
  onToggle: () => void;
  onCandidate: (hour: number) => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
  t: Messages;
}) {
  const s = birthSummary(t, birth);
  const other =
    chart === null
      ? ''
      : birth.cal === 'solar'
        ? `${t.form.lunar}${chart.lunarDate.slice(5)}`
        : `${t.form.solar} ${chart.solarDate}`;
  return (
    <>
      <button ref={buttonRef} type="button" className={css.summary} aria-expanded={open} onClick={onToggle}>
        <span className={css.summaryWhen}>
          {`${s.date} ${birth.time.kind === 'hour' ? s.time : hourName(t, hour)}`}
          <small className={css.summaryNote}>{[birth.cal === 'solar' ? t.form.solar : t.form.lunar, s.gender, other].filter(Boolean).join('　')}</small>
        </span>
        <span className={css.summaryToggle}>
          {open ? t.chart.summaryClose : t.chart.summaryEdit}
          <span className={css.summaryCaret}>
            <CaretIcon />
          </span>
        </span>
      </button>
      {birth.time.kind === 'period' && (
        <div className={css.candidates}>
          <span className={css.candidatesLabel}>{t.chart.candidates}</span>
          <Segmented
            label={t.chart.candidates}
            className={css.candidatesSeg}
            serif
            value={String(hour)}
            options={PERIODS[birth.time.period].hours.map((h) => ({ value: String(h), label: t.hours[h]! }))}
            onChange={(v) => onCandidate(Number(v))}
          />
        </div>
      )}
    </>
  );
}

const DEFAULT_CHOICE: PromptChoice = { natal: true, know: true, year: true, decades: false, years: false };

/** 提示词里用户自己填的部分：勾选的段落与问题。与哪张盘无关，换盘（含切换候选时辰）时保留。 */
interface PromptInput {
  choice: PromptChoice;
  question: string;
}

/**
 * 已排好的盘：运限、盘、读数与提示词。运限选择依赖这张盘（大限的划分随盘而变），
 * 换一张盘时整块重建、回到初始；提示词的勾选与问题由页面持有，不随之清空。
 */
function ChartBody({
  kernel,
  lunar,
  chart,
  birth,
  today,
  t,
  lang,
  input,
  onInput,
}: {
  kernel: Kernel;
  lunar: LunarCalendar;
  chart: Astrolabe;
  birth: Birth;
  today: Today;
  t: Messages;
  lang: Lang;
  input: PromptInput;
  onInput: (next: PromptInput) => void;
}) {
  const view = useChartView(kernel, chart, today);
  const { sel, layers, palaces } = view;
  const { choice, question } = input;
  const knowledge = useMemo(() => kernel.KnowledgePack.builtin('zh-CN'), [kernel]);
  const decadals = useMemo(() => chart.decadalList(), [chart]);
  const todayAge = nominalAge(chart, today.year);
  const nowDecadal = decadals[decadalOfAge(chart, todayAge)]?.index ?? null;
  const act = layers.at(-1);
  const rank = ['natal', 'decadal', 'yearly', 'monthly'].indexOf(sel.layer);
  const markAge = rank >= 2 ? nominalAge(chart, sel.year) : todayAge;
  const decadal = decadals[sel.decadal]!;

  const monthItem = sel.layer === 'monthly' ? chart.monthlyList(sel.year).find((m) => m.month === sel.month.month && m.part === sel.month.part) : undefined;
  const layerLabel = act
    ? [
        `${t.layer[act.kind]} ${act.stem}${act.branch}`,
        act.kind === 'decadal'
          ? fmt(t.layer.ages, { a: decadal.ageRange[0], b: decadal.ageRange[1] })
          : act.kind === 'yearly'
            ? String(sel.year)
            : monthItem
              ? `${sel.year} ${monthLabel(t, monthItem)}`
              : '',
        act.kind === 'decadal' ? '' : fmt(t.layer.nominalAge, { n: nominalAge(chart, sel.year) }),
      ]
        .filter(Boolean)
        .join('　')
    : null;

  const text = useMemo(() => {
    const note = approxNote(t, birth);
    const sections = chartSections({ chart, sel, choice, knowledge, lunar });
    return buildPrompt({ lang, method: READING_METHOD[lang], sections: note ? [note, ...sections] : sections, question });
  }, [t, birth, chart, sel, choice, knowledge, lunar, lang, question]);

  const hitTitles = palaces.map((p) => fmt(t.layer.pickDecadal, { a: p.decadal[0], b: p.decadal[1], palace: p.name }));
  const cellLabels = palaces.map((p) =>
    fmt(t.read.cell, { name: p.name, gz: `${p.stem}${p.branch}`, stars: p.majors.map((s) => s.name).join(t.read.starsSep) || t.read.noMajor }),
  );

  return (
    <>
      <LayerPanel chart={chart} view={view} lunar={lunar} today={today} t={t} />
      <Board
        className={css.board}
        palaces={palaces}
        layers={layers}
        surround={view.surround}
        nowDecadal={nowDecadal}
        onSelect={view.select}
        cellLabels={cellLabels}
        drawKey={`${sel.layer}|${sel.decadal}|${sel.year}|${sel.month.month}${sel.month.part}|${view.palace}`}
        ring={{
          kind: 'chart',
          clockwise: decadalClockwise(palaces),
          markAge,
          selectedDecadal: rank >= 1 ? decadal.index : null,
          hitTitles,
          onPick: (palaceIndex) => {
            const i = decadals.findIndex((d) => d.index === palaceIndex);
            if (i < 0) throw new Error(`宫位 ${palaceIndex} 没有大限`);
            view.pickDecadal(i);
          },
        }}
        centre={(density) => <ChartCentre chart={chart} density={density} layer={act} layerLabel={layerLabel} t={t} />}
      />
      <ReadPanel chart={chart} palaces={palaces} layers={layers} surround={view.surround} onSelect={view.select} t={t} />
      <PromptPanel
        t={t}
        lang={lang}
        text={text}
        emptyText=""
        choice={choice}
        onChoice={(next) => onInput({ choice: next, question })}
        yearLabel={monthItem ? fmt(t.chart.checkMonth, { y: sel.year, month: monthLabel(t, monthItem) }) : fmt(t.chart.checkYear, { y: sel.year })}
        yearsLabel={fmt(t.chart.checkYears, { a: decadal.yearRange[0], b: decadal.yearRange[1] })}
        question={question}
        onQuestion={(next) => onInput({ choice, question: next })}
        questionHeading={questionHeading(lang)}
      />
    </>
  );
}

/**
 * 排盘页。生辰在地址 `#` 之后（不发给服务器）：提交即写进地址并记进本机的「最近排过」，
 * 打开带生辰的链接直接出盘。排盘内核在页面打开时开始在浏览器里装载，装好之前盘区显示进度。
 */
export function ChartPage() {
  const t = useMessages();
  const lang = useLang();
  const toast = useToast();
  const navigate = useNavigate();
  const hash = useBirthHash();
  const kstate = useKernelState();
  const kernel = kstate.status === 'ready' ? kstate.kernel : null;
  const lunar = useMemo(() => (kernel ? createLunarCalendar(kernel) : null), [kernel]);
  const today = useMemo(() => (lunar ? todayOf(lunar, new Date()) : null), [lunar]);
  const recent = useRecent(lunar);
  const decoded = decodeBirth(hash, lunar);
  const birth = decoded.kind === 'ok' ? decoded.birth : null;
  const hour = birth ? chartHour(birth) : null;
  const summaryRef = useRef<HTMLButtonElement>(null);
  const focusSummary = useRef(false);
  const [promptInput, setPromptInput] = useState<PromptInput>({ choice: DEFAULT_CHOICE, question: '' });
  const [formOpen, setFormOpen] = useState(false);
  const reported = useRef('');

  useEffect(() => {
    // 失败会记进内核状态，盘区显示原因与重试按钮。
    loadKernel().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (reported.current === hash) return;
    if (decoded.kind === 'unsupported' && kstate.status !== 'error') return;
    reported.current = hash;
    if (decoded.kind === 'invalid') toast(t.chart.badHash);
  }, [hash, decoded.kind, kstate.status, toast, t]);

  useEffect(() => setFormOpen(false), [hash]);

  // 生辰由 hash 唯一决定；按 hash 而不是每次新解析出的对象记忆，同一张盘在重渲染之间保持同一个对象。
  const chart = useMemo(() => (kernel && birth && hour !== null ? castChart(kernel, birth, hour) : null), [kernel, hash, hour]);

  /** 打开一张盘：写进地址并记进最近排过。表单随之收起，焦点移到生辰摘要。 */
  const open = (b: Birth) => {
    if (recent && !pushRecent(b, recent, Date.now())) toast(t.form.recentUnsaved);
    focusSummary.current = true;
    navigate({ hash: encodeBirth(b) }, { replace: true, preventScrollReset: true });
  };

  useEffect(() => {
    if (!focusSummary.current || !birth) return;
    focusSummary.current = false;
    if (!summaryRef.current) throw new Error('生辰摘要没有挂上');
    summaryRef.current.focus();
  }, [hash, birth]);

  const waiting = (birth !== null || decoded.kind === 'unsupported') && kstate.status !== 'ready';
  const progress = kstate.status === 'loading' ? kstate.loaded / kstate.total : 0;

  let centre: (density: Density) => ReactNode;
  if (kstate.status === 'error' && waiting) {
    centre = () => (
      <CentreState title={t.chart.failed}>
        <small className={boardCss.stateHint}>{kstate.message}</small>
        <button type="button" className={`${controls.ghost} ${boardCss.stateAction}`} onClick={() => loadKernel().catch(() => undefined)}>
          {t.chart.retry}
        </button>
      </CentreState>
    );
  } else if (waiting) {
    centre = () => (
      <CentreState title={t.chart.loading}>
        {kstate.status === 'loading' && <LoadingBar progress={progress} loaded={kstate.loaded} total={kstate.total} t={t} />}
      </CentreState>
    );
  } else {
    centre = () => (
      <CentreState title={t.chart.empty}>
        <small className={boardCss.stateHint}>
          <span className={boardCss.hintWide}>{t.chart.emptyHintSide}</span>
          <span className={boardCss.hintNarrow}>{t.chart.emptyHintTop}</span>
        </small>
      </CentreState>
    );
  }

  return (
    <main className={css.page}>
      <section className={css.birth} aria-label={t.chart.birth}>
        {birth && hour !== null && (
          <BirthSummary
            birth={birth}
            chart={chart}
            hour={hour}
            open={formOpen}
            onToggle={() => setFormOpen((o) => !o)}
            buttonRef={summaryRef}
            onCandidate={(h) => {
              if (birth.time.kind !== 'period') throw new Error('确定时辰的生辰没有候选');
              navigate({ hash: encodeBirth({ ...birth, time: { ...birth.time, pick: h } }) }, { replace: true, preventScrollReset: true });
            }}
            t={t}
          />
        )}
        {(!birth || formOpen) && (
          <BirthForm key={hash} initial={birth ? draftOf(birth) : EMPTY_DRAFT} lunar={lunar} onSubmit={open} />
        )}
        {!birth && <RecentList state={recent} t={t} onOpen={(h) => navigate({ hash: h }, { replace: true, preventScrollReset: true })} />}
      </section>
      {chart && kernel && lunar && today && birth && hour !== null ? (
        <ChartBody
          key={hash}
          kernel={kernel}
          lunar={lunar}
          chart={chart}
          birth={birth}
          today={today}
          t={t}
          lang={lang}
          input={promptInput}
          onInput={setPromptInput}
        />
      ) : (
        <>
          <Board
            className={css.board}
            palaces={null}
            layers={[]}
            surround={null}
            nowDecadal={null}
            drawKey="empty"
            ring={waiting && kstate.status === 'loading' ? { kind: 'loading', progress } : { kind: 'blank' }}
            centre={centre}
          />
          <PromptPanel
            t={t}
            lang={lang}
            text={null}
            emptyText={waiting ? t.chart.loadingPreview : t.chart.previewEmpty}
            choice={DEFAULT_CHOICE}
            onChoice={() => undefined}
            yearLabel={today ? fmt(t.chart.checkYear, { y: today.year }) : t.chart.checks.year}
            yearsLabel={t.chart.checks.years}
            question=""
            onQuestion={() => undefined}
            questionHeading={questionHeading(lang)}
          />
        </>
      )}
    </main>
  );
}

