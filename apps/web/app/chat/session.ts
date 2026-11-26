import { useSyncExternalStore } from 'react';
import type { Astrolabe, KnowledgePack } from 'x-iztro';
import type { Lang } from '../i18n/lang';
import type { Messages } from '../i18n/messages';
import type { Kernel } from '../kernel/kernel';
import { type LocalState, localStore } from '../lib/local-store';
import {
  type AssistantMessage,
  type ChatMessage,
  type Conversation,
  DEFAULT_CONTEXT,
  RESERVE,
  estimateTokens,
  modelHistory,
  shorterFrom,
  titleOf,
} from './conversation';
import { instructions } from './instructions';
import { type ChatSettings, PROVIDERS, type ProviderId } from './providers';
import { type ChatSnapshot, type SideTab, openChatDb } from './store';

/**
 * 对话在页面里的状态：本机对话库（设置、页签、对话），加上内存里的这几样，右栏与全屏面板共用一份，
 * 窗口跨过断点、面板开合时不丢：
 * - 正在生成的那段对话（含生成中的回答）与它的停止开关；同一时刻只有一段在生成；
 * - 当前看的是哪段对话；
 * - 输入框里没发出的草稿（按对话分，新对话按盘分）；
 * - 全屏面板与抽屉（记录、设置）的开合、设置表单里填到一半的内容、正在编辑的问题：内核装好、换盘时右栏会换一个实例
 *   重新挂载，对话也会在右栏与全屏面板之间移动，这些不因此丢失。
 */

const db = localStore({ channel: 'xzw-chat', open: openChatDb, read: (c) => c.load() });

export type ChatDbState = LocalState<ChatSnapshot>;

/** 本机对话库的状态；第一次用到时开始读库。 */
export const useChatDb = db.use;

interface Live {
  conv: Conversation;
  abort: AbortController;
}

/** 对话栏里开着的抽屉。 */
export type DrawerKind = 'history' | 'settings' | null;

/** 设置表单里填到一半的内容与检查结果。`provider`、`baseURL` 为 null 时取已存的设置。 */
export interface SetupDraft {
  provider: ProviderId | null;
  baseURL: string | null;
  key: string;
  show: boolean;
  result: { kind: 'idle' } | { kind: 'checking'; host: string } | { kind: 'ok'; text: string } | { kind: 'bad'; text: string };
  urlError: string | null;
  keyError: string | null;
}

const EMPTY_SETUP: SetupDraft = { provider: null, baseURL: null, key: '', show: false, result: { kind: 'idle' }, urlError: null, keyError: null };

interface SessionState {
  live: Live | null;
  /** 当前对话；null 为这张盘上还没发问的新对话。 */
  currentId: string | null;
  drafts: Readonly<Record<string, string>>;
  /** 平板与手机上的全屏面板是否开着。 */
  sheet: boolean;
  drawer: DrawerKind;
  setup: SetupDraft;
  /** 正在编辑的问题。 */
  editing: string | null;
}

let session: SessionState = { live: null, currentId: null, drafts: {}, sheet: false, drawer: null, setup: EMPTY_SETUP, editing: null };
const listeners = new Set<() => void>();
const INITIAL: SessionState = session;

function setSession(next: Partial<SessionState>): void {
  session = { ...session, ...next };
  for (const l of listeners) l();
}

export function useChatSession(): SessionState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => session,
    () => INITIAL,
  );
}

/** 草稿的键：已有对话按 id，新对话按盘。 */
export function draftKey(currentId: string | null, chart: string): string {
  return currentId ?? `new:${chart}`;
}

export function setDraft(key: string, text: string): void {
  setSession({ drafts: { ...session.drafts, [key]: text } });
}

/**
 * 这张盘上要显示的对话：当前对话属于这张盘时是它（生成中时是内存里那份），否则是新对话（null）。
 * 换一张盘即开新对话；回到原来的盘时，原来那段对话仍是当前的。
 */
export function shownConversation(state: SessionState, conversations: readonly Conversation[], chart: string): Conversation | null {
  if (state.currentId === null) return null;
  if (state.live?.conv.id === state.currentId) return state.live.conv.chart === chart ? state.live.conv : null;
  const c = conversations.find((x) => x.id === state.currentId);
  return c && c.chart === chart ? c : null;
}

