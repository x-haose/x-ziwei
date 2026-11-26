import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import * as kernel from 'x-iztro';
import { MESSAGES } from '../i18n/messages';
import { type AssistantMessage, type ChatMessage, type Conversation, estimateTokens, modelHistory, settled, shorterFrom, titleOf } from './conversation';
import { classify, contextExceeded, kindOf, toolsUnsupported } from './errors';
import { checkBaseUrl, defaultModel, maskKey, parseModels } from './providers';
import { TOOLS, type ToolContext, clockToTimeIndex, describeCall, parseTarget } from './tools';

const t = MESSAGES.zh;
let ctx: ToolContext;

beforeAll(async () => {
  await kernel.init();
  const chart = kernel.astro.bySolar('2000-8-16', 2, 'female');
  ctx = { kernel, chart, pack: kernel.KnowledgePack.builtin(), packSource: 'iztro-docs' };
});

const run = (name: string, input: Record<string, unknown>) => TOOLS.find((s) => s.name === name)!.run(input, ctx);

describe('工具', () => {
  it('本命、运限、大限、流年一览返回内核的语义化文本', () => {
    expect(run('ziwei_get_natal_chart', {})).toBe(ctx.chart.toText());
    expect(run('ziwei_get_natal_chart', { knowledge: 'summary' })).toBe(ctx.chart.toText({ knowledge: ctx.pack, knowledgeDepth: 'summary' }));
    expect(run('ziwei_get_horoscope', { target: { year: 2026 } })).toBe(`${ctx.chart.horoscopeOfYear(2026).toText()}\n${ctx.chart.monthlyListToText(2026)}`);
    expect(run('ziwei_get_horoscope', { target: { year: 2026, month: 7 } })).toBe(ctx.chart.horoscopeOfMonth(2026, 7).toText());
    expect(run('ziwei_get_horoscope', { target: { date: '2026-8-16', clock: '23:10' } })).toBe(ctx.chart.horoscope('2026-8-16', 12).toText());
    expect(run('ziwei_get_decadal_overview', {})).toBe(ctx.chart.decadalListToText());
    expect(run('ziwei_get_yearly_overview', { from_year: 2026, to_year: 2030 })).toBe(ctx.chart.yearlyOverviewToText(2026, 2030));
    expect(run('ziwei_get_topic_palaces', { topic: 'career' })).toBe(ctx.chart.topicToText('career', { knowledge: ctx.pack, knowledgeDepth: 'summary' }));
  });

  it('运限与服务端同目标的返回逐字一致（年、年加月、日期、日期加时辰）', () => {
    // 金标是服务端（x-iztro 0.9.0）的 POST /v1/horoscope 对同一生辰的返回，运限文本 0.9 与 0.10 相同，生成方式见 tests/fixtures/horoscope/README.md。
    const golden = (name: string) => readFileSync(new URL(`../../../../tests/fixtures/horoscope/${name}.md`, import.meta.url), 'utf8');
    expect(run('ziwei_get_horoscope', { target: { year: 2026 } })).toBe(golden('year'));
    expect(run('ziwei_get_horoscope', { target: { year: 2026, month: 7 } })).toBe(golden('month'));
    expect(run('ziwei_get_horoscope', { target: { date: '2026-11-26' } })).toBe(golden('day'));
    expect(run('ziwei_get_horoscope', { target: { date: '2026-11-26', clock: '23:10' } })).toBe(golden('hour'));
  });

  it('知识包条目与目录按标识取原文，标识不认识时整次失败', () => {
    const found = JSON.parse(run('ziwei_lookup_knowledge', { kind: 'star', keys: ['ziweiMaj'] })) as { entries: { key: string; entry: { name: string } }[] };
    expect(found.entries[0]).toMatchObject({ key: 'ziweiMaj', entry: { name: '紫微' } });
    expect(() => run('ziwei_lookup_knowledge', { kind: 'star', keys: ['紫微'] })).toThrow(/unknown star key/);
    const catalog = JSON.parse(run('ziwei_list_knowledge', { kind: 'topic' })) as { sections: { kind: string; items: { key: string }[] }[] };
    expect(catalog.sections).toHaveLength(1);
    expect(catalog.sections[0]!.items.map((i) => i.key)).toContain('career');
  });

  it('运限目标的规则与服务端一致', () => {
    expect(parseTarget({ year: 2027 })).toEqual({ kind: 'year', year: 2027 });
    expect(parseTarget({ date: '2026-8-16', time_index: 2 })).toEqual({ kind: 'hour', date: '2026-8-16', hour: 2 });
    for (const bad of [{}, { year: 2027, date: '2026-8-16' }, { date: '2026-8-16', month: 3 }, { year: 2027, clock: '10:00' }, { date: '2026-8-16', time_index: 3, clock: '23:00' }]) {
      expect(() => parseTarget(bad)).toThrow();
    }
    expect([0, 1, 2, 3, 22, 23].map((h) => clockToTimeIndex(`${h}:30`))).toEqual([0, 1, 1, 2, 11, 12]);
  });

  it('流年一览最多 20 年', () => {
    expect(() => run('ziwei_get_yearly_overview', { from_year: 2020, to_year: 2040 })).toThrow(/at most 20/);
  });

  it('界面写法：显示名、范围与「在盘上看」的位置', () => {
    const natal = describeCall('ziwei_get_natal_chart', {}, ctx, t);
    expect(natal).toMatchObject({ label: '本命盘', focus: { kind: 'palace', palace: ctx.chart.palace('soulPalace')!.index } });
    const year = describeCall('ziwei_get_horoscope', { target: { year: 2026 } }, ctx, t);
    expect(year.label).toBe('2026 年运限');
    expect(year.scope).toMatch(/^大限（..，\d+–\d+ 岁）、流年（丙午）、各月$/);
    expect(year.focus).toEqual({ kind: 'year', year: 2026 });
    const topic = describeCall('ziwei_get_topic_palaces', { topic: 'career' }, ctx, t);
    expect(topic.label).toMatch(/^主题选宫：/);
    expect(topic.focus).toEqual({ kind: 'palace', palace: ctx.chart.palace('careerPalace')!.index });
    expect(describeCall('ziwei_lookup_knowledge', { kind: 'star', keys: ['ziweiMaj', 'wenquMin'] }, ctx, t).label).toBe('知识包条目：紫微、文曲');
  });

  it('模型给错入参或调了不存在的工具时，写成显示名而不报错', () => {
    expect(describeCall('ziwei_get_horoscope', { target: { date: '2026-2-30' } }, ctx, t)).toEqual({ label: '运限', scope: '', focus: null });
    expect(describeCall('no_such_tool', {}, ctx, t)).toEqual({ label: 'no_such_tool', scope: '', focus: null });
  });
});

