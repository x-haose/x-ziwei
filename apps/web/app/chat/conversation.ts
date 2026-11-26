import type { ProviderId } from './providers';
import type { ChartFocus } from './tools';

/**
 * 对话的数据形状与纯计算：标题、发给模型的历史与按上下文长度截断。存在本机（见 `store.ts`），不上传。
 */

/** 出错的种类，决定错误块的标题与动作（设计规范 19.8）。`page`：本页自己的缺陷（工具实现或内核内部错误），不是厂商的问题。 */
export type ChatErrorKind = 'auth' | 'rate' | 'network' | 'tools' | 'other' | 'page';

/** `status` 为 HTTP 状态码（网络层失败时为 null）；`detail` 为厂商返回的说明原文（没有时为 null）。 */
export interface ChatError {
  kind: ChatErrorKind;
  status: number | null;
  detail: string | null;
}

/** 一次工具调用。`ms` 为耗时（毫秒），查询中或没查时为 null。`failed`：入参不对或内核报错，错误已返回给模型。 */
export interface ToolCallRecord {
  id: string;
  name: string;
  label: string;
  scope: string;
  focus: ChartFocus | null;
  state: 'running' | 'done' | 'failed' | 'skipped';
  ms: number | null;
}

export interface UserMessage {
  id: string;
  role: 'user';
  text: string;
  /** 发问时页面上的上下文行（生辰、看的层与宫），随问题一起发给模型。 */
  context: string;
  at: number;
}

export interface AssistantMessage {
  id: string;
  role: 'assistant';
  provider: ProviderId;
  /** 服务显示名与模型名，写在回答下方。 */
  service: string;
  model: string;
  /** 回答的 Markdown 原文。 */
  text: string;
  calls: ToolCallRecord[];
  /** `streaming` 只出现在内存里；存进本机的是结束后的状态。 */
  status: 'streaming' | 'done' | 'stopped' | 'error';
  error: ChatError | null;
  at: number;
}

export type ChatMessage = UserMessage | AssistantMessage;

export interface Conversation {
  id: string;
  /** 第一问的前 24 字。 */
  title: string;
  /** 所属盘：地址 `#` 之后的生辰参数（不含 `#`）。 */
  chart: string;
  /** 生辰的显示写法（「2000-8-16 寅时 女」），列在记录里。 */
  birth: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  /** 不用工具继续（设计规范 19.10）：盘面以文本附在每次提问前。换模型后退出。 */
  noTools: boolean;
}

/** 标题取第一问的前 24 字（按字计，不拆代理对）。 */
export function titleOf(question: string): string {
  return [...question.trim().replace(/\s+/g, ' ')].slice(0, 24).join('');
}

/** 发给模型的一条消息（纯文本）。 */
export interface ModelTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** 用户消息发给模型时的写法：上下文行在前，问题在后。 */
export function userContent(m: Pick<UserMessage, 'context' | 'text'>): string {
  return `<page>${m.context}</page>\n\n${m.text}`;
}

/**
 * token 数的粗估：中日韩文字与全角符号按 1 个，其余字符按 1/4 个。各家分词不同，只用来决定截断，宁多勿少。
 */
export function estimateTokens(text: string): number {
  let wide = 0;
  let narrow = 0;
  for (const ch of text) {
    if (/[⺀-鿿가-힯豈-﫿＀-￯]/.test(ch)) wide++;
    else narrow++;
  }
  return wide + Math.ceil(narrow / 4);
}

/** 列表接口没给上下文长度时按这么长估（token）。 */
export const DEFAULT_CONTEXT = 64_000;
/** 留给回答与本轮工具结果的余量（token）。 */
export const RESERVE = 24_000;

/**
 * 发给模型的历史：`turns` 依次是要发的消息，`firstSent` 是存着的消息里第一条仍会发送的下标（之前的都不再发，
 * 界面在它前面画分隔线），`dropped` 是因此不再发送的条数。
 *
 * - 只发文本：用户消息带上下文行；回答只发正文，查过的工具结果不重发（模型需要时再查）。
 * - 出错的回答连同它的问题都不发；没有正文的回答（停止得太早）不发。最后一问总是发。
 * - 估算的长度超过 `budget` 时从最早的消息起不再发送，最后一问除外。没有截断时 `firstSent`、`dropped` 为 0。
 */
export function modelHistory(messages: readonly ChatMessage[], budget: number): { turns: ModelTurn[]; firstSent: number; dropped: number } {
  const keep: { index: number; turn: ModelTurn }[] = [];
  messages.forEach((m, i) => {
    const last = i === messages.length - 1;
    if (m.role === 'user') {
      const answer = messages[i + 1];
      if (!last && answer?.role === 'assistant' && answer.status === 'error') return;
      keep.push({ index: i, turn: { role: 'user', content: userContent(m) } });
    } else if (m.status !== 'error' && m.text.trim() !== '') {
      keep.push({ index: i, turn: { role: 'assistant', content: m.text } });
    }
  });
  let total = keep.reduce((n, k) => n + estimateTokens(k.turn.content), 0);
  let start = 0;
  while (total > budget && start < keep.length - 1) {
    total -= estimateTokens(keep[start]!.turn.content);
    start++;
  }
  // 不以回答开头：截掉的若停在一问一答中间，连那条回答也不发。
  while (start < keep.length - 1 && keep[start]!.turn.role === 'assistant') start++;
  const sent = keep.slice(start);
  // 没有截断时（含只是略过了出错的问答）不画分隔线。
  const firstSent = start > 0 ? (sent[0]?.index ?? 0) : 0;
  return { turns: sent.map((k) => k.turn), firstSent, dropped: firstSent };
}

/** 本机存储里不该出现的生成中状态（标签页在生成中被关掉）：读出时按「已停止」处理，没查的工具记为未查。 */
export function settled(c: Conversation): Conversation {
  if (!c.messages.some((m) => m.role === 'assistant' && m.status === 'streaming')) return c;
  return {
    ...c,
    messages: c.messages.map((m) =>
      m.role === 'assistant' && m.status === 'streaming'
        ? { ...m, status: 'stopped', calls: m.calls.map((x) => (x.state === 'running' ? { ...x, state: 'skipped', ms: null } : x)) }
        : m,
    ),
  };
}