export function setSheet(open: boolean): void {
  if (session.sheet !== open) setSession({ sheet: open });
}

export function setDrawer(drawer: DrawerKind): void {
  setSession({ drawer });
}

export function updateSetup(part: Partial<SetupDraft>): void {
  setSession({ setup: { ...session.setup, ...part } });
}

export function setEditing(id: string | null): void {
  setSession({ editing: id });
}

export function selectConversation(id: string | null): void {
  setSession({ currentId: id });
}

export function isGenerating(): boolean {
  return session.live !== null;
}

/** 生成所需：设置、内核与这张盘、生效的知识包、文案，以及无工具模式附在提问前的盘面文本。 */
export interface TurnDeps {
  settings: ChatSettings;
  kernel: Kernel;
  chart: Astrolabe;
  pack: KnowledgePack;
  packSource: string;
  t: Messages;
  lang: Lang;
  /** 今天的公历日期 `YYYY-M-D`。 */
  today: string;
  chartText: () => string;
}

export function serviceName(s: ChatSettings, t: Messages): string {
  return PROVIDERS[s.provider].name ?? t.chat.setup.compatService;
}

async function write(run: (c: Parameters<Parameters<typeof db.mutate>[0]>[0]) => Promise<ChatSnapshot>): Promise<ChatSnapshot> {
  return db.mutate(run);
}

export const saveSettings = (s: ChatSettings | null) => write((c) => c.saveSettings(s));
export const saveTab = (tab: SideTab) => write((c) => c.saveTab(tab));
export const deleteConversation = (id: string) => write((c) => c.deleteConversation(id));
export const deleteAllConversations = () => write((c) => c.deleteAllConversations());
export const putConversation = (conv: Conversation) => write((c) => c.putConversation(conv));

/** 发给模型的历史的预算（token）：所选模型的上下文长度减去回答与工具结果的余量、系统提示词。 */
export function historyBudget(settings: ChatSettings, system: string): number {
  const info = settings.models.find((m) => m.id === settings.model);
  return (info?.context ?? DEFAULT_CONTEXT) - RESERVE - estimateTokens(system);
}

/**
 * 生成一条回答：对话里最后一条是要回答的问题。生成中的回答只在内存里，结束（完成、停止、出错）后整段存进本机。
 * 本页自己的缺陷（工具实现、内核内部错误）记成 `page` 类错误显示在回答处，并打到控制台。
 */
async function generate(conv: Conversation, deps: TurnDeps): Promise<void> {
  if (session.live) throw new Error('已有一段对话在生成');
  const { settings, t } = deps;
  const tools = !conv.noTools;
  const system = instructions(deps.lang, deps.today, tools);
  const { turns } = modelHistory(conv.messages, historyBudget(settings, system), conv.sendFrom ?? 0);
  const last = turns.at(-1);
  if (!last || last.role !== 'user') throw new Error('对话的最后一条不是问题');
  if (!tools) turns[turns.length - 1] = { ...last, content: `<chart>${deps.chartText()}</chart>\n\n${last.content}` };
  const base: AssistantMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    provider: settings.provider,
    service: serviceName(settings, t),
    model: settings.model,
    text: '',
    calls: [],
    status: 'streaming',
    error: null,
    at: Date.now(),
  };
  const abort = new AbortController();
  const withAnswer = (m: AssistantMessage): Conversation => ({ ...conv, messages: [...conv.messages, m] });
  setSession({ live: { conv: withAnswer(base), abort }, currentId: conv.id });
  let final: AssistantMessage;
  try {
    const { runTurn } = await import('./engine');
    final = await runTurn({
      settings,
      system,
      turns,
      tools: tools ? { ctx: { kernel: deps.kernel, chart: deps.chart, pack: deps.pack, packSource: deps.packSource }, t } : null,
      signal: abort.signal,
      base,
      onUpdate: (m) => setSession({ live: { conv: withAnswer(m), abort } }),
    });
  } catch (err) {
    console.error(err);
    // session 在 await 期间被 onUpdate 改过，按当前值读。
    const current = (session as SessionState).live?.conv.messages.at(-1);
    const partial = current?.role === 'assistant' ? current : base;
    final = { ...partial, status: 'error', error: { kind: 'page', status: null, detail: err instanceof Error ? err.message : String(err) } };
  }
  const done = { ...withAnswer(final), updatedAt: Date.now() };
  try {
    await putConversation(done);
    await recordToolSupport(settings, final, tools);
  } finally {
    setSession({ live: null });
  }
}

