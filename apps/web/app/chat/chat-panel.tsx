import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import type { Astrolabe, KnowledgePack } from 'x-iztro';
import * as controls from '../components/controls.css';
import { CaretIcon, CloseIcon } from '../components/icons';
import { useToast } from '../components/toast';
import { HTML_LANG, type Lang } from '../i18n/lang';
import { fmt, type Messages } from '../i18n/messages';
import type { Kernel } from '../kernel/kernel';
import { useMediaQuery } from '../lib/media';
import { Markdown } from '../markdown/markdown';
import * as css from './chat.css';
import { type AssistantMessage, type ChatError, type Conversation, type UserMessage, modelHistory, shorterFrom } from './conversation';
import { instructions } from './instructions';
import { type ChatSettings, hostOf } from './providers';
import { ModelPicker, SetupForm } from './setup';
import {
  type DrawerKind,
  type TurnDeps,
  continueWithoutTools,
  deleteAllConversations,
  deleteConversation,
  draftKey,
  editLast,
  historyBudget,
  retry,
  retryShorter,
  selectConversation,
  send,
  setEditing,
  serviceName,
  setDraft,
  shownConversation,
  stop,
  switchModel,
  useChatDb,
  useChatSession,
} from './session';
import type { ChartFocus } from './tools';

/** 对话用到的这张盘：生辰、页面上下文行、查盘所需的内核与知识包，以及「在盘上看」。 */
export interface ChatChart {
  /** 地址 `#` 之后的生辰参数。 */
  hash: string;
  /** 生辰的显示写法。 */
  birth: string;
  /** 页面上下文行（生辰、看的层与宫），随问题发给模型。 */
  context: string;
  kernel: Kernel;
  chart: Astrolabe;
  pack: KnowledgePack;
  packSource: string;
  /** 今天的公历日期 `YYYY-M-D`；`year` 是今天所在的农历年（无工具模式附上的运限年）。 */
  today: string;
  year: number;
  /** 无工具模式附在提问前的盘面文本。 */
  chartText: () => string;
  /** 能否在盘上显示；能时 `focus` 换到那里并返回提示条的文字。 */
  canFocus: (f: ChartFocus) => boolean;
  focus: (f: ChartFocus) => string;
}

/** 「复制」成功后显示「已复制」的时长（毫秒）。 */
const COPIED_MS = 2000;
/** 用户停在离底部这么近（px）时，新内容到来时跟着滚。 */
const FOLLOW_PX = 40;

function failText(t: Messages, err: unknown): string {
  return fmt(t.chat.saveFailed, { reason: err instanceof Error ? err.message : String(err) });
}

