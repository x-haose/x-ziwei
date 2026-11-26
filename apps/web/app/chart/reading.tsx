import { Fragment, type ReactNode, type RefObject, useId } from 'react';
import { Button, Dialog, DialogTrigger, Heading, Modal, ModalOverlay, Popover } from 'react-aria-components';
import type { KnowledgePack, TopicEntry } from 'x-iztro';
import { OptionGrid, Picker } from '../birth/picker';
import * as controls from '../components/controls.css';
import { CaretIcon, CloseIcon } from '../components/icons';
import type { Lang } from '../i18n/lang';
import { fmt, type Messages } from '../i18n/messages';
import { useMediaQuery } from '../lib/media';
import { Markdown } from '../markdown/markdown';
import type { MethodStep } from '../prompt/method';
import { media } from '../styles/media';
import type { PalaceView } from './model';
import * as css from './reading.css';
import { type NoteRef, type Rich, type Step, type TermId, TERM_SLUGS, brightnessConcept, palaceFull } from './topic';

/**
 * 看盘（设计规范第 21 节）：按主题一步一步读这张盘。事实句由 `topic.ts` 从内核结果拼出；释义、主题说明、
 * 术语解释取自生效组合的原文；每一步的「怎么看」取自解读方法。
 */

/** 摘要层的宽度上限：显示宽度（汉字等全角计 2）不超过它的正文本身就是摘要（与内核的摘要规则一致）。 */
const SUMMARY_WIDTH = 240;

function displayWidth(text: string): number {
  let n = 0;
  for (const ch of text) n += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch) ? 2 : 1;
  return n;
}

/** 摘要层：有摘要用摘要，正文不超过 240 宽用正文，否则没有（只给「全文」）。 */
function shortOf(summary: string | undefined, intro: string | undefined): string | null {
  if (summary) return summary;
  return intro && displayWidth(intro) <= SUMMARY_WIDTH ? intro : null;
}

export const smooth = (): ScrollBehavior => (matchMedia(media.reducedMotion).matches ? 'auto' : 'smooth');

/** 按 `{name}` 占位拼出文字与元素混排的内容。 */
function fmtNodes(template: string, values: Record<string, ReactNode>): ReactNode[] {
  return template.split(/\{(\w+)\}/).map((x, i) => {
    if (i % 2 === 0) return x;
    if (!(x in values)) throw new Error(`文案占位 {${x}} 没有给值：${template}`);
    return <Fragment key={i}>{values[x]}</Fragment>;
  });
}

/* ── 术语 ── */

/** 一个术语：生效组合里有对应条目时是按钮，点开看条目原文（≥700 贴着术语，<700 从底部升起）；没有时照常显示文字。 */
function Term({ t, pack, slug, text }: { t: Messages; pack: KnowledgePack; slug: string | null; text: string }) {
  const narrow = useMediaQuery(media.s);
  const entry = slug ? pack.concept(slug) : undefined;
  if (!entry) return <>{text}</>;
  const dialog = (
    <Dialog className={narrow ? css.termSheet : css.termPop} aria-label={entry.title ?? text}>
      {({ close }) => (
        <>
          <div className={css.termHead}>
            <Heading slot="title" className={css.termTitle}>
              {entry.title ?? text}
            </Heading>
            <Button className={css.termClose} aria-label={t.read.termClose} onPress={close}>
              <CloseIcon />
            </Button>
          </div>
          {entry.intro && (
            <div className={css.termBody}>
              <Markdown source={entry.intro} variant="preview" />
            </div>
          )}
        </>
      )}
    </Dialog>
  );
  return (
    <DialogTrigger>
      <Button className={css.term} render={(props) => <button {...props} aria-haspopup="dialog" />}>
        {text}
      </Button>
      {narrow ? (
        <ModalOverlay isDismissable className={css.termScrim}>
          <Modal>{dialog}</Modal>
        </ModalOverlay>
      ) : (
        <Popover placement="bottom start" offset={6}>
          {dialog}
        </Popover>
      )}
    </DialogTrigger>
  );
}

function RichText({ t, pack, parts }: { t: Messages; pack: KnowledgePack; parts: Rich }) {
  return (
    <>
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          p
        ) : 'term' in p ? (
          <Term key={i} t={t} pack={pack} slug={TERM_SLUGS[p.term]} text={p.text} />
        ) : (
          <Term key={i} t={t} pack={pack} slug={brightnessConcept(pack, p.brightness)} text={p.brightness} />
        ),
      )}
    </>
  );
}