const user = (id: string, text: string): ChatMessage => ({ id, role: 'user', text, context: '2000-8-16 寅时 女，看的是本命、命宫。', at: 0 });
const answer = (id: string, text: string, status: AssistantMessage['status'] = 'done'): ChatMessage => ({
  id,
  role: 'assistant',
  provider: 'deepseek',
  service: 'DeepSeek',
  model: 'm',
  text,
  calls: [],
  status,
  error: status === 'error' ? { kind: 'rate', status: 429, detail: null } : null,
  at: 0,
});

describe('发给模型的历史', () => {
  it('问题带上下文行；出错的问答与没有正文的回答不发；最后一问总是发', () => {
    const msgs = [user('1', '甲'), answer('2', '', 'error'), user('3', '乙'), answer('4', '回答乙'), user('5', '丙'), answer('6', '', 'stopped'), user('7', '丁')];
    const h = modelHistory(msgs, 1e9);
    expect(h.turns.map((x) => x.role)).toEqual(['user', 'assistant', 'user', 'user']);
    expect(h.turns[0]!.content).toBe('<page>2000-8-16 寅时 女，看的是本命、命宫。</page>\n\n乙');
    expect(h.dropped).toBe(0);
  });

  it('超过预算时从最早的消息起不再发送，不以回答开头', () => {
    const long = '紫'.repeat(1000);
    const msgs = [user('1', long), answer('2', long), user('3', long), answer('4', long), user('5', '最后一问')];
    const h = modelHistory(msgs, 2200);
    expect(h.firstSent).toBe(2);
    expect(h.dropped).toBe(2);
    expect(h.turns[0]!.role).toBe('user');
    expect(h.turns.at(-1)!.content).toMatch(/最后一问$/);
  });

  it('sendFrom 之前的不发；「较早的消息不再发」从仍发送的问题的中间一问起，只剩一问时没有可少发的', () => {
    const msgs = [user('1', '甲'), answer('2', '答甲'), user('3', '乙'), answer('4', '答乙'), user('5', '丙'), answer('6', '答丙'), user('7', '丁')];
    expect(modelHistory(msgs, 1e9, 4)).toMatchObject({ firstSent: 4, dropped: 4 });
    expect(shorterFrom(msgs, 1e9, 0)).toBe(4);
    expect(shorterFrom(msgs, 1e9, 4)).toBe(6);
    expect(shorterFrom(msgs, 1e9, 6)).toBeNull();
  });

  it('粗估 token：汉字按 1 个，其余 4 个字符 1 个', () => {
    expect(estimateTokens('紫微abcd')).toBe(3);
  });

  it('标题取第一问的前 24 字', () => {
    expect(titleOf('  今年适合\n换工作吗')).toBe('今年适合 换工作吗');
    expect([...titleOf('字'.repeat(30))]).toHaveLength(24);
  });

  it('存着的生成中状态读出时按已停止处理', () => {
    const c: Conversation = {
      id: 'c',
      title: 'x',
      chart: 'cal=solar',
      birth: '',
      createdAt: 0,
      updatedAt: 0,
      noTools: false,
      messages: [
        user('1', '甲'),
        { ...(answer('2', '一半', 'streaming') as AssistantMessage), calls: [{ id: 'k', name: 'n', label: 'l', scope: '', focus: null, state: 'running', ms: null }] },
      ],
    };
    const s = settled(c).messages[1] as AssistantMessage;
    expect(s.status).toBe('stopped');
    expect(s.calls[0]!.state).toBe('skipped');
  });
});