/** 「它查了什么」（设计规范 19.5）。 */
function Calls({ t, m, focus, onFocus }: { t: Messages; m: AssistantMessage; focus: ((f: ChartFocus) => boolean) | null; onFocus: (f: ChartFocus) => void }) {
  const [open, setOpen] = useState(false);
  const c = t.chat.calls;
  if (m.calls.length === 0) return null;
  const running = m.calls.find((x) => x.state === 'running');
  const ran = m.calls.filter((x) => x.state === 'done' || x.state === 'failed');
  const summary = running
    ? fmt(c.running, { label: running.label })
    : m.status === 'stopped' && m.calls.some((x) => x.state === 'skipped')
      ? fmt(c.stoppedAfter, { n: ran.length })
      : fmt(c.done, { n: m.calls.length, labels: m.calls.map((x) => x.label).join(t.chat.tools.sep) });
  return (
    <div className={css.calls}>
      <button type="button" className={css.callsToggle} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className={running ? css.runDot : css.doneDot} aria-hidden="true" />
        <span className={css.callsText}>{summary}</span>
        <span className={css.callsCaret}>
          <CaretIcon />
        </span>
      </button>
      {open && (
        <ul className={css.callList}>
          {m.calls.map((x) => (
            <li key={x.id} className={css.callRow}>
              <b className={css.callName}>{x.label}</b>
              <span className={css.callMs}>
                {x.state === 'running' ? c.pending : x.state === 'skipped' ? c.skipped : x.state === 'failed' ? c.failed : fmt(c.ms, { n: x.ms ?? 0 })}
              </span>
              {x.focus && focus?.(x.focus) ? (
                <button type="button" className={css.see} onClick={() => onFocus(x.focus!)}>
                  {c.see}
                </button>
              ) : (
                <span />
              )}
              {x.scope && <small className={css.callScope}>{x.scope}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 出错时回答处的错误块（设计规范 19.8）。 */
function ErrorBlock({
  t,
  error,
  settings,
  model,
  onRetry,
  onSettings,
  onUsePrompt,
  onSwitch,
  onNoTools,
  onShorter,
  onNewChat,
  calls,
}: {
  t: Messages;
  error: ChatError;
  settings: ChatSettings;
  model: string;
  onRetry: (() => void) | null;
  onSettings: () => void;
  onUsePrompt: () => void;
  onSwitch: ((model: string) => void) | null;
  onNoTools: (() => void) | null;
  /** 上下文超长时「较早的消息不再发给模型，重试」；已没有可以少发的时为 null。 */
  onShorter: (() => void) | null;
  onNewChat: () => void;
  /** 这条回答查了几次工具。 */
  calls: number;
}) {
  const e = t.chat.errors;
  const service = serviceName(settings, t);
  const host = hostOf(settings);
  const status = error.status ?? '';
  const ghost = `${controls.ghost} ${css.actionButton}`;
  const retryButton = onRetry && (
    <button type="button" className={ghost} onClick={onRetry}>
      {t.chat.retry}
    </button>
  );
  const promptButton = (
    <button type="button" className={ghost} onClick={onUsePrompt}>
      {e.usePrompt}
    </button>
  );
  const alternative = settings.models.find((m) => m.tools === true && m.id !== model)?.id;
  let title: string;
  let body: string;
  let actions: ReactNode;
  switch (error.kind) {
    case 'auth':
      title = fmt(e.authTitle, { service, status });
      body = fmt(e.authBody, { service });
      actions = (
        <>
          <button type="button" className={ghost} onClick={onSettings}>
            {e.toSettings}
          </button>
          {retryButton}
        </>
      );
      break;
    case 'rate':
      title = fmt(e.rateTitle, { service });
      body = fmt(e.rateBody, { service });
      actions = (
        <>
          {retryButton}
          {promptButton}
        </>
      );
      break;
    case 'network':
      title = fmt(e.networkTitle, { host });
      body = e.networkBody;
      actions = (
        <>
          {retryButton}
          {promptButton}
        </>
      );
      break;
    case 'tools':
      title = fmt(e.toolsTitle, { model });
      body = e.toolsBody;
      actions = (
        <>
          {alternative && onSwitch && (
            <button type="button" className={ghost} onClick={() => onSwitch(alternative)}>
              {fmt(e.switchTo, { model: alternative })}
            </button>
          )}
          {onNoTools && (
            <button type="button" className={ghost} onClick={onNoTools}>
              {e.noToolsGo}
            </button>
          )}
        </>
      );
      break;
    case 'context':
      title = fmt(e.contextTitle, { service, status });
      body = fmt(e.contextBody, { model });
      actions = (
        <>
          {onShorter && (
            <button type="button" className={ghost} onClick={onShorter}>
              {e.shorter}
            </button>
          )}
          <button type="button" className={ghost} onClick={onNewChat}>
            {t.chat.newChat}
          </button>
        </>
      );
      break;
    case 'empty':
      title = calls > 0 ? fmt(e.emptyAfterCalls, { n: calls }) : e.emptyTitle;
      body = e.emptyBody;
      actions = (
        <>
          {retryButton}
          {promptButton}
        </>
      );
      break;
    case 'page':
      title = e.pageTitle;
      body = error.detail ?? '';
      actions = retryButton;
      break;
    case 'other':
      title = error.status === null ? fmt(e.otherTitleNoStatus, { service }) : fmt(e.otherTitle, { service, status });
      body = error.detail ?? '';
      actions = (
        <>
          {retryButton}
          {promptButton}
        </>
      );
      break;
  }
  return (
    <div className={css.error} role="alert">
      <b className={css.errorTitle}>{title}</b>
      {body && <p className={css.errorBody}>{body}</p>}
      {actions && <div className={css.actions}>{actions}</div>}
    </div>
  );
}

function CopyButton({ t, text }: { t: Messages; text: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      className={css.footButton}
      onClick={async () => {
        clearTimeout(timer.current);
        try {
          await navigator.clipboard.writeText(text);
          setState('ok');
          timer.current = setTimeout(() => setState('idle'), COPIED_MS);
        } catch (err) {
          console.error(err);
          setState('failed');
        }
      }}
    >
      {state === 'ok' ? t.chat.copied : state === 'failed' ? t.chat.copyFailed : t.chat.copy}
    </button>
  );
}

/** 用户的一问；最后一问可以编辑（设计规范 19.4）。 */
function Question({
  t,
  m,
  editable,
  editing,
  onEdit,
  onCancel,
  onResend,
}: {
  t: Messages;
  m: UserMessage;
  editable: boolean;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onResend: (text: string) => void;
}) {
  const [text, setText] = useState(m.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!editing) return;
    setText(m.text);
    row.current?.scrollIntoView({ block: 'start' });
    const el = ref.current;
    if (!el) throw new Error('编辑框没有挂上');
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing, m.text]);
  if (editing) {
    return (
      <div ref={row} className={css.userRow}>
        <div className={`${css.user} ${css.editBox}`}>
          <textarea
            ref={ref}
            className={css.editArea}
            aria-label={t.chat.editLabel}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                // 只收起编辑，不连带关闭全屏面板（Esc 依次关闭，设计规范 19.13）。
                e.preventDefault();
                e.stopPropagation();
                onCancel();
              }
            }}
          />
          <div className={css.editActions}>
            <button type="button" className={`${controls.ghost} ${css.smallButton}`} onClick={onCancel}>
              {t.chat.cancel}
            </button>
            <button type="button" className={`${controls.button} ${css.smallButton}`} disabled={text.trim() === ''} onClick={() => onResend(text.trim())}>
              {t.chat.resend}
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={css.userRow}>
      {editable && (
        <div className={css.foot}>
          <button type="button" className={css.footButton} onClick={onEdit}>
            {t.chat.edit}
          </button>
        </div>
      )}
      <div className={css.user}>{m.text}</div>
    </div>
  );
}

/** 对话记录抽屉（设计规范 19.11）。 */
function HistoryDrawer({
  t,
  lang,
  conversations,
  currentId,
  onOpen,
  onClose,
}: {
  t: Messages;
  lang: Lang;
  conversations: readonly Conversation[];
  currentId: string | null;
  onOpen: (c: Conversation) => void;
  onClose: () => void;
}) {
  const h = t.chat.history;
  const toast = useToast();
  const [confirm, setConfirm] = useState<{ kind: 'one'; c: Conversation } | { kind: 'all' } | null>(null);
  const doDelete = async () => {
    const target = confirm;
    setConfirm(null);
    if (!target) return;
    try {
      if (target.kind === 'all') {
        await deleteAllConversations();
        selectConversation(null);
      } else {
        await deleteConversation(target.c.id);
        if (target.c.id === currentId) {
          const next = conversations.find((c) => c.id !== target.c.id && c.chart === target.c.chart);
          selectConversation(next?.id ?? null);
        }
      }
      toast(h.deleted);
    } catch (err) {
      console.error(err);
      toast(failText(t, err));
    }
  };
  return (
    <ModalOverlay isOpen isDismissable onOpenChange={(o) => !o && onClose()} className={css.scrim}>
      <Modal className={css.drawer}>
        <Dialog className={css.drawerDialog} aria-labelledby="chat-history-title">
          <div className={css.drawerHead}>
            <div>
              <Heading slot="title" id="chat-history-title" className={css.drawerTitle}>
                {h.title}
              </Heading>
              <p className={css.drawerSub}>{fmt(h.sub, { n: conversations.length })}</p>
            </div>
            <Button className={css.drawerClose} aria-label={t.chat.setup.close} onPress={onClose} autoFocus>
              <CloseIcon />
            </Button>
          </div>
          <div className={css.drawerBody}>
            {conversations.length === 0 && <p className={css.emptyBody}>{h.empty}</p>}
            <ul>
              {conversations.map((c) => (
                <li key={c.id} className={css.historyRow}>
                  <button type="button" className={css.historyGo} onClick={() => onOpen(c)}>
                    <b className={css.historyTitle}>
                      {c.title}
                      {c.id === currentId && <span className={css.historyCurrent}>{h.current}</span>}
                    </b>
                    <small className={css.historyMeta}>
                      {fmt(h.meta, { birth: c.birth, date: new Date(c.updatedAt).toLocaleDateString(HTML_LANG[lang]), n: c.messages.length })}
                    </small>
                  </button>
                  <button type="button" className={css.historyDelete} aria-label={fmt(h.deleteOne, { title: c.title })} onClick={() => setConfirm({ kind: 'one', c })}>
                    <CloseIcon />
                  </button>
                </li>
              ))}
            </ul>
            <div className={css.historyFoot}>
              <span>{h.foot}</span>
              {conversations.length > 0 && (
                <button type="button" className={css.textButton} onClick={() => setConfirm({ kind: 'all' })}>
                  {h.deleteAll}
                </button>
              )}
            </div>
          </div>
        </Dialog>
      </Modal>
      {confirm && (
        <ModalOverlay isOpen isDismissable onOpenChange={(o) => !o && setConfirm(null)} className={css.dialogScrim}>
          <Modal className={css.dialog}>
            <Dialog role="alertdialog" aria-labelledby="chat-delete-title" aria-describedby="chat-delete-body">
              <Heading slot="title" id="chat-delete-title" className={css.dialogTitle}>
                {confirm.kind === 'all' ? fmt(h.confirmAll, { n: conversations.length }) : fmt(h.confirmOne, { title: confirm.c.title })}
              </Heading>
              <p id="chat-delete-body" className={css.dialogBody}>
                {confirm.kind === 'all' ? h.confirmAllBody : h.confirmBody}
              </p>
              <div className={css.dialogActions}>
                <Button className={controls.ghost} onPress={() => setConfirm(null)} autoFocus>
                  {h.cancel}
                </Button>
                <Button className={`${controls.button} ${css.danger}`} onPress={() => void doDelete()}>
                  {h.confirm}
                </Button>
              </div>
            </Dialog>
          </Modal>
        </ModalOverlay>
      )}
    </ModalOverlay>
  );
}

/** 设置抽屉：已设 Key 时从「设置」打开（设计规范 19.7）。 */
function SettingsDrawer({ t, settings, onUsePrompt, onClose }: { t: Messages; settings: ChatSettings; onUsePrompt: () => void; onClose: () => void }) {
  return (
    <ModalOverlay isOpen isDismissable onOpenChange={(o) => !o && onClose()} className={css.scrim}>
      <Modal className={css.drawer}>
        <Dialog className={css.drawerDialog} aria-labelledby="chat-settings-title">
          <div className={css.drawerHead}>
            <div>
              <Heading slot="title" id="chat-settings-title" className={css.drawerTitle}>
                {t.chat.setup.drawerTitle}
              </Heading>
              <p className={css.drawerSub}>{t.chat.setup.drawerSub}</p>
            </div>
            <Button className={css.drawerClose} aria-label={t.chat.setup.close} onPress={onClose} autoFocus>
              <CloseIcon />
            </Button>
          </div>
          <div className={css.drawerBody}>
            <SetupForm t={t} settings={settings} intro={false} onUsePrompt={onUsePrompt} />
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** 有物理键盘（细指针、可悬停）且不窄于 700px 时 Enter 发送。 */
function useKeyboardSend(): boolean {
  return useMediaQuery('(hover: hover) and (pointer: fine) and (min-width: 700px)');
}

/** 文本框随内容长高，到 168px 后在框内滚动。 */
function autosize(el: HTMLTextAreaElement | null): void {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
}

/**
 * 对话栏（设计规范 19.3–19.12）：工具行、释义标记、上下文行、对话记录、常驻说明、输入框与费用说明。
 * 没有 Key 时整栏是设置表单。`inSheet` 为全屏面板里的那一份：工具行不重复「新对话」「记录」（在面板头部）。
 */
export function ChatColumn({
  t,
  lang,
  chart,
  mark,
  inSheet,
  drawer,
  onDrawer,
  onUsePrompt,
  onOpenChart,
}: {
  t: Messages;
  lang: Lang;
  chart: ChatChart;
  mark: ReactNode;
  inSheet: boolean;
  drawer: DrawerKind;
  onDrawer: (d: DrawerKind) => void;
  onUsePrompt: () => void;
  /** 打开记录里属于另一张盘的对话：把页面换到那张盘。 */
  onOpenChart: (hash: string) => void;
}) {
  const db = useChatDb();
  const sess = useChatSession();
  const toast = useToast();
  const keyboard = useKeyboardSend();
  const wide = useMediaQuery('(min-width: 1024px)');
  const input = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  const ready = db.status === 'ready' ? db : null;
  const settings = ready?.settings ?? null;
  const conv = ready ? shownConversation(sess, ready.conversations, chart.hash) : null;
  const messages = conv?.messages ?? [];
  const generating = sess.live !== null;
  const key = draftKey(conv?.id ?? null, chart.hash);
  const draft = sess.drafts[key] ?? '';

  useLayoutEffect(() => {
    const el = logRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  });
  useLayoutEffect(() => autosize(input.current), [draft]);
  useEffect(() => {
    atBottom.current = true;
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conv?.id]);
  // 全屏面板打开时焦点在输入框（未设 Key 时在 Key 输入框，见 SetupForm 的 autoFocus）。
  const hasSettings = db.status === 'ready' && db.settings !== null;
  useEffect(() => {
    if (inSheet && hasSettings) input.current?.focus();
  }, [inSheet, hasSettings]);

  if (db.status !== 'ready') {
    if (db.status === 'loading') return <div className={css.chat} />;
    const text =
      db.status === 'unavailable'
        ? null
        : db.status === 'failed'
          ? fmt(t.chat.storageFailed, { reason: db.message })
          : db.status === 'blocked'
            ? t.chat.storageBlocked
            : t.chat.storageSuperseded;
    return (
      <div className={css.chat}>
        <p className={css.notice} role="status">
          {text === null ? (
            <>
              <b className={css.noticeTitle}>{t.chat.storageTitle}</b>
              {t.chat.storageBody}
            </>
          ) : (
            text
          )}
        </p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className={css.chat}>
        <SetupForm t={t} settings={null} intro autoFocus={inSheet} onUsePrompt={onUsePrompt} />
      </div>
    );
  }

  const deps: TurnDeps | null = chart
    ? {
        settings,
        kernel: chart.kernel,
        chart: chart.chart,
        pack: chart.pack,
        packSource: chart.packSource,
        t,
        lang,
        today: chart.today,
        chartText: chart.chartText,
      }
    : null;
  const run = (job: (d: TurnDeps) => Promise<void>) => {
    if (!deps) return;
    atBottom.current = true;
    job(deps).catch((err: unknown) => {
      console.error(err);
      toast(failText(t, err));
    });
  };
  const ask = (text: string) => {
    const q = text.trim();
    if (!q || generating || !settings.model) return;
    run((d) => send({ text: q, chart: chart.hash, birth: chart.birth, context: chart.context, existing: conv }, d));
    input.current?.focus();
  };
  const onFocus = (f: ChartFocus) => toast(chart.focus(f));
  const pickModel = (m: string) =>
    switchModel(settings, m, conv).then(
      () => toast(fmt(t.chat.picker.picked, { model: m })),
      (err: unknown) => {
        console.error(err);
        toast(failText(t, err));
      },
    );

  const budget = conv ? historyBudget(settings, instructions(lang, chart.today, !conv.noTools)) : 0;
  const history = conv ? modelHistory(messages, budget, conv.sendFrom ?? 0) : null;
  const pending = messages.at(-1)?.role === 'assistant' ? messages.slice(0, -1) : messages;
  const canShorten = conv !== null && shorterFrom(pending, budget, conv.sendFrom ?? 0) !== null;
  const lastUser = messages.findLastIndex((m) => m.role === 'user');
  const lastIndex = messages.length - 1;
  const canSend = !generating && settings.model !== '' && draft.trim() !== '';
  const service = serviceName(settings, t);
  /** 当前服务里第一个能调用工具的其他模型：「换成 …」用。 */
  const toolModel = settings.models.find((m) => m.tools === true && m.id !== settings.model)?.id ?? null;

  return (
    <div className={css.chat}>
      <div className={css.toolbar}>
        <ModelPicker t={t} settings={settings} inSheet={inSheet} onPick={(m) => void pickModel(m)} onSettings={() => onDrawer('settings')} />
        {!inSheet && (
          <>
            <button
              type="button"
              className={css.textButton}
              disabled={generating}
              onClick={() => {
                if (conv) selectConversation(null);
                input.current?.focus();
              }}
            >
              {t.chat.newChat}
            </button>
            <button type="button" className={css.textButton} onClick={() => onDrawer('history')}>
              {t.chat.historyButton}
            </button>
          </>
        )}
        <button type="button" className={css.textButton} onClick={() => onDrawer('settings')}>
          {t.chat.settings}
        </button>
      </div>
      {mark}
      <p className={css.context}>
        {chart.context} {t.chat.contextTools}
      </p>
      <div
        ref={logRef}
        className={css.log}
        role="log"
        aria-live="polite"
        aria-label={t.chat.log}
        tabIndex={0}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight <= FOLLOW_PX;
        }}
      >
        {messages.length === 0 ? (
          <div className={css.empty}>
            <h3 className={css.emptyTitle}>{t.chat.empty.title}</h3>
            <p className={css.emptyBody}>{t.chat.empty.body}</p>
            <ul className={css.suggestions}>
              {t.chat.empty.suggestions.map((s) => (
                <li key={s}>
                  <button type="button" className={css.suggestion} disabled={generating || !settings.model} onClick={() => ask(s)}>
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          messages.map((m, i) => {
            const cut = history && history.dropped > 0 && i === history.firstSent && (
              <p key={`cut-${m.id}`} className={css.cut}>
                {fmt(t.chat.long.cut, { n: history.dropped })}
              </p>
            );
            if (m.role === 'user') {
              return (
                <div key={m.id}>
                  {cut}
                  <Question
                    t={t}
                    m={m}
                    editable={i === lastUser && !generating}
                    editing={sess.editing === m.id}
                    onEdit={() => setEditing(m.id)}
                    onCancel={() => setEditing(null)}
                    onResend={(text) => {
                      setEditing(null);
                      if (conv) run((d) => editLast(conv, text, d));
                    }}
                  />
                </div>
              );
            }
            const last = i === lastIndex;
            const streaming = m.status === 'streaming';
            return (
              <div key={m.id} className={css.answer} aria-busy={streaming || undefined}>
                {cut}
                <Calls t={t} m={m} focus={wide && !inSheet ? chart.canFocus : null} onFocus={onFocus} />
                {(m.text || streaming) && (
                  <div>
                    <Markdown source={m.text} variant="chat" />
                    {streaming && <span className={css.caret} aria-hidden="true" />}
                  </div>
                )}
                {m.error && conv && (
                  <ErrorBlock
                    t={t}
                    error={m.error}
                    settings={settings}
                    model={m.model}
                    onRetry={last && !generating ? () => run((d) => retry(conv, d)) : null}
                    onSettings={() => onDrawer('settings')}
                    onUsePrompt={onUsePrompt}
                    onSwitch={last && !generating ? (model) => void pickModel(model) : null}
                    onNoTools={last && !generating ? () => run((d) => continueWithoutTools(conv, d)) : null}
                    onShorter={last && !generating && canShorten ? () => run((d) => retryShorter(conv, d)) : null}
                    onNewChat={() => selectConversation(null)}
                    calls={m.calls.length}
                  />
                )}
                {!streaming && m.status !== 'error' && (
                  <div className={css.foot}>
                    <span className={css.footWho}>{`${m.service} ${m.model}`}</span>
                    {m.status === 'stopped' && <span className={css.stopped}>{t.chat.stopped}</span>}
                    {m.text && <CopyButton t={t} text={m.text} />}
                    {last && !generating && conv && (
                      <button type="button" className={css.footButton} onClick={() => run((d) => retry(conv, d))}>
                        {t.chat.retry}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      {!settings.model && (
        <p className={css.note}>
          <b className={css.noteLead}>{t.chat.noModelLead}</b>
          {fmt(t.chat.noModelBody, { service })}
        </p>
      )}
      {history && history.dropped > 0 && (
        <div className={css.note}>
          <b className={css.noteLead}>{t.chat.long.lead}</b>
          {fmt(t.chat.long.body, { n: history.dropped })}
          <div className={css.actions}>
            <button type="button" className={`${controls.ghost} ${css.actionButton}`} disabled={generating} onClick={() => selectConversation(null)}>
              {t.chat.newChat}
            </button>
          </div>
        </div>
      )}
      {conv?.noTools && (
        <div className={css.note}>
          <b className={css.noteLead}>{t.chat.noTools.lead}</b>
          {fmt(t.chat.noTools.body, { model: settings.model, y: chart.year })}
          {toolModel && (
            <div className={css.actions}>
              <button type="button" className={`${controls.ghost} ${css.actionButton}`} disabled={generating} onClick={() => void pickModel(toolModel)}>
                {fmt(t.chat.errors.switchTo, { model: toolModel })}
              </button>
            </div>
          )}
        </div>
      )}
      <form
        className={css.composer}
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
      >
        <textarea
          ref={input}
          className={css.input}
          rows={1}
          aria-label={t.chat.ask}
          placeholder={keyboard ? t.chat.placeholderKeyboard : t.chat.placeholderTouch}
          value={draft}
          onChange={(e) => setDraft(key, e.target.value)}
          onKeyDown={(e) => {
            if (keyboard && e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              ask(draft);
            }
          }}
        />
        {generating ? (
          <button type="button" className={`${controls.ghost} ${css.sendButton}`} onClick={stop}>
            {t.chat.stop}
          </button>
        ) : (
          <button type="submit" className={`${controls.button} ${css.sendButton}`} disabled={!canSend}>
            {t.chat.send}
          </button>
        )}
      </form>
      <small className={css.fine}>
        {settings.provider === 'compatible' ? fmt(t.chat.fineCompat, { host: hostOf(settings) }) : fmt(t.chat.fine, { host: hostOf(settings), service })}
      </small>
      {drawer === 'settings' && (
        <SettingsDrawer
          t={t}
          settings={settings}
          onUsePrompt={() => {
            onDrawer(null);
            onUsePrompt();
          }}
          onClose={() => onDrawer(null)}
        />
      )}
      {drawer === 'history' && (
        <HistoryDrawer
          t={t}
          lang={lang}
          conversations={db.conversations}
          currentId={conv?.id ?? null}
          onClose={() => onDrawer(null)}
          onOpen={(c) => {
            onDrawer(null);
            selectConversation(c.id);
            if (c.chart !== chart.hash) onOpenChart(c.chart);
          }}
        />
      )}
    </div>
  );
}

/** 这张盘上显示的对话（面板头部决定「新对话」是否可用时用）。 */
export function useShownConversation(chartHash: string | null): Conversation | null {
  const db = useChatDb();
  const sess = useChatSession();
  return db.status === 'ready' && chartHash ? shownConversation(sess, db.conversations, chartHash) : null;
}
