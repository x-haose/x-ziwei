import type { Astrolabe, KnowledgePack, TimeIndex } from 'x-iztro';
import { fmt, type Messages } from '../i18n/messages';
import type { Kernel } from '../kernel/kernel';

/**
 * 对话里模型可调的工具：都在浏览器里用排盘内核查当前这张盘，释义用本机生效的知识包组合。
 * 名称、说明与入参对齐插件的 MCP 工具（服务端 `src/mcp.rs`、`src/service.rs`），只是不收生辰：盘就是页面上这张。
 * 结果是内核的语义化文本（与 MCP 工具返回的是同一种 Markdown），或知识包条目的 JSON。
 */

/** 工具运行所需：内核、这张盘、生效的知识包与它的出处（如「iztro-docs 2026-08-19 + my-notes 1」）。 */
export interface ToolContext {
  kernel: Kernel;
  chart: Astrolabe;
  pack: KnowledgePack;
  packSource: string;
}

/** 「在盘上看」：选中一宫（当前运限层不变），或换到某个流年 / 流月并选中该层命宫。 */
export type ChartFocus = { kind: 'palace'; palace: number } | { kind: 'year'; year: number } | { kind: 'month'; year: number; month: number };

/** 一次调用在界面上的写法：显示名、查询范围、可在盘上看的位置。 */
export interface CallView {
  label: string;
  scope: string;
  focus: ChartFocus | null;
}

/** 工具入参不合规则：原因写给模型看，它据此改参数重试。 */
export class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolInputError';
  }
}

type Json = Record<string, unknown>;

export interface ToolSpec {
  name: string;
  description: string;
  /** 入参的 JSON Schema（对象）。 */
  parameters: Json;
  run(input: Json, ctx: ToolContext): string;
  view(input: Json, ctx: ToolContext, t: Messages): CallView;
}

/** 单次查询最多的标识个数；流年一览一次最多的年数。与服务端一致。 */
const MAX_LOOKUP_KEYS = 20;
const MAX_OVERVIEW_YEARS = 20;

const KINDS = ['star', 'pattern', 'palace', 'mutagen', 'concept', 'topic'] as const;
type Kind = (typeof KINDS)[number];
/** 知识包 JSON 里各段的键。 */
const SECTION: Record<Kind, string> = { star: 'stars', pattern: 'patterns', palace: 'palaces', mutagen: 'mutagens', concept: 'concepts', topic: 'topics' };

const DETAIL = { type: 'string', enum: ['full', 'overview'], description: '事实详略：`full`（默认）或 `overview`。' };
const KNOWLEDGE = { type: 'string', enum: ['summary', 'full'], description: '是否附知识包释义：`summary` 或 `full`。省略则只返回事实。' };

function opt<T extends string>(input: Json, key: string, allowed: readonly T[]): T | undefined {
  const v = input[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) throw new ToolInputError(`${key} must be one of ${allowed.join(' / ')}`);
  return v as T;
}