describe('错误分类', () => {
  it('按状态码分：401/403 Key、429 限流、不支持工具调用、其余', () => {
    expect(kindOf(401, null)).toBe('auth');
    expect(kindOf(403, null)).toBe('auth');
    expect(kindOf(429, null)).toBe('rate');
    expect(kindOf(400, 'This model does not support tools')).toBe('tools');
    expect(kindOf(404, 'tools is not supported for this model')).toBe('tools');
    expect(kindOf(400, 'Function calling is not enabled for this model')).toBe('tools');
    expect(kindOf(400, 'messages: field required')).toBe('other');
    expect(kindOf(503, null)).toBe('other');
    expect(kindOf(null, null)).toBe('network');
    expect(toolsUnsupported('model does not support function calling')).toBe(true);
    expect(kindOf(400, "This model's maximum context length is 131072 tokens. However, you requested 140000 tokens.")).toBe('context');
    expect(kindOf(400, 'prompt is too long: 210000 tokens > 200000 maximum')).toBe('context');
    expect(kindOf(400, 'input length and `max_tokens` exceed context limit: 190000 + 32000 > 200000')).toBe('context');
    expect(contextExceeded('Invalid value for tool_choice')).toBe(false);
  });

  it('厂商错误体里的说明原文；浏览器里的网络失败是 TypeError', () => {
    const apiError = Object.assign(new Error('bad'), { statusCode: 401, responseBody: '{"error":{"message":"Incorrect API key"}}' });
    expect(classify(apiError)).toEqual({ kind: 'auth', status: 401, detail: 'Incorrect API key' });
    expect(classify(new TypeError('Failed to fetch'))).toMatchObject({ kind: 'network', status: null });
    const coded = Object.assign(new Error('bad'), { statusCode: 400, responseBody: '{"error":{"message":"Too long.","code":"context_length_exceeded"}}' });
    expect(classify(coded)).toMatchObject({ kind: 'context', detail: 'Too long.' });
    expect(classify(new Error('stream broke'))).toEqual({ kind: 'other', status: null, detail: 'stream broke' });
  });
});

describe('服务设置', () => {
  it('OpenAI 的列表只留对话模型，按发布时间从新到旧', () => {
    const body = {
      data: [
        { id: 'gpt-old', created: 1 },
        { id: 'text-embedding-3-large', created: 9 },
        { id: 'gpt-new', created: 5 },
        { id: 'gpt-realtime', created: 7 },
        { id: 'o4-mini', created: 3 },
      ],
    };
    expect(parseModels('openai', body).map((m) => m.id)).toEqual(['gpt-new', 'o4-mini', 'gpt-old']);
  });

  it('兼容服务的工具能力待定；上下文长度取列表给的字段', () => {
    const models = parseModels('compatible', { data: [{ id: 'a', context_length: 32000 }, { id: 'b' }] });
    expect(models).toEqual([
      { id: 'a', tools: null, context: 32000 },
      { id: 'b', tools: null, context: null },
    ]);
    expect(defaultModel(models)).toBe('a');
    expect(defaultModel(parseModels('deepseek', { data: [{ id: 'deepseek-flash' }] }))).toBe('deepseek-flash');
    expect(() => parseModels('deepseek', { object: 'list' })).toThrow();
  });

  it('Base URL 必须是 https；Key 只露首尾', () => {
    expect(checkBaseUrl(' https://llm.example.com/v1/ ')).toEqual({ ok: true, url: 'https://llm.example.com/v1' });
    expect(checkBaseUrl('http://localhost:11434/v1')).toEqual({ ok: false, problem: 'notHttps' });
    expect(checkBaseUrl('example')).toEqual({ ok: false, problem: 'invalid' });
    expect(checkBaseUrl('')).toEqual({ ok: false, problem: 'empty' });
    expect(maskKey('sk-1234567890a3f9')).toBe('sk-…a3f9');
  });
});