/* ── 释义 ── */

function MoreButton({ open, label, t, onToggle, className = css.noteMore }: { open: boolean; label: string; t: Messages; onToggle: () => void; className?: string }) {
  return (
    <button type="button" className={className} aria-expanded={open} onClick={onToggle}>
      {open ? t.read.fold : label}
      <span className={css.caret}>
        <CaretIcon />
      </span>
    </button>
  );
}

interface NoteText {
  name: string;
  short: string | null;
  quotes?: readonly string[] | undefined;
  conditions?: string | undefined;
  /** 展开后的正文；摘要层已经是全文时为 null。 */
  body: string | null;
}

/** 一条释义在生效组合里的原文；组合里没有这一条（或两颗主星没有组合解读）时为 null。 */
function noteText(pack: KnowledgePack, n: NoteRef, t: Messages): NoteText | null | 'skip' {
  if (n.kind === 'combo') {
    const ea = pack.star(n.a.key);
    const eb = pack.star(n.b.key);
    const hit = ea?.combinations[n.b.key] ? { e: ea, other: n.b.key } : eb?.combinations[n.a.key] ? { e: eb, other: n.a.key } : null;
    // 两颗主星同宫没有组合解读是常态，不列「没有这一条」。
    if (!hit) return 'skip';
    const body = hit.e.combinations[hit.other]!;
    const short = shortOf(hit.e.combinationSummaries[hit.other], body);
    return { name: fmt(t.read.combo, { a: n.a.name, b: n.b.name }), short, body: short === body ? null : body };
  }
  const e = n.kind === 'star' ? pack.star(n.key) : n.kind === 'mutagen' ? pack.mutagen(n.key) : pack.pattern(n.key);
  if (!e || (!e.intro && !e.summary)) return null;
  const short = shortOf(e.summary, e.intro);
  const extra = n.kind === 'pattern' ? (e as { quotes?: string[]; conditions?: string }) : {};
  return { name: n.label, short, quotes: extra.quotes, conditions: extra.conditions, body: e.intro && e.intro !== short ? e.intro : null };
}

function NoteBlock({ t, pack, note, id, open, onToggle }: { t: Messages; pack: KnowledgePack; note: NoteRef; id: string; open: ReadonlySet<string>; onToggle: (id: string) => void }) {
  const text = noteText(pack, note, t);
  if (text === 'skip') return null;
  if (!text) {
    return (
      <div className={css.note}>
        <b className={css.noteName}>{note.kind === 'combo' ? fmt(t.read.combo, { a: note.a.name, b: note.b.name }) : note.label}</b>
        <p className={css.noteNone}>{t.read.noEntry}</p>
      </div>
    );
  }
  const canOpen = !!text.body || !!text.conditions || (text.quotes?.length ?? 0) > 0;
  const isOpen = open.has(id);
  return (
    <div className={css.note}>
      <b className={css.noteName}>{text.name}</b>
      {text.short && (
        <div className={css.noteText}>
          <Markdown source={text.short} variant="preview" />
        </div>
      )}
      {canOpen && (
        <div className={css.noteActs}>
          <MoreButton open={isOpen} label={t.read.full} t={t} onToggle={() => onToggle(id)} />
        </div>
      )}
      {isOpen && (
        <div className={css.full}>
          {text.quotes && text.quotes.length > 0 && (
            <p className={css.quotes}>
              {text.quotes.map((q, i) => (
                <span key={i}>
                  {i > 0 && <br />}
                  {q}
                </span>
              ))}
            </p>
          )}
          {text.conditions && (
            <>
              <p className={css.fullLabel}>{t.read.conditions}</p>
              <Markdown source={text.conditions} variant="preview" />
            </>
          )}
          {text.body && <Markdown source={text.body} variant="preview" />}
        </div>
      )}
    </div>
  );
}

const noteId = (n: NoteRef) => (n.kind === 'combo' ? `c:${n.a.key}+${n.b.key}` : `${n.kind}:${n.key}`);

/* ── 左栏 ── */