function int(input: Json, key: string, min: number, max: number): number | undefined {
  const v = input[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new ToolInputError(`${key} must be an integer in ${min}–${max}`);
  return v;
}

function textOptions(input: Json, ctx: ToolContext) {
  const detail = opt(input, 'detail', ['full', 'overview'] as const);
  const depth = opt(input, 'knowledge', ['summary', 'full'] as const);
  return { ...(detail ? { detail } : {}), ...(depth ? { knowledge: ctx.pack, knowledgeDepth: depth } : {}) };
}

/** 钟点 `HH:MM` 所在的时辰序号：23 点为晚子 12。 */
export function clockToTimeIndex(clock: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(clock);
  const h = m ? Number(m[1]) : NaN;
  const min = m ? Number(m[2]) : NaN;
  if (!(h >= 0 && h <= 23 && min >= 0 && min <= 59)) throw new ToolInputError(`clock must be HH:MM in 00:00–23:59, got ${clock}`);
  return h === 0 ? 0 : h === 23 ? 12 : Math.floor((h + 1) / 2);
}

/** 运限目标：农历年、农历年加月、公历日、公历日加时辰。规则同服务端 `TargetRequest::parse`。 */
export type Target =
  | { kind: 'year'; year: number }
  | { kind: 'month'; year: number; month: number }
  | { kind: 'day'; date: string }
  | { kind: 'hour'; date: string; hour: number };

export function parseTarget(raw: unknown): Target {
  if (typeof raw !== 'object' || raw === null) throw new ToolInputError('target is required');
  const t = raw as Json;
  const year = int(t, 'year', 1, 9999);
  const month = int(t, 'month', 1, 12);
  const date = t.date === undefined || t.date === null ? undefined : t.date;
  if (date !== undefined && (typeof date !== 'string' || !/^\d{1,4}-\d{1,2}-\d{1,2}$/.test(date))) throw new ToolInputError('target.date must be YYYY-M-D');
  const index = int(t, 'time_index', 0, 12);
  const clock = t.clock === undefined || t.clock === null ? undefined : t.clock;
  if (clock !== undefined && typeof clock !== 'string') throw new ToolInputError('target.clock must be HH:MM');
  if ((year === undefined) === (date === undefined)) throw new ToolInputError('give exactly one of target.year and target.date');
  if (year !== undefined) {
    if (index !== undefined || clock !== undefined) throw new ToolInputError('target.time_index and target.clock go with target.date, not target.year');
    return month === undefined ? { kind: 'year', year } : { kind: 'month', year, month };
  }
  if (month !== undefined) throw new ToolInputError('target.month goes with target.year, not target.date');
  const fromClock = clock === undefined ? undefined : clockToTimeIndex(clock);
  if (index !== undefined && fromClock !== undefined && index !== fromClock) {
    throw new ToolInputError(`target.time_index ${index} and target.clock ${clock} point to different hours`);
  }
  const hour = index ?? fromClock;
  return hour === undefined ? { kind: 'day', date: date! } : { kind: 'hour', date: date!, hour };
}

function packEntries(pack: KnowledgePack, kind: Kind): Record<string, Json> {
  const section = pack.toJSON()[SECTION[kind]];
  return typeof section === 'object' && section !== null ? (section as Record<string, Json>) : {};
}

function entryName(entry: Json | undefined): string | undefined {
  const n = entry?.name ?? entry?.title;
  return typeof n === 'string' ? n : undefined;
}

function kindOf(input: Json): Kind {
  const k = opt(input, 'kind', KINDS);
  if (!k) throw new ToolInputError(`kind is required: ${KINDS.join(' / ')}`);
  return k;
}

function keysOf(input: Json): string[] {
  const keys = input.keys;
  if (!Array.isArray(keys) || keys.length < 1 || keys.length > MAX_LOOKUP_KEYS || !keys.every((k) => typeof k === 'string')) {
    throw new ToolInputError(`keys must hold 1 to ${MAX_LOOKUP_KEYS} identifiers`);
  }
  return keys as string[];
}

function topicOf(input: Json, pack: KnowledgePack) {
  const slug = input.topic;
  if (typeof slug !== 'string' || slug === '') throw new ToolInputError('topic is required');
  const topic = pack.topic(slug);
  if (!topic) throw new ToolInputError(`pack \`${pack.id}\` has no topic \`${slug}\`; it defines: ${pack.topics().map((x) => x.slug).join(', ')}`);
  return topic;
}

/** 这张盘的命宫宫位索引。 */
function soulIndex(chart: Astrolabe): number {
  const soul = chart.palace('soulPalace');
  if (!soul) throw new Error('盘上没有命宫');
  return soul.index;
}

const gz = (item: { heavenlyStem: string; earthlyBranch: string }) => `${item.heavenlyStem}${item.earthlyBranch}`;

export const TOOLS: readonly ToolSpec[] = [
  {
    name: 'ziwei_get_natal_chart',
    description:
      '这张盘的紫微斗数本命盘。返回 Markdown 盘面事实：基本信息、十二宫（主星与亮度、辅星、杂耀、生年四化、三方四正、宫干飞化、十二神、大限）、命中的格局。detail=overview 只给总览表与格局。knowledge=summary/full 时在各宫与格局后附知识包释义，省略则只有事实。结果由 x-iztro 计算，不含解读结论。',
    parameters: { type: 'object', properties: { detail: DETAIL, knowledge: KNOWLEDGE }, additionalProperties: false },
    run: (input, ctx) => ctx.chart.toText(textOptions(input, ctx)),
    view: (input, ctx, t) => ({
      label: t.chat.tools.natal,
      scope: opt(input, 'detail', ['full', 'overview'] as const) === 'overview' ? t.chat.tools.natalOverview : t.chat.tools.natalScope,
      focus: { kind: 'palace', palace: soulIndex(ctx.chart) },
    }),
  },
  {
    name: 'ziwei_get_horoscope',
    description:
      '这张盘的紫微斗数运限。给定运限目标，返回 Markdown：各层的宫名对照、四化落宫、流耀与行运格局。目标按用户怎么问来给，问到哪一层就答到哪一层，不要比用户问得更细。问某一年（今年、明年、2027 年）：只给 target.year，返回大限、小限、流年和全年各流月一览（每月一行，带阳历起止日）。target.year 是农历年，用公历年份数字表示（2027 指 2027 年正月初一起的丁未年）；不要改填该年 1 月 1 日，春节前的日子仍属上一个农历年。问某个月：流月按农历月起，target.month 是农历月 1–12，比公历月晚三到七周，不要把公历月份直接填进去。用户说农历几月时给 target.year 加 target.month；说「这个月」「下个月」或公历几月时，给 target.date 为那个月里的一天（这个月就用今天），结果里的流月就是那天所在的农历月，回答时只讲到流月并说明是农历几月。只有问到具体某一天才按日作答，问到具体时辰才再给 target.clock 或 target.time_index。知道当前日期时「今年」「这个月」直接填，不必追问；用户没给的日期或时辰不要替他编。knowledge=summary/full 时附流耀、格局与流月四化星的知识包释义。',
    parameters: {
      type: 'object',
      properties: {
        target: {
          type: 'object',
          description: '运限目标：农历年、农历年加月、公历日期，或公历日期加时辰。问到哪一层就返回到哪一层。',
          properties: {
            year: { type: 'integer', minimum: 1, maximum: 9999, description: '目标农历年，用公历年份数字表示。与 date 二选一。' },
            month: { type: 'integer', minimum: 1, maximum: 12, description: '目标农历月 1–12（正月为 1），只能跟着 year。' },
            date: { type: 'string', description: '目标公历日期 YYYY-M-D，不含钟点。与 year 二选一。' },
            time_index: { type: 'integer', minimum: 0, maximum: 12, description: '目标时辰序号 0–12（0 早子 00:00–00:59，1 丑 … 11 亥，12 晚子 23:00–23:59），只跟着 date。' },
            clock: { type: 'string', description: '目标钟点 HH:MM，只跟着 date。23:00–23:59 为晚子（12）。' },
          },
          additionalProperties: false,
        },
        detail: DETAIL,
        knowledge: { ...KNOWLEDGE, description: '是否附流耀与行运格局的知识包释义：`summary` 或 `full`。省略则只返回事实。' },
      },
      required: ['target'],
      additionalProperties: false,
    },
    run(input, ctx) {
      const target = parseTarget(input.target);
      const opts = textOptions(input, ctx);
      const { chart } = ctx;
      switch (target.kind) {
        case 'year':
          // 与提示词「运限」一段一致：运限写到流年，文末附该年的流月一览。
          return `${chart.horoscopeOfYear(target.year).toText(opts)}\n${chart.monthlyListToText(target.year, opts)}`;
        case 'month':
          return chart.horoscopeOfMonth(target.year, target.month).toText(opts);
        case 'day':
          return chart.horoscope(target.date).toText(opts);
        case 'hour':
          return chart.horoscope(target.date, target.hour as TimeIndex).toText(opts);
      }
    },
    view(input, ctx, t) {
      const target = parseTarget(input.target);
      const { chart } = ctx;
      const h =
        target.kind === 'year'
          ? chart.horoscopeOfYear(target.year)
          : target.kind === 'month'
            ? chart.horoscopeOfMonth(target.year, target.month)
            : chart.horoscope(target.date, target.kind === 'hour' ? (target.hour as TimeIndex) : undefined);
      const age = h.age.nominalAge;
      const decadal = chart.decadalList().find((d) => age >= d.ageRange[0] && age <= d.ageRange[1]);
      const parts = [
        decadal ? fmt(t.chat.tools.decadalPart, { gz: gz(decadal), a: decadal.ageRange[0], b: decadal.ageRange[1] }) : null,
        fmt(t.chat.tools.yearlyPart, { gz: gz(h.yearly) }),
        target.kind === 'year' ? t.chat.tools.monthsPart : fmt(t.chat.tools.monthlyPart, { gz: gz(h.monthly) }),
        target.kind === 'day' || target.kind === 'hour' ? fmt(t.chat.tools.dailyPart, { gz: gz(h.daily) }) : null,
        target.kind === 'hour' ? fmt(t.chat.tools.hourlyPart, { gz: gz(h.hourly) }) : null,
      ].filter((x) => x !== null);
      const label =
        target.kind === 'year'
          ? fmt(t.chat.tools.horoscopeYear, { y: target.year })
          : target.kind === 'month'
            ? fmt(t.chat.tools.horoscopeMonth, { y: target.year, m: target.month })
            : target.kind === 'day'
              ? fmt(t.chat.tools.horoscopeDay, { d: target.date })
              : fmt(t.chat.tools.horoscopeHour, { d: target.date, h: t.hours[target.hour] ?? String(target.hour) });
      return {
        label,
        scope: parts.join(t.chat.tools.sep),
        focus: target.kind === 'year' ? { kind: 'year', year: target.year } : target.kind === 'month' ? { kind: 'month', year: target.year, month: target.month } : null,
      };
    },
  },
  {
    name: 'ziwei_get_decadal_overview',
    description:
      '这张盘一生的大限一览：十二个大限（每段十年）各一行，写大限命宫所在的本命宫、虚岁与年份区间、大限干支与四化落宫。用于「这辈子运势走势」「哪段运最好」「三四十岁怎么样」这类跨十年的问题。要看某段里某一年的细节，再用 ziwei_get_horoscope 的 target.year。knowledge=summary/full 时表后附四化星的知识包释义。',
    parameters: { type: 'object', properties: { knowledge: KNOWLEDGE }, additionalProperties: false },
    run: (input, ctx) => ctx.chart.decadalListToText(textOptions(input, ctx)),
    view: (_input, _ctx, t) => ({ label: t.chat.tools.decades, scope: t.chat.tools.decadesScope, focus: null }),
  },
  {
    name: 'ziwei_get_yearly_overview',
    description:
      '这张盘连续若干年的流年一览：每个农历年一行，写干支、正月初一的阳历日期、虚岁、大限与小限所在的本命宫、流年命宫所在的本命宫与流年四化落宫。用于「接下来几年怎么样」「哪年适合结婚、换工作」「三十岁前后几年」这类跨年份的问题，一次调用拿到，不要逐年调 ziwei_get_horoscope。from_year、to_year 是农历年，用公历年份数字表示（2027 指 2027 年正月初一起的丁未年），最多 20 年；问「接下来几年」时从今年开始。要某一年的细节再用 ziwei_get_horoscope 的 target.year。knowledge=summary/full 时表后附四化星的知识包释义。',
    parameters: {
      type: 'object',
      properties: {
        from_year: { type: 'integer', description: '起始农历年（含），用公历年份数字表示。' },
        to_year: { type: 'integer', description: '截止农历年（含），与起始年合计最多 20 年。' },
        knowledge: KNOWLEDGE,
      },
      required: ['from_year', 'to_year'],
      additionalProperties: false,
    },
    run(input, ctx) {
      const [from, to] = yearsOf(input);
      return ctx.chart.yearlyOverviewToText(from, to, textOptions(input, ctx));
    },
    view(input, _ctx, t) {
      const [from, to] = yearsOf(input);
      return { label: fmt(t.chat.tools.years, { a: from, b: to }), scope: t.chat.tools.yearsScope, focus: null };
    },
  },
  {
    name: 'ziwei_get_topic_palaces',
    description:
      '按主题取这张盘的本命盘材料。主题（如婚恋、事业、财运）看哪些宫由知识包里该主题的定义决定；定义可用 ziwei_lookup_knowledge kind=topic 查看，可用主题用 ziwei_list_knowledge kind=topic 列出。返回 Markdown：主题说明、选中各宫的事实与星耀释义、落在这些宫的格局、四化释义。只含本命宫位；运限用 ziwei_get_horoscope。这是知识包给的一种取材方式，可以不用它，直接基于 ziwei_get_natal_chart 的完整盘面按自己的方法解读。',
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: '主题 slug，取自知识包目录里 kind=topic 的条目，如默认包的 romance、career、wealth。' },
        detail: DETAIL,
        knowledge: { type: 'string', enum: ['summary', 'full'], description: '释义深度：`summary`（默认）或 `full`。' },
      },
      required: ['topic'],
      additionalProperties: false,
    },
    run(input, ctx) {
      const topic = topicOf(input, ctx.pack);
      const detail = opt(input, 'detail', ['full', 'overview'] as const);
      const depth = opt(input, 'knowledge', ['summary', 'full'] as const) ?? 'summary';
      return ctx.chart.topicToText(topic.slug, { ...(detail ? { detail } : {}), knowledge: ctx.pack, knowledgeDepth: depth });
    },
    view(input, ctx, t) {
      const topic = topicOf(input, ctx.pack);
      const { chart } = ctx;
      const indexOf = (key: string) => {
        const p = chart.palace(key);
        if (!p) throw new Error(`主题 ${topic.slug} 的宫位标识 ${key} 在盘上定位不到`);
        return p.index;
      };
      const picked: number[] = [];
      const add = (i: number) => {
        if (!picked.includes(i)) picked.push(i);
      };
      for (const key of topic.surround ?? []) {
        const s = chart.surroundedPalaces(key);
        if (!s) throw new Error(`主题 ${topic.slug} 的宫位标识 ${key} 在盘上定位不到`);
        for (const p of [s.target, s.career, s.wealth, s.opposite]) add(p.index);
      }
      for (const key of topic.palaces ?? []) add(indexOf(key));
      const names = picked.map((i) => chart.palaces[i]!.name).join(t.chat.tools.sep);
      const first = (topic.surround ?? [])[0] ?? (topic.palaces ?? [])[0];
      return {
        label: fmt(t.chat.tools.topic, { name: topic.title ?? topic.slug }),
        scope: topic.surround?.length ? fmt(t.chat.tools.topicSurround, { first: chart.palaces[picked[0]!]!.name, names }) : names,
        focus: first === undefined ? null : { kind: 'palace', palace: indexOf(first) },
      };
    },
  },
  {
    name: 'ziwei_lookup_knowledge',
    description:
      '按语言无关标识查知识包条目原文，一次 1–20 个。kind 为 star / pattern / palace / mutagen / concept / topic。返回 JSON：条目的名称、正文与摘要；星耀另有门派属性与双星组合，格局另有古籍引文与成立条件，主题另有选宫定义；并注明知识包 id 与版本。标识取自 ziwei_list_knowledge，不接受译名；任一标识不存在则整次失败，不返回相近条目。',
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: KINDS, description: '条目段：star / pattern / palace / mutagen / concept / topic。' },
        keys: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: MAX_LOOKUP_KEYS, description: '语言无关标识，1 到 20 个，取自 ziwei_list_knowledge；不接受译名。' },
      },
      required: ['kind', 'keys'],
      additionalProperties: false,
    },
    run(input, ctx) {
      const kind = kindOf(input);
      const all = packEntries(ctx.pack, kind);
      const entries = keysOf(input).map((key) => {
        const entry = all[key];
        if (!entry) throw new ToolInputError(`unknown ${kind} key \`${key}\``);
        return { kind, key, entry };
      });
      return JSON.stringify({ pack: { id: ctx.pack.id, version: ctx.pack.version, language: ctx.pack.language }, entries });
    },
    view(input, ctx, t) {
      const kind = kindOf(input);
      const all = packEntries(ctx.pack, kind);
      const names = keysOf(input).map((k) => entryName(all[k]) ?? k);
      return { label: fmt(t.chat.tools.lookup, { names: names.join(t.chat.tools.sep) }), scope: ctx.packSource, focus: null };
    },
  },
  {
    name: 'ziwei_list_knowledge',
    description:
      '列出知识包目录：每个条目的标识与显示名，按 star / pattern / palace / mutagen / concept / topic 分段，可用 kind 只列一段。用它把盘面文本里的星名、宫名、格局名对应到 ziwei_lookup_knowledge 需要的标识，以及查看有哪些术语和主题。',
    parameters: {
      type: 'object',
      properties: { kind: { type: 'string', enum: KINDS, description: '只列某一段；省略则列全部。' } },
      additionalProperties: false,
    },
    run(input, ctx) {
      const only = opt(input, 'kind', KINDS);
      const sections = KINDS.filter((k) => !only || k === only).map((kind) => ({
        kind,
        items: Object.entries(packEntries(ctx.pack, kind))
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, e]) => ({ key, ...(entryName(e) ? { name: entryName(e) } : {}) })),
      }));
      return JSON.stringify({ pack: { id: ctx.pack.id, version: ctx.pack.version, language: ctx.pack.language }, sections });
    },
    view: (_input, ctx, t) => ({ label: t.chat.tools.catalog, scope: ctx.packSource, focus: null }),
  },
];

