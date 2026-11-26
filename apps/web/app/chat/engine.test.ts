import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as kernel from 'x-iztro';
import { type FakeVendor, startFakeVendor } from '../../e2e/fake-vendor';
import { MESSAGES } from '../i18n/messages';
import type { AssistantMessage } from './conversation';
import { runTurn } from './engine';
import type { ChatSettings } from './providers';
import type { ToolContext } from './tools';

let vendor: FakeVendor;
let ctx: ToolContext;

beforeAll(async () => {
  await kernel.init();
  ctx = { kernel, chart: kernel.astro.bySolar('2000-8-16', 2, 'female'), pack: kernel.KnowledgePack.builtin(), packSource: 'iztro-docs' };
  vendor = await startFakeVendor();
});

afterAll(() => vendor.close());

const settings = (over: Partial<ChatSettings> = {}): ChatSettings => ({
  provider: 'compatible',
  key: 'sk-good',
  baseURL: vendor.url,
  model: 'deepseek-flash',
  models: [],
  ...over,
});

const base: AssistantMessage = { id: 'a', role: 'assistant', provider: 'compatible', service: 's', model: 'm', text: '', calls: [], status: 'streaming', error: null, at: 0 };

function turn(question: string, opts: { tools?: boolean; signal?: AbortSignal; s?: Partial<ChatSettings> } = {}) {
  const updates: AssistantMessage[] = [];
  const done = runTurn({
    settings: settings(opts.s),
    system: 'sys',
    turns: [{ role: 'user', content: question }],
    tools: opts.tools === false ? null : { ctx, t: MESSAGES.zh },
    signal: opts.signal ?? new AbortController().signal,
    base,
    onUpdate: (m) => updates.push(m),
  });
  return { done, updates };
}

describe('一轮回答（真实 HTTP 与 SSE）', () => {
  it('先在浏览器里查盘，再流式回答；工具结果发回给模型', async () => {
    const before = vendor.requests.length;
    const { done, updates } = turn('今年适合换工作吗');
    const m = await done;
    expect(m.status).toBe('done');
    expect(m.text).toBe('能动，但更适合在现在的专业里往上走一步。\n\n今年流年命宫落在午，自己拿主意的力量很足。');
    expect(m.calls).toHaveLength(1);
    expect(m.calls[0]).toMatchObject({ name: 'ziwei_get_horoscope', label: '2026 年运限', state: 'done', focus: { kind: 'year', year: 2026 } });
    expect(m.calls[0]!.ms).toBeGreaterThanOrEqual(0);
    expect(updates.some((u) => u.calls[0]?.state === 'running')).toBe(true);
    const second = vendor.requests.slice(before)[1]!.body as { messages: { role: string; content: string }[] };
    const result = second.messages.find((x) => x.role === 'tool')!;
    expect(result.content).toBe(`${ctx.chart.horoscopeOfYear(2026).toText()}\n${ctx.chart.monthlyListToText(2026)}`);
  });

  it('无工具模式不带工具', async () => {
    const before = vendor.requests.length;
    const m = await turn('今年怎样', { tools: false }).done;
    expect(m.status).toBe('done');
    expect(m.calls).toEqual([]);
    expect((vendor.requests[before]!.body as { tools?: unknown }).tools).toBeUndefined();
  });

  it('厂商拒绝：401、429、不支持工具调用、5xx 各归其类，说明原文保留', async () => {
    expect((await turn('[401]').done).error).toMatchObject({ kind: 'auth', status: 401 });
    expect((await turn('[429]').done).error).toMatchObject({ kind: 'rate', status: 429, detail: 'Rate limit reached for requests' });
    expect((await turn('[notools]').done).error).toMatchObject({ kind: 'tools', status: 400 });
    expect((await turn('[500]').done).error).toMatchObject({ kind: 'other', status: 500, detail: 'The server had an error while processing your request' });
  });

  it('连不上时报 network；列表接口能问到 401 时改判为 Key 无效', async () => {
    const down = await turn('你好', { s: { baseURL: 'http://127.0.0.1:1' } }).done;
    expect(down.error).toMatchObject({ kind: 'network', status: null });
    const hidden = await turn('[drop]', { s: { key: 'sk-hidden401' } }).done;
    expect(hidden.error).toMatchObject({ kind: 'auth', status: 401, detail: 'Incorrect API key provided' });
  });

  it('中途停止：保留已生成的部分，标为已停止', async () => {
    const abort = new AbortController();
    const { done, updates } = turn('[slow][plain]', { signal: abort.signal });
    while (!updates.some((u) => u.text.length > 0)) await new Promise((r) => setTimeout(r, 20));
    abort.abort();
    const m = await done;
    expect(m.status).toBe('stopped');
    expect(m.text.startsWith('第 1 段。')).toBe(true);
    expect(m.text).not.toContain('第 30 段');
  });
});