/** 「看什么」：生效组合里的主题。 */
export function TopicNav({
  t,
  className,
  topics,
  topic,
  onTopic,
}: {
  t: Messages;
  className: string;
  topics: readonly TopicEntry[];
  topic: string;
  onTopic: (slug: string) => void;
}) {
  const id = useId();
  return (
    <section className={`${css.nav} ${className}`} aria-labelledby={id}>
      <h2 id={id} className={css.navTitle}>
        {t.read.topics}
      </h2>
      <div className={css.topicGrid} role="group" aria-label={t.read.topicsLabel}>
        {topics.map((x) => (
          <button key={x.slug} type="button" className={css.topicButton} aria-pressed={x.slug === topic} onClick={() => onTopic(x.slug)}>
            {x.title ?? x.slug}
          </button>
        ))}
      </div>
    </section>
  );
}

export type WhenKey = 'life' | 'decade' | 'year';

/** 「看哪段时间」：一生、这十年、今年；下面是展开运限选择的按钮与「盘上是……」。 */
export function WhenNav({
  t,
  className,
  current,
  decadeSub,
  yearSub,
  canDecade,
  canYear,
  nowLabel,
  moreOpen,
  moreId,
  onWhen,
  onMore,
}: {
  t: Messages;
  className: string;
  current: WhenKey | null;
  decadeSub: string;
  yearSub: string;
  canDecade: boolean;
  canYear: boolean;
  /** 三格都不按下时盘上是哪一段；按下其中一格时为 null。 */
  nowLabel: string | null;
  moreOpen: boolean;
  moreId: string;
  onWhen: (k: WhenKey) => void;
  onMore: () => void;
}) {
  const id = useId();
  const cells: { k: WhenKey; label: string; sub: string; ok: boolean }[] = [
    { k: 'life', label: t.read.whenLife, sub: t.read.whenLifeSub, ok: true },
    { k: 'decade', label: t.read.whenDecade, sub: decadeSub, ok: canDecade },
    { k: 'year', label: t.read.whenYear, sub: yearSub, ok: canYear },
  ];
  return (
    <section className={`${css.nav} ${className}`} aria-labelledby={id}>
      <h2 id={id} className={css.navTitle}>
        {t.read.when}
      </h2>
      <div className={css.when} role="group" aria-label={t.read.whenLabel}>
        {cells.map((c) => (
          <button key={c.k} type="button" className={css.whenButton} aria-pressed={current === c.k} disabled={!c.ok} onClick={() => onWhen(c.k)} data-when={c.k}>
            {c.label}
            <small className={css.whenSub}>{c.sub}</small>
          </button>
        ))}
      </div>
      {nowLabel && <p className={css.whenNow}>{fmt(t.read.whenNow, { label: nowLabel })}</p>}
      <button type="button" className={css.more} aria-expanded={moreOpen} aria-controls={moreId} onClick={onMore}>
        {t.read.moreLayer}
        <span className={css.caret}>
          <CaretIcon />
        </span>
      </button>
    </section>
  );
}

/* ── 右栏 ── */

/** 一步的小盘（<1024）：标出这一步看的宫，点了到大盘上看。 */
function MiniBoard({ t, palaces, step, onSee }: { t: Messages; palaces: readonly PalaceView[]; step: Step; onSee: () => void }) {
  const names = step.hl.map((i) => palaceFull(palaces[i]!.name, t));
  return (
    <button type="button" className={css.mini} aria-label={fmt(t.read.miniLabel, { list: names.join(t.read.sep) || t.read.miniNone })} onClick={onSee}>
      {palaces.map((p) => (
        <span
          key={p.index}
          aria-hidden="true"
          className={css.miniCell}
          data-on={step.hl.includes(p.index) ? '' : undefined}
          data-focus={p.index === step.focus ? '' : undefined}
          style={{ gridArea: `${p.cell[0] + 1} / ${p.cell[1] + 1}` }}
        >
          {p.name.slice(0, 2)}
        </span>
      ))}
    </button>
  );
}

/** 三方四正、四化、格局三步的步名本身是术语。 */
const STEP_TERMS: readonly (TermId | null)[] = [null, 'sanFang', 'siHua', 'geJu', null];

export interface AskInfo {
  question: string;
  onQuestion: (q: string) => void;
  /** 复制的材料（整个主题）。 */
  prompt: string;
  /** 概要里「、2026 年（虚岁 27）的运限」一段；看一生时为空。 */
  whenPart: string;
  /** 填过 Key 时的服务名与模型；没有为 null。 */
  key: { service: string; model: string } | null;
  onCopy: (site: string) => void;
  onViewFull: () => void;
  onAskHere: () => void;
}