/** 第一次请求的结果定下模型能否调用工具：报「不支持」记为否；带工具完成了一轮记为能。 */
async function recordToolSupport(settings: ChatSettings, answer: AssistantMessage, tools: boolean): Promise<void> {
  const info = settings.models.find((m) => m.id === answer.model);
  if (!info) return;
  const verdict = answer.error?.kind === 'tools' ? false : tools && answer.status === 'done' ? true : null;
  if (verdict === null || info.tools === verdict) return;
  const now = db.current();
  if (now.status !== 'ready' || !now.settings) return;
  const s = now.settings;
  await saveSettings({ ...s, models: s.models.map((m) => (m.id === answer.model ? { ...m, tools: verdict } : m)) });
}

/** 发问。当前不是这张盘的对话时新建一段；`birth` 是生辰的显示写法，`context` 是页面上下文行。 */
export async function send(input: { text: string; chart: string; birth: string; context: string; existing: Conversation | null }, deps: TurnDeps): Promise<void> {
  const now = Date.now();
  const question: ChatMessage = { id: crypto.randomUUID(), role: 'user', text: input.text, context: input.context, at: now };
  const conv: Conversation = input.existing
    ? { ...input.existing, messages: [...input.existing.messages, question], updatedAt: now }
    : { id: crypto.randomUUID(), title: titleOf(input.text), chart: input.chart, birth: input.birth, createdAt: now, updatedAt: now, messages: [question], noTools: false };
  setSession({ currentId: conv.id, drafts: { ...session.drafts, [draftKey(input.existing?.id ?? null, input.chart)]: '' } });
  await putConversation(conv);
  await generate(conv, deps);
}

/** 用同一问题重新生成最后一条回答（替换它，含错误块）。 */
export async function retry(conv: Conversation, deps: TurnDeps): Promise<void> {
  const messages = conv.messages.at(-1)?.role === 'assistant' ? conv.messages.slice(0, -1) : conv.messages;
  await generate({ ...conv, messages }, deps);
}

/** 改最后一问并重新生成：这一问之后的回答删去。 */
export async function editLast(conv: Conversation, text: string, deps: TurnDeps): Promise<void> {
  const i = conv.messages.findLastIndex((m) => m.role === 'user');
  const q = conv.messages[i];
  if (!q || q.role !== 'user') throw new Error('对话里没有问题可改');
  const messages = [...conv.messages.slice(0, i), { ...q, text, at: Date.now() }];
  await generate({ ...conv, messages, title: i === 0 ? titleOf(text) : conv.title }, deps);
}

/**
 * 厂商报上下文超长后，用户选了「较早的消息不再发给模型」：把 `sendFrom` 前移到当前仍发送的问题的中间一问，用同一问题重新生成。
 * 记录里已有的分隔线随之移到新的位置。只剩最后一问可发时什么也不做（界面不给这个动作）。
 */
export async function retryShorter(conv: Conversation, deps: TurnDeps): Promise<void> {
  const messages = conv.messages.at(-1)?.role === 'assistant' ? conv.messages.slice(0, -1) : conv.messages;
  const from = shorterFrom(messages, historyBudget(deps.settings, instructions(deps.lang, deps.today, !conv.noTools)), conv.sendFrom ?? 0);
  if (from === null) return;
  await retry({ ...conv, sendFrom: from }, deps);
}

/** 无工具模式：盘面以文本附在提问前，用同一问题重新生成。 */
export async function continueWithoutTools(conv: Conversation, deps: TurnDeps): Promise<void> {
  await retry({ ...conv, noTools: true }, deps);
}

/** 停止生成：已生成的部分保留。 */
export function stop(): void {
  session.live?.abort.abort();
}

/** 换模型：存进设置；当前对话退出无工具模式。 */
export async function switchModel(settings: ChatSettings, model: string, conv: Conversation | null): Promise<void> {
  await saveSettings({ ...settings, model });
  if (conv?.noTools) await putConversation({ ...conv, noTools: false });
}