function yearsOf(input: Json): [number, number] {
  const from = int(input, 'from_year', 1, 9999);
  const to = int(input, 'to_year', 1, 9999);
  if (from === undefined || to === undefined) throw new ToolInputError('from_year and to_year are required');
  if (to < from) throw new ToolInputError('to_year must not be earlier than from_year');
  if (to - from >= MAX_OVERVIEW_YEARS) throw new ToolInputError(`from_year to to_year covers at most ${MAX_OVERVIEW_YEARS} years`);
  return [from, to];
}

/** 模型给的入参不对（工具规则或内核的入参检查不过）：这次调用以错误结果返回给模型，它据此改参数重试。 */
export function isInputError(err: unknown, kernel: Kernel): boolean {
  return err instanceof ToolInputError || (err instanceof kernel.IztroError && err.code !== 'internal');
}

/**
 * 调用的界面写法。模型调了不存在的工具或入参不对时写成工具名（或其显示名），范围留空：这次调用以错误结果返回给模型。
 */
export function describeCall(name: string, input: Json, ctx: ToolContext, t: Messages): CallView {
  const names: Record<string, string> = t.chat.tools.names;
  const spec = TOOLS.find((s) => s.name === name);
  if (!spec) return { label: name, scope: '', focus: null };
  try {
    return spec.view(input, ctx, t);
  } catch (err) {
    if (isInputError(err, ctx.kernel)) return { label: names[name] ?? name, scope: '', focus: null };
    throw err;
  }
}
