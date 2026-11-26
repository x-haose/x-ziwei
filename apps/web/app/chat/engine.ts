import { InvalidToolInputError, type LanguageModel, NoSuchToolError, type ToolSet, jsonSchema, stepCountIs, streamText, tool } from 'ai';
import type { Messages } from '../i18n/messages';
import type { AssistantMessage, ChatError, ModelTurn } from './conversation';
import { classify, kindOf } from './errors';
import { ANTHROPIC_BROWSER_HEADERS, type ChatSettings, baseOf, listModels } from './providers';
import { TOOLS, type ToolContext, describeCall, isInputError } from './tools';

/**
 * 一轮回答：用 AI SDK 7 直连所选厂商，模型要查盘时在浏览器里执行工具，流式更新回答。
 * 只在发问时按需加载（AI SDK 与各厂商的适配不进排盘页的首屏代码）。
 */

/** 一轮里最多的模型调用次数（含查工具之后的继续生成）。 */
const MAX_STEPS = 10;

/**
 * 按设置建模型，只加载所选厂商的适配。OpenAI 走 Chat Completions（与 DeepSeek、兼容服务同一种协议）；
 * Anthropic 加上允许网页直接请求的请求头。
 */
export async function languageModel(s: ChatSettings): Promise<LanguageModel> {
  switch (s.provider) {
    case 'deepseek':
      return (await import('@ai-sdk/deepseek')).createDeepSeek({ apiKey: s.key }).chat(s.model);
    case 'openai':
      return (await import('@ai-sdk/openai')).createOpenAI({ apiKey: s.key }).chat(s.model);
    case 'anthropic':
      return (await import('@ai-sdk/anthropic')).createAnthropic({
        apiKey: s.key,
        headers: { 'anthropic-dangerous-direct-browser-access': ANTHROPIC_BROWSER_HEADERS['anthropic-dangerous-direct-browser-access'] },
      })(s.model);
    case 'compatible':
      return (await import('@ai-sdk/openai-compatible')).createOpenAICompatible({ name: 'compatible', baseURL: baseOf(s), apiKey: s.key })(s.model);
  }
}

/** 本页自己的缺陷（工具实现或内核内部错误），不是厂商的问题。 */
export class TurnFault extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name = 'TurnFault';
  }
}

function toolSet(ctx: ToolContext): ToolSet {
  return Object.fromEntries(
    TOOLS.map((spec) => [
      spec.name,
      tool({
        description: spec.description,
        inputSchema: jsonSchema<Record<string, unknown>>(spec.parameters),
        execute: async (input: Record<string, unknown>) => spec.run(input, ctx),
      }),
    ]),
  );
}

/**
 * 网络层失败时，用模型列表接口再问一次：有的厂商对话接口的 401 / 429 响应不带跨域头，浏览器里只看得到网络错误，
 * 而列表接口的同样响应带（OpenAI 即如此）。问到 401 / 403 / 429 就按它归类，否则仍是连不上。
 */
async function refine(error: ChatError, s: ChatSettings): Promise<ChatError> {
  if (error.kind !== 'network') return error;
  const probe = await listModels(s);
  if (probe.ok || probe.status === null) return error;
  const kind = kindOf(probe.status, probe.detail);
  return kind === 'auth' || kind === 'rate' ? { kind, status: probe.status, detail: probe.detail } : error;
}

export interface TurnInput {
  settings: ChatSettings;
  system: string;
  turns: ModelTurn[];
  /** 可调的工具与写工具记录用的文案；无工具模式为 null。 */
  tools: { ctx: ToolContext; t: Messages } | null;
  signal: AbortSignal;
  /** 这条回答的初始状态（id、服务、模型等，正文与工具记录为空）。 */
  base: AssistantMessage;
  onUpdate: (m: AssistantMessage) => void;
}

/**
 * 跑一轮回答，返回结束时的回答：完成为 `done`；中途停止为 `stopped`（已生成的部分保留，没查的工具记为未查）；
 * 厂商拒绝或连不上为 `error`。本页自己的缺陷抛 `TurnFault`。
 */
export async function runTurn(input: TurnInput): Promise<AssistantMessage> {
  const { settings, tools, signal } = input;
  let msg: AssistantMessage = { ...input.base, status: 'streaming', text: '', calls: [], error: null };
  const started = new Map<string, number>();
  let newBlock = false;
  const update = (next: AssistantMessage) => {
    msg = next;
    input.onUpdate(msg);
  };
  const stop = (): AssistantMessage => ({
    ...msg,
    status: 'stopped',
    calls: msg.calls.map((c) => (c.state === 'running' ? { ...c, state: 'skipped', ms: null } : c)),
  });
  const finishCall = (id: string, state: 'done' | 'failed') => {
    const t0 = started.get(id);
    update({ ...msg, calls: msg.calls.map((c) => (c.id === id ? { ...c, state, ms: t0 === undefined ? null : Math.round(performance.now() - t0) } : c)) });
  };

  const result = streamText({
    model: await languageModel(settings),
    instructions: input.system,
    messages: input.turns,
    ...(tools ? { tools: toolSet(tools.ctx), stopWhen: stepCountIs(MAX_STEPS) } : {}),
    maxRetries: 0,
    abortSignal: signal,
  });

  try {
    for await (const part of result.stream) {
      switch (part.type) {
        case 'text-start':
          newBlock = msg.text.trim() !== '';
          break;
        case 'text-delta':
          update({ ...msg, text: msg.text + (newBlock ? '\n\n' : '') + part.text });
          newBlock = false;
          break;
        case 'tool-call': {
          if (!tools) break;
          const view = describeCall(part.toolName, part.input as Record<string, unknown>, tools.ctx, tools.t);
          started.set(part.toolCallId, performance.now());
          update({ ...msg, calls: [...msg.calls, { id: part.toolCallId, name: part.toolName, ...view, state: 'running', ms: null }] });
          break;
        }
        case 'tool-result':
          finishCall(part.toolCallId, 'done');
          break;
        case 'tool-error': {
          // 模型调错了（没有这个工具、入参不对）：错误已作为工具结果交还模型，它会改了再调；其余是本页的缺陷，整轮中止。
          const e = part.error;
          const fromModel = NoSuchToolError.isInstance(e) || InvalidToolInputError.isInstance(e) || (tools !== null && isInputError(e, tools.ctx.kernel));
          if (!fromModel) throw new TurnFault(e);
          finishCall(part.toolCallId, 'failed');
          break;
        }
        case 'error':
          update({ ...msg, status: 'error', error: await refine(classify(part.error), settings) });
          return msg;
        case 'abort':
          update(stop());
          return msg;
        case 'finish':
          update({ ...msg, status: 'done' });
          return msg;
        default:
          break;
      }
    }
  } catch (err) {
    if (err instanceof TurnFault) throw err;
    if (signal.aborted) {
      update(stop());
      return msg;
    }
    update({ ...msg, status: 'error', error: await refine(classify(err), settings) });
    return msg;
  }
  update(signal.aborted ? stop() : { ...msg, status: 'done' });
  return msg;
}