/** 聊天网站：复制材料后在新标签页打开。 */
const SITES: readonly { name: Record<Lang, string>; url: string }[] = [
  { name: { zh: 'DeepSeek', en: 'DeepSeek' }, url: 'https://chat.deepseek.com/' },
  { name: { zh: '豆包', en: 'Doubao' }, url: 'https://www.doubao.com/chat/' },
  { name: { zh: 'Kimi', en: 'Kimi' }, url: 'https://www.kimi.com/' },
  { name: { zh: 'ChatGPT', en: 'ChatGPT' }, url: 'https://chatgpt.com/' },
  { name: { zh: 'Claude', en: 'Claude' }, url: 'https://claude.ai/new' },
];

export interface ReadingProps {
  t: Messages;
  lang: Lang;
  pack: KnowledgePack;
  topic: TopicEntry;
  /** 选宫句（已拼好的带术语文字）。 */
  selection: Rich;
  whenLabel: string;
  steps: readonly Step[];
  method: readonly MethodStep[];
  palaces: readonly PalaceView[];
  step: number;
  onSee: (k: number) => void;
  open: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onWhen: (k: WhenKey) => void;
  onAskStep: (k: number) => void;
  ask: AskInfo;
  /** 页脚：释义来源一句、暂用默认包的说明、换一套释义、完整提示词、复制链接。 */
  footer: ReactNode;
  titleRef: RefObject<HTMLHeadingElement | null>;
  askRef: RefObject<HTMLTextAreaElement | null>;
  stepRefs: RefObject<(HTMLLIElement | null)[]>;
  onJumpAsk: () => void;
}

