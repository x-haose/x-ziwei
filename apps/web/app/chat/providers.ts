/**
 * 对话可选的模型服务。浏览器直接请求厂商（不经本站服务器），Key 只放进发给厂商的请求头。
 *
 * 2026-11-26 实测（假 Key、任意来源）：三家的模型列表与对话接口都放行跨域预检；DeepSeek 的 401 带
 * `Access-Control-Allow-Origin`；OpenAI 的 `GET /v1/models` 的 401 带、`POST` 对话接口的 401 不带（浏览器里表现为网络错误）；
 * Anthropic 只在请求带 `anthropic-dangerous-direct-browser-access: true` 时放行，401 也带。
 */

export type ProviderId = 'deepseek' | 'openai' | 'anthropic' | 'compatible';

export const PROVIDER_IDS: readonly ProviderId[] = ['deepseek', 'openai', 'anthropic', 'compatible'];

export interface ProviderInfo {
  /** 服务名（界面上不翻译）。兼容服务的名字在文案里。 */
  name: string | null;
  /** API 根地址；兼容服务由用户填。 */
  baseURL: string | null;
  /** Key 输入框的占位。 */
  keyHint: string;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  deepseek: { name: 'DeepSeek', baseURL: 'https://api.deepseek.com', keyHint: 'sk-…' },
  openai: { name: 'OpenAI', baseURL: 'https://api.openai.com/v1', keyHint: 'sk-…' },
  anthropic: { name: 'Anthropic', baseURL: 'https://api.anthropic.com/v1', keyHint: 'sk-ant-…' },
  compatible: { name: null, baseURL: null, keyHint: 'sk-…' },
};

/** Anthropic 允许网页直接请求所需的请求头，与它要求的 API 版本。 */
export const ANTHROPIC_BROWSER_HEADERS = { 'anthropic-dangerous-direct-browser-access': 'true', 'anthropic-version': '2023-06-01' } as const;

/** 一个模型。`tools`：能否调用工具，null 为还不知道（兼容服务以第一次请求的结果为准）。`context`：上下文长度（token），列表接口没给时为 null。 */
export interface ModelInfo {
  id: string;
  tools: boolean | null;
  context: number | null;
}

/** 本机存的服务设置：一次只存一个服务的 Key。`model` 为空串表示还没有可用的模型（取列表时被限流等）。 */
export interface ChatSettings {
  provider: ProviderId;
  key: string;
  /** 兼容服务的 Base URL（`https://` 开头，不带末尾斜杠）；其余服务为 null。 */
  baseURL: string | null;
  model: string;
  models: ModelInfo[];
}

/** 实际请求的根地址。 */
export function baseOf(s: { provider: ProviderId; baseURL: string | null }): string {
  const base = s.provider === 'compatible' ? s.baseURL : PROVIDERS[s.provider].baseURL;
  if (!base) throw new Error(`服务 ${s.provider} 没有 Base URL`);
  return base;
}

/** 根地址的主机名，用于「直连 …」与出错说明。 */
export function hostOf(s: { provider: ProviderId; baseURL: string | null }): string {
  return new URL(baseOf(s)).host;
}

/** Base URL 的问题：空、不是网址、不是 https。合规时返回规整后的地址（去掉末尾斜杠）。 */
export type BaseUrlCheck = { ok: true; url: string } | { ok: false; problem: 'empty' | 'invalid' | 'notHttps' };

export function checkBaseUrl(raw: string): BaseUrlCheck {
  const text = raw.trim();
  if (text === '') return { ok: false, problem: 'empty' };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, problem: 'invalid' };
  }
  if (url.protocol !== 'https:') return { ok: false, problem: 'notHttps' };
  return { ok: true, url: text.replace(/\/+$/, '') };
}

/** Key 只露前 3 位与后 4 位（「sk-…a3f9」）。 */
export function maskKey(key: string): string {
  return key.length <= 7 ? '…' : `${key.slice(0, 3)}…${key.slice(-4)}`;
}

/**
 * OpenAI 的模型列表里还有向量、语音、图像、审核等不能对话的模型：只留对话模型（`gpt-`、`o` 系列、`chatgpt-` 开头），
 * 去掉名字里带语音、实时、转写、图像、搜索等用途的。
 */
function openaiChatModel(id: string): boolean {
  return /^(gpt-|o\d|chatgpt-)/.test(id) && !/(audio|realtime|transcribe|tts|image|search|embedding|instruct|moderation)/.test(id);
}

/** 模型列表请求的结果。`status` 为 HTTP 状态码；网络层失败（断网、跨域被拒）时为 null。 */
export type ListResult =
  | { ok: true; models: ModelInfo[] }
  | { ok: false; status: number | null; detail: string | null };

/** 厂商错误体里的说明（OpenAI、DeepSeek、Anthropic 都在 `error.message`）。 */
export function vendorMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const error = (body as { error?: unknown }).error;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && typeof (error as { message?: unknown }).message === 'string') return (error as { message: string }).message;
  const message = (body as { message?: unknown }).message;
  return typeof message === 'string' ? message : null;
}

function numberField(item: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = item[k];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  }
  return null;
}

/** 列表接口的返回 → 模型。顺序：OpenAI 按发布时间从新到旧，其余照接口给的顺序。 */
export function parseModels(provider: ProviderId, body: unknown): ModelInfo[] {
  const data = typeof body === 'object' && body !== null ? (body as { data?: unknown }).data : undefined;
  if (!Array.isArray(data)) throw new Error('模型列表接口的返回里没有 data 数组');
  const items = data.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null && typeof x.id === 'string');
  const chosen =
    provider === 'openai'
      ? items.filter((x) => openaiChatModel(x.id as string)).sort((a, b) => (Number(b.created) || 0) - (Number(a.created) || 0))
      : items;
  return chosen.map((x) => ({
    id: x.id as string,
    tools: provider === 'compatible' ? null : true,
    context: numberField(x, ['context_length', 'context_window', 'max_input_tokens', 'max_context_length']),
  }));
}

/** 请求模型列表（检查 Key 也用它）。只在浏览器里调用。 */
export async function listModels(s: { provider: ProviderId; key: string; baseURL: string | null }, signal?: AbortSignal): Promise<ListResult> {
  const base = baseOf(s);
  const url = s.provider === 'anthropic' ? `${base}/models?limit=1000` : `${base}/models`;
  const headers: Record<string, string> =
    s.provider === 'anthropic' ? { 'x-api-key': s.key, ...ANTHROPIC_BROWSER_HEADERS } : { authorization: `Bearer ${s.key}` };
  let res: Response;
  try {
    res = await fetch(url, { headers, signal, credentials: 'omit' });
  } catch (err) {
    if (signal?.aborted) throw err;
    return { ok: false, status: null, detail: err instanceof Error ? err.message : String(err) };
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  if (!res.ok) return { ok: false, status: res.status, detail: vendorMessage(body) ?? (text.slice(0, 300) || null) };
  try {
    return { ok: true, models: parseModels(s.provider, body) };
  } catch (err) {
    return { ok: false, status: res.status, detail: err instanceof Error ? err.message : String(err) };
  }
}

/** 检查通过时默认选的模型：第一个支持工具调用的；兼容服务还不知道，取第一个。 */
export function defaultModel(models: readonly ModelInfo[]): string {
  return (models.find((m) => m.tools === true) ?? models[0])?.id ?? '';
}
