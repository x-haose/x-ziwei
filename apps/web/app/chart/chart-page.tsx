import { type ReactNode, type RefObject, useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { Astrolabe } from 'x-iztro';
import { type Birth, EMPTY_DRAFT, PERIODS, decodeBirth, draftOf, encodeBirth } from '../birth/birth';
import { BirthForm } from '../birth/birth-form';
import type { LunarCalendar } from '../birth/calendar';
import { birthSummary, hourName } from '../birth/labels';
import { type RecentState, pushRecent, removeRecent, useRecent } from '../birth/recent';
import type { ChatChart } from '../chat/chat-panel';
import { prefillQuestion, serviceName, setSheet, useChatDb } from '../chat/session';
import { ChatHost } from '../chat/side';
import * as controls from '../components/controls.css';
import { CaretIcon, CloseIcon } from '../components/icons';
import { Segmented } from '../components/segmented';
import { useToast } from '../components/toast';
import { HTML_LANG, type Lang, localePath } from '../i18n/lang';
import { fmt, type Messages } from '../i18n/messages';
import { useLang, useMessages } from '../i18n/use-lang';
import { type Kernel, loadKernel, useKernelState } from '../kernel/kernel';
import { createLunarCalendar } from '../kernel/lunar';
import { type ActiveKnowledge, ChartKnowledgeMark, libraryNote, useActiveKnowledge, useBrokenPacks, useRepairNotice, useRetireBroken } from '../knowledge/chart-knowledge';
import type { Use } from '../knowledge/library';
import { updateUse, useLibrary } from '../knowledge/use-library';
import { useHydrated } from '../lib/media';
import { buildPrompt, questionHeading } from '../prompt/build';
import { METHOD_STEPS, READING_METHOD } from '../prompt/method';
import { type PromptChoice, approxNote, chartSections } from '../prompt/sections';
import { Board } from './board';
import * as boardCss from './board.css';
import { CentreState, ChartCentre, LoadingBar } from './centre';
import * as css from './chart-page.css';
import type { Density } from './geometry';
import { LayerPanel, monthLabel } from './layer-panel';
import { decadalClockwise, decadalOfAge, nominalAge, surround, yearRange } from './model';
import { PromptFull } from './prompt-full';
import { Reading, ReadingBar, ReadingEmpty, RewriteContext, TopicNav, type WhenKey, WhenNav, smooth } from './reading';
import * as readingCss from './reading.css';
import { type Today, castChart, chartHour, initialSelection, monthHoroscope, todayOf, useChartView } from './session';
import { orderedTopics, selectionText, topicOfPalace, topicPalaces, topicSteps } from './topic';

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

/** 页脚「整张盘的完整提示词」的勾选项（设计规范 21.7）：本命盘、释义摘要、今年运限。 */
const CHART_CHOICE: PromptChoice = { natal: true, know: true, year: true, decades: false, years: false };

/** 阅读里用户自己定的部分：看哪个主题、问 AI 的问题。与哪张盘无关，换盘（含切换候选时辰）时保留。 */
interface ReadingInput {
  topic: string;
  question: string;
}

const isWide = () => matchMedia('(min-width: 1024px)').matches;

/** 本命命宫的宫位索引（没有主题可读时盘上选中它）。 */
function soulIndex(chart: Astrolabe): number {
  const p = chart.palace('soulPalace');
  if (!p) throw new Error('盘上没有命宫');
  return p.index;
}

/**
 * 已排好的盘：左栏的主题与时间、运限选择，盘，右栏的阅读与对话。运限选择与阅读的位置依赖这张盘，
 * 换一张盘时整块重建、回到初始；主题与问题由页面持有，不随之清空。
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
  knowledge,
  mark,
  change,
  libNote,
  hash,
  onOpenChart,
}: {
  kernel: Kernel;
  lunar: LunarCalendar;
  chart: Astrolabe;
  birth: Birth;
  today: Today;
  t: Messages;
  lang: Lang;
  input: ReadingInput;
  onInput: (next: ReadingInput) => void;
  knowledge: ActiveKnowledge;
  /** 对话面板里的释义标记。 */
  mark: ReactNode;
  /** 页脚的「换一套释义」。 */
  change: ReactNode;
  /** 释义暂用默认包的原因；用着生效组合时为 null。 */
  libNote: string | null;
  /** 地址 `#` 之后的生辰参数（不含 `#`）。 */
  hash: string;
  onOpenChart: (hash: string) => void;
}) {
  const view = useChartView(kernel, chart, today);
  const { sel, layer, palaces } = view;
  const pack = knowledge.pack;
  const toast = useToast();
  const db = useChatDb();
  const method = METHOD_STEPS[lang];

  const topics = useMemo(() => orderedTopics(pack), [pack]);
  // 换了一套释义后原来的主题可能不在了：回到第一个主题。
  // 换了一套释义后原来的主题可能不在了：回到第一个主题。生效组合里一个主题都没有时（用户包可以不带主题）没有阅读。
  const topic = topics.find((x) => x.slug === input.topic) ?? topics[0] ?? null;
  const name = topic ? (topic.title ?? topic.slug) : '';
  const tp = useMemo(() => topic && topicPalaces(chart, topic), [chart, topic]);

  const decadals = useMemo(() => chart.decadalList(), [chart]);
  const todayAge = nominalAge(chart, today.year);
  const nowDec = decadalOfAge(chart, todayAge);
  const [firstYear, lastYear] = yearRange(chart);
  const yearOk = today.year >= firstYear && today.year <= lastYear;
  const nowDecadal = nowDec >= 0 ? decadals[nowDec]! : null;
  const decadal = decadals[sel.decadal]!;
  const monthItem = sel.layer === 'monthly' ? chart.monthlyList(sel.year).find((m) => m.month === sel.month.month && m.part === sel.month.part) : undefined;

  const natalPatterns = useMemo(() => chart.patterns(), [chart]);
  const layerPatterns = useMemo(() => {
    if (sel.layer === 'natal') return [];
    if (sel.layer === 'decadal') return chart.horoscopeOfYear(sel.year).patterns('decadal');
    if (sel.layer === 'yearly') return chart.horoscopeOfYear(sel.year).patterns('yearly');
    return monthHoroscope(chart, lunar, sel.year, sel.month).patterns('monthly');
  }, [chart, lunar, sel]);

  const steps = useMemo(
    () =>
      topic &&
      tp &&
      topicSteps({
        chart,
        topic,
        palaces: tp,
        layer: layer && {
          view: layer,
          patterns: layerPatterns,
          head:
            layer.kind === 'decadal'
              ? { kind: 'decadal', ages: decadal.ageRange, years: decadal.yearRange }
              : layer.kind === 'yearly'
                ? { kind: 'yearly', year: sel.year, age: nominalAge(chart, sel.year) }
                : { kind: 'monthly', year: sel.year, month: monthItem ? monthLabel(t, monthItem) : '' },
        },
        now: {
          year: today.year,
          age: todayAge,
          decadal: nowDecadal && { ages: nowDecadal.ageRange, soul: nowDecadal.index },
          yearlySoul: yearOk ? chart.horoscopeOfYear(today.year).yearly.index : null,
        },
        hua: view.hua,
        mutagenKeys: [kernel.Mutagen.LU, kernel.Mutagen.QUAN, kernel.Mutagen.KE, kernel.Mutagen.JI],
        natalPatterns,
        t,
      }),
    [chart, topic, tp, layer, layerPatterns, decadal, sel.year, monthItem, today.year, todayAge, nowDecadal, yearOk, view.hua, kernel, natalPatterns, t],
  );

  /* 阅读的位置：当前步、展开了的释义；对话里「在盘上看」临时选中的宫（换步、换主题、换时间后作废）。 */
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [layerOpen, setLayerOpen] = useState(false);
  const spot = `${topic?.slug}|${step}|${sel.layer}|${sel.decadal}|${sel.year}|${sel.month.month}${sel.month.part}`;
  const [pinned, setPinned] = useState<{ spot: string; palace: number } | null>(null);
  const current = steps?.[step] ?? null;
  const focus = pinned && pinned.spot === spot ? pinned.palace : (current?.focus ?? soulIndex(chart));
  const lines = useMemo(() => surround(chart, focus), [chart, focus]);

  const scroller = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const askRef = useRef<HTMLTextAreaElement>(null);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);
  const readingRef = useRef<HTMLDivElement>(null);
  /**
   * 下一次渲染后要做的滚动与聚焦（要等新内容画出来）。`later` 同时触发一次渲染，保证它会执行；
   * 聚焦放到下一帧，排在弹层关闭时把焦点还给触发钮之后。
   */
  const after = useRef<(() => void) | null>(null);
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const later = (run: () => void) => {
    after.current = run;
    rerender();
  };
  useEffect(() => {
    const run = after.current;
    after.current = null;
    run?.();
  });
  const focusLater = (el: () => HTMLElement | null | undefined) => requestAnimationFrame(() => el()?.focus({ preventScroll: true }));

  /** 把阅读里的一个元素滚到可见：≥1024 在右栏内滚，更窄时滚整页。 */
  const reveal = (el: HTMLElement | null, top = false) => {
    if (!el) return;
    if (isWide() && scroller.current) {
      scroller.current.scrollTo({ top: top ? 0 : el.offsetTop - 8, behavior: 'auto' });
    } else {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 8, behavior: smooth() });
    }
  };

  const pickTopic = (slug: string, focusTitle: boolean) => {
    setSheet(false);
    onInput({ ...input, topic: slug });
    setStep(0);
    setOpen(new Set());
    later(() => {
      reveal(readingRef.current, true);
      if (focusTitle) focusLater(() => titleRef.current);
    });
  };

  const pickWhen = (k: WhenKey, focusStep: boolean) => {
    if (k === 'life') view.setLayer('natal');
    else if (k === 'decade') view.pickDecadal(nowDec);
    else view.pickYear(today.year);
    const target = k === 'life' ? 0 : 4;
    setStep(target);
    later(() => {
      reveal(target === 0 ? readingRef.current : (stepRefs.current[target] ?? null), target === 0);
      if (focusStep || !isWide()) focusLater(() => stepRefs.current[target]?.querySelector<HTMLElement>('h3'));
    });
  };

  const jumpAsk = () => {
    setSheet(false);
    later(() => {
      reveal(askRef.current?.closest('section') ?? null);
      focusLater(() => askRef.current);
    });
  };

  /** ≥1024：右栏滚到哪一步，盘就换成哪一步（越过右栏上部 35% 处的最后一步）。 */
  const onScroll = () => {
    const host = scroller.current;
    if (!host || !isWide()) return;
    const line = host.getBoundingClientRect().top + host.clientHeight * 0.35;
    let k = 0;
    stepRefs.current.forEach((el, i) => {
      if (el && el.getBoundingClientRect().top <= line) k = i;
    });
    if (k !== step) setStep(k);
  };

  const whenKey: WhenKey | null =
    sel.layer === 'natal' ? 'life' : sel.layer === 'decadal' && sel.decadal === nowDec ? 'decade' : sel.layer === 'yearly' && sel.year === today.year ? 'year' : null;
  const whenLabel =
    sel.layer === 'natal'
      ? t.read.labelLife
      : sel.layer === 'decadal'
        ? fmt(sel.decadal === nowDec ? t.read.labelDecadeNow : t.read.labelDecade, { a: decadal.ageRange[0], b: decadal.ageRange[1] })
        : sel.layer === 'yearly'
          ? fmt(t.read.labelYear, { y: sel.year, age: nominalAge(chart, sel.year) })
          : fmt(t.read.labelMonth, { y: sel.year, month: monthItem ? monthLabel(t, monthItem) : '' });

  /* 问 AI 复制的材料（设计规范 21.6）：解读方法 + 内核按主题取材的原文 + 选了时间时的运限原文 + 问题。 */
  const opts = { knowledge: pack, knowledgeDepth: 'summary' as const };
  const note = approxNote(t, birth);
  const source = fmt(t.chart.knowSource, { packs: knowledge.source });
  const topicPrompt = useMemo(() => {
    if (!topic) return '';
    const extra =
      sel.layer === 'natal'
        ? []
        : sel.layer === 'decadal'
          ? [chart.decadalListToText(opts)]
          : sel.layer === 'yearly'
            ? [chart.horoscopeOfYear(sel.year).toText(opts)]
            : [monthHoroscope(chart, lunar, sel.year, sel.month).toText(sel.month.part === 'normal' ? opts : { ...opts, through: 'monthly' })];
    return buildPrompt({
      lang,
      method: READING_METHOD[lang],
      sections: [note, source, chart.topicToText(topic.slug, opts), ...extra].filter((x) => x !== null),
      question: input.question.trim() || fmt(t.read.defaultQuestion, { topic: name }),
    });
  }, [chart, lunar, sel, pack, lang, note, source, topic, input.question, t, name]);
  const chartPrompt = () =>
    buildPrompt({
      lang,
      method: READING_METHOD[lang],
      sections: [note, source, ...chartSections({ chart, sel: { ...initialSelection(chart, today), layer: 'yearly' }, choice: CHART_CHOICE, knowledge: pack, lunar })].filter((x) => x !== null),
      question: input.question,
    });
  const [full, setFull] = useState<{ title: string; text: string; back: HTMLElement | null } | null>(null);
  const openFull = (title: string, text: string) => setFull({ title, text, back: document.activeElement instanceof HTMLElement ? document.activeElement : null });

  const copy = (site: string) => {
    navigator.clipboard.writeText(topicPrompt).then(
      () => toast(fmt(t.read.copied, { n: [...topicPrompt].length.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en'), site })),
      (err: unknown) => {
        console.error(err);
        toast(t.read.copyFailed);
      },
    );
  };
  const copyLink = () => {
    navigator.clipboard.writeText(location.href).then(
      () => toast(t.chart.linkCopied),
      (err: unknown) => {
        console.error(err);
        toast(t.chart.copyFailed);
      },
    );
  };

  const settings = db.status === 'ready' ? db.settings : null;
  const askHere = () => {
    const q = input.question.trim();
    if (q) prefillQuestion(hash, q);
    else if (topic) prefillQuestion(hash, fmt(t.read.askHereDefault, { topic: name }), { ifEmpty: true });
    setSheet(true);
  };

  /* 对话（设计规范 §19）：上下文行写生辰、看的层与当前焦点宫。 */
  const s = birthSummary(t, birth);
  const birthText = `${s.date} ${birth.time.kind === 'hour' ? s.time : hourName(t, chartHour(birth))} ${s.gender}`;
  const now = new Date();
  const chat: ChatChart = {
    hash,
    birth: birthText,
    context: fmt(t.chat.context, { birth: birthText, layer: whenLabel, palace: palaces[focus]?.name ?? '' }),
    kernel,
    chart,
    pack,
    packSource: knowledge.source,
    today: `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`,
    year: today.year,
    chartText: () => `${chart.toText()}\n${chart.horoscopeOfYear(today.year).toText()}`,
    canFocus: (f) => f.kind === 'palace' || (f.year >= firstYear && f.year <= lastYear),
    focus: (f) => {
      if (f.kind === 'palace') {
        setPinned({ spot, palace: f.palace });
        return fmt(t.chat.calls.seenPalace, { palace: palaces[f.palace]?.name ?? '' });
      }
      if (f.kind === 'year') {
        view.pickYear(f.year);
        return fmt(t.chat.calls.seenYear, { y: f.year });
      }
      view.showMonth(f.year, f.month);
      return fmt(t.chat.calls.seenMonth, { y: f.year, month: t.lunarMonths[f.month - 1] ?? String(f.month) });
    },
  };

  /** 点盘上的宫：读以它为本宫的主题；没有这样的主题时只选中它。对话开着时先回到阅读。 */
  const selectPalace = (i: number) => {
    const slug = topicOfPalace(chart, topics, i);
    if (slug) pickTopic(slug, true);
    else {
      setSheet(false);
      setPinned({ spot, palace: i });
    }
  };

  const act = layer;
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
  const rank = ['natal', 'decadal', 'yearly', 'monthly'].indexOf(sel.layer);
  const markAge = rank >= 2 ? nominalAge(chart, sel.year) : todayAge;
  const hitTitles = palaces.map((p) => fmt(t.layer.pickDecadal, { a: p.decadal[0], b: p.decadal[1], palace: p.name }));
  const cellLabels = palaces.map((p) => fmt(t.read.cell, { name: p.name, gz: `${p.stem}${p.branch}`, stars: p.majors.map((x) => x.name).join(t.read.sep) || t.read.noMajor }));
  const layerId = useId();

  const footer = (
    <footer className={readingCss.foot}>
      {libNote && <p className={readingCss.footNote}>{libNote}</p>}
      <p>{fmt(t.read.footSource, { label: knowledge.label })}</p>
      <p className={readingCss.footButtons}>
        {change}
        <button type="button" className={readingCss.footButton} onClick={() => openFull(t.read.chartPromptTitle, chartPrompt())}>
          {t.read.chartPromptTitle}
        </button>
        <button type="button" className={readingCss.footButton} onClick={copyLink}>
          {t.chart.copyLinkText}
        </button>
      </p>
    </footer>
  );

  const reading = (
    <div ref={scroller} className={readingCss.scroller} onScroll={onScroll}>
      <div ref={readingRef}>
        {topic && tp && steps ? (
          <Reading
            t={t}
            lang={lang}
            pack={pack}
            topic={topic}
            selection={selectionText(chart, tp, t)}
            whenLabel={whenLabel}
            steps={steps}
            method={method}
            palaces={palaces}
            step={step}
            onSee={(k) => {
              setStep(k);
              if (!isWide()) boardRef.current?.scrollIntoView({ block: 'center', behavior: smooth() });
            }}
            open={open}
            onToggle={(id) =>
              setOpen((o) => {
                const n = new Set(o);
                if (n.has(id)) n.delete(id);
                else n.add(id);
                return n;
              })
            }
            onWhen={(k) => pickWhen(k, true)}
            onAskStep={(k) => {
              onInput({ ...input, question: fmt(t.read.askStepText, { step: method[k]!.title, topic: name }) });
              jumpAsk();
            }}
            ask={{
              question: input.question,
              onQuestion: (q) => onInput({ ...input, question: q }),
              prompt: topicPrompt,
              whenPart: sel.layer === 'natal' ? '' : fmt(t.read.askSummaryWhen, { label: whenLabel }),
              key: settings ? { service: serviceName(settings, t), model: settings.model || t.chat.picker.noModel } : null,
              onCopy: copy,
              onViewFull: () => openFull(fmt(t.read.topicPromptTitle, { topic: name }), topicPrompt),
              onAskHere: askHere,
            }}
            footer={footer}
            titleRef={titleRef}
            askRef={askRef}
            stepRefs={stepRefs}
            onJumpAsk={jumpAsk}
          />
        ) : (
          <>
            <ReadingEmpty title={t.read.noTopicsTitle} body={t.read.noTopicsBody} />
            {footer}
          </>
        )}
      </div>
    </div>
  );

  /** 「改写这一条」到编辑器的入口（生辰只在 `#` 之后）。 */
  const rewriteHref = (section: string, key: string, combo?: string) => {
    const q = new URLSearchParams({ entry: `${section}/${key}` });
    if (combo) q.set('combo', combo);
    return `${localePath(lang, '/knowledge/write')}?${q.toString()}#${hash}`;
  };

  return (
    <RewriteContext.Provider value={rewriteHref}>
      {topic && <TopicNav t={t} className={css.topics} topics={topics} topic={topic.slug} onTopic={(slug) => pickTopic(slug, false)} />}
      <WhenNav
        t={t}
        className={css.when}
        current={whenKey}
        decadeSub={nowDecadal ? fmt(t.read.agesShort, { a: nowDecadal.ageRange[0], b: nowDecadal.ageRange[1] }) : '—'}
        yearSub={String(today.year)}
        canDecade={nowDecadal !== null}
        canYear={yearOk}
        nowLabel={whenKey ? null : whenLabel}
        moreOpen={layerOpen}
        moreId={layerId}
        onWhen={(k) => pickWhen(k, false)}
        onMore={() => setLayerOpen((o) => !o)}
      />
      <LayerPanel id={layerId} hidden={!layerOpen} chart={chart} view={view} lunar={lunar} today={today} t={t} />
      <Board
        rootRef={boardRef}
        className={css.board}
        palaces={palaces}
        layers={view.layers}
        surround={lines}
        highlight={current?.hl}
        nowDecadal={nowDecadal?.index ?? null}
        onSelect={selectPalace}
        cellLabels={cellLabels}
        drawKey={`${sel.layer}|${sel.decadal}|${sel.year}|${sel.month.month}${sel.month.part}|${focus}`}
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
        centre={(density) => <ChartCentre chart={chart} density={density} layer={act ?? undefined} layerLabel={layerLabel} t={t} />}
      />
      <ChatHost
        t={t}
        lang={lang}
        chart={chat}
        birthLabel={birthText}
        mark={mark}
        back={`‹ ${topic ? fmt(t.read.back, { topic: name }) : t.read.backPlain}`}
        reading={reading}
        className={css.side}
        onUsePrompt={() => {
          setSheet(false);
          jumpAsk();
        }}
        onOpenChart={onOpenChart}
      />
      {topic && <ReadingBar t={t} topics={topics} topic={topic} onTopic={(slug) => pickTopic(slug, true)} onAsk={jumpAsk} />}
      {full && (
        <PromptFull
          t={t}
          lang={lang}
          title={full.title}
          text={full.text}
          questionHeading={questionHeading(lang)}
          onClose={() => {
            full.back?.focus();
            setFull(null);
          }}
        />
      )}
    </RewriteContext.Provider>
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
  const [readingInput, setReadingInput] = useState<ReadingInput>({ topic: 'overall', question: '' });
  const lib = useLibrary();
  useRepairNotice(lib, t);
  const broken = useBrokenPacks(kernel, lib);
  useRetireBroken(lib, broken, t);
  const knowledge = useActiveKnowledge(kernel, lib, broken);
  const pickUse = (next: (use: Use) => Use, label: string) =>
    updateUse(next).then(
      () => toast(fmt(t.chart.knowToast, { label })),
      (err: unknown) => {
        console.error(err);
        toast(fmt(t.knowledge.actionFailed, { reason: err instanceof Error ? err.message : String(err) }));
      },
    );
  const mark = kernel && <ChartKnowledgeMark t={t} lang={lang} kernel={kernel} lib={lib} broken={broken} onPick={pickUse} />;
  const change = kernel && (
    <ChartKnowledgeMark t={t} lang={lang} kernel={kernel} lib={lib} broken={broken} trigger={{ text: t.read.footChange, className: readingCss.footButton }} onPick={pickUse} />
  );
  const [formOpen, setFormOpen] = useState(false);
  const reported = useRef('');
  const bare = hash.replace(/^#/, '');
  const openChart = (h: string) => navigate({ hash: h }, { replace: true, preventScrollReset: true });

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
  /** 还没有盘时右栏的状态：没填生辰、内核加载中、内核加载失败（重试按钮在盘面上）。 */
  const side = !waiting ? 'empty' : kstate.status === 'error' ? 'failed' : 'loading';

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
    <main className={chart ? `${css.page} ${css.withBar}` : css.page}>
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
      {chart && kernel && lunar && today && birth && hour !== null && knowledge ? (
        <ChartBody
          key={hash}
          kernel={kernel}
          lunar={lunar}
          chart={chart}
          birth={birth}
          today={today}
          t={t}
          lang={lang}
          input={readingInput}
          onInput={setReadingInput}
          knowledge={knowledge}
          mark={mark}
          change={change}
          libNote={libraryNote(lib, t)}
          hash={bare}
          onOpenChart={openChart}
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
          <section className={`${css.side} ${css.sideEmpty}`} aria-label={t.chat.tabsLabel}>
            <ReadingEmpty
              title={side === 'failed' ? t.read.failedTitle : side === 'loading' ? t.read.loadingTitle : t.read.emptyTitle}
              body={
                side === 'failed'
                  ? t.read.failedBody
                  : side === 'loading'
                    ? kstate.status === 'loading'
                      ? fmt(t.read.loadingBody, { a: Math.round(kstate.loaded / 1024), b: Math.round(kstate.total / 1024) })
                      : t.read.loadingWait
                    : t.read.emptyBody
              }
            />
          </section>
        </>
      )}
    </main>
  );
}