/** 右栏的阅读：头部、五步、问 AI、页脚。 */
export function Reading(p: ReadingProps) {
  const { t, lang, pack, topic, steps, method, palaces, step, open, ask } = p;
  const name = topic.title ?? topic.slug;
  const askId = useId();
  return (
    <article className={css.reading}>
      <header className={css.head}>
        <div className={css.headTop}>
          <p className={css.eyebrow}>{p.whenLabel}</p>
          <button type="button" className={css.jumpAsk} onClick={p.onJumpAsk}>
            {t.read.jumpAsk}
          </button>
        </div>
        <h2 ref={p.titleRef} className={css.title} tabIndex={-1}>
          {name}
        </h2>
        <p className={css.sel}>
          <RichText t={t} pack={pack} parts={p.selection} />
        </p>
        {topic.intro && (
          <div className={css.intro}>
            <Markdown source={topic.intro} variant="preview" />
          </div>
        )}
      </header>
      <ol className={css.steps} aria-label={fmt(t.read.stepsLabel, { topic: name })}>
        {steps.map((s, k) => {
          const m = method[k]!;
          const termId = STEP_TERMS[k];
          return (
            <li
              key={k}
              ref={(el) => {
                p.stepRefs.current[k] = el;
              }}
              className={css.step}
              data-on={step === k ? '' : undefined}
            >
              <div className={css.stepHead}>
                <MiniBoard t={t} palaces={palaces} step={s} onSee={() => p.onSee(k)} />
                <h3 className={css.stepTitle} tabIndex={-1} data-step={k}>
                  {termId ? <Term t={t} pack={pack} slug={TERM_SLUGS[termId]} text={m.title} /> : m.title}
                </h3>
                <button type="button" className={css.see} aria-pressed={step === k} onClick={() => p.onSee(k)}>
                  {t.read.seeOnBoard}
                </button>
              </div>
              <div className={css.facts}>
                {s.facts.map((f, i) => (
                  <p key={i}>
                    <RichText t={t} pack={pack} parts={f} />
                  </p>
                ))}
              </div>
              {s.when && (
                <div className={css.acts}>
                  <button type="button" className={`${controls.ghost} ${css.actButton}`} disabled={!s.when.decade} onClick={() => p.onWhen('decade')}>
                    {fmt(t.read.seeDecade, { topic: name })}
                  </button>
                  <button type="button" className={`${controls.ghost} ${css.actButton}`} disabled={!s.when.year} onClick={() => p.onWhen('year')}>
                    {fmt(t.read.seeYear, { topic: name })}
                  </button>
                </div>
              )}
              <p className={css.how}>
                <span className={css.howLabel}>{t.read.how}</span>
                {m.how}
              </p>
              {(s.notes.length > 0 || s.groups.length > 0) && (
                <div className={css.notes}>
                  <p className={css.notesLabel}>{t.read.notes}</p>
                  {s.notes.map((n) => (
                    <NoteBlock key={noteId(n)} t={t} pack={pack} note={n} id={`${k}:${noteId(n)}`} open={open} onToggle={p.onToggle} />
                  ))}
                  {s.groups.map((g) => {
                    const gid = `${k}:${g.id}`;
                    return (
                      <div key={g.id} className={css.group}>
                        <MoreButton open={open.has(gid)} label={g.title} t={t} onToggle={() => p.onToggle(gid)} className={css.groupButton} />
                        {open.has(gid) && g.notes.map((n) => <NoteBlock key={noteId(n)} t={t} pack={pack} note={n} id={`${gid}:${noteId(n)}`} open={open} onToggle={p.onToggle} />)}
                      </div>
                    );
                  })}
                </div>
              )}
              <button type="button" className={css.askStep} onClick={() => p.onAskStep(k)}>
                {t.read.askStep}
              </button>
            </li>
          );
        })}
      </ol>
      <section className={css.ask} aria-labelledby={askId} id="ask-ai">
        <h3 id={askId} className={css.askTitle} tabIndex={-1}>
          {t.read.askTitle}
        </h3>
        <label className={css.askField}>
          <span className={css.askLabel}>{t.read.askLabel}</span>
          <textarea
            ref={p.askRef}
            className={css.askInput}
            rows={3}
            value={ask.question}
            placeholder={t.read.askPlaceholders[topic.slug] ?? fmt(t.read.askPlaceholder, { topic: name })}
            onChange={(e) => ask.onQuestion(e.target.value)}
          />
        </label>
        <p className={css.askSummary}>
          {fmtNodes(t.read.askSummary, {
            topic: name,
            when: ask.whenPart,
            n: <span className={css.askCount}>{[...ask.prompt].length.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en')}</span>,
          })}
          <button type="button" className={css.inline} onClick={ask.onViewFull}>
            {t.read.viewFull}
          </button>
        </p>
        <p className={css.askSub}>{t.read.copyOpen}</p>
        <div className={css.sites}>
          {SITES.map((s) => (
            <a key={s.url} className={`${controls.ghost} ${css.site}`} href={s.url} target="_blank" rel="noopener noreferrer" onClick={() => ask.onCopy(s.name[lang])}>
              {s.name[lang]}
            </a>
          ))}
        </div>
        <div className={css.inPage}>
          <p className={css.inPageText}>{ask.key ? fmt(t.read.inPageKey, { service: ask.key.service }) : t.read.inPageNoKey}</p>
          <button type="button" className={`${controls.ghost} ${css.actButton}`} onClick={ask.onAskHere}>
            {ask.key ? fmt(t.read.askHereModel, { model: ask.key.model }) : t.read.askHere}
          </button>
        </div>
      </section>
      {p.footer}
    </article>
  );
}

/** 没有盘时的右栏：未排盘、正在排盘、排盘程序没装上。 */
export function ReadingEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className={css.empty}>
      <h3 className={css.emptyTitle}>{title}</h3>
      <p className={css.emptyBody}>{body}</p>
    </div>
  );
}

/** 手机底栏（<1024）：左边选主题，右边到问 AI。 */
export function ReadingBar({ t, topics, topic, onTopic, onAsk }: { t: Messages; topics: readonly TopicEntry[]; topic: TopicEntry; onTopic: (slug: string) => void; onAsk: () => void }) {
  return (
    <div className={css.bar}>
      <Picker
        label={t.read.topics}
        title={t.read.topics}
        width={300}
        placeholder=""
        triggerClass={`${controls.ghost} ${css.barTopic}`}
        value={
          <>
            <span className={css.barTopicLabel}>{t.read.barTopic} </span>
            <b className={css.barTopicName}>{topic.title ?? topic.slug}</b>
          </>
        }
      >
        {(close) => (
          <OptionGrid
            label={t.read.topicsLabel}
            columns={3}
            autoFocus
            options={topics.map((x) => ({ key: x.slug, text: x.title ?? x.slug, content: <b>{x.title ?? x.slug}</b> }))}
            selected={topic.slug}
            onSelect={(slug) => {
              close();
              onTopic(slug);
            }}
          />
        )}
      </Picker>
      <button type="button" className={`${controls.button} ${css.barAsk}`} onClick={onAsk}>
        {t.read.jumpAsk}
      </button>
    </div>
  );
}

