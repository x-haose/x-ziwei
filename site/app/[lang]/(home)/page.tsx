import Link from 'next/link';
import type { Metadata } from 'next';
import { ChartPreview } from '@/components/chart-preview';
import { LIBRARY_DOCS_URL, REPO_URL, SERVICE_URL } from '@/lib/layout.shared';
import { SITE_URL, languageAlternates } from '@/lib/site';
import { i18n } from '@/lib/i18n';

/**
 * 工具对公历 2000-8-16 寅时女命返回的总览原文（`ziwei_get_natal_chart`，`detail=overview`）节选。
 * 盘面文本的中文原文两种界面语言下都照原样展示：服务默认给模型的就是中文盘。
 */
const SAMPLE = `# 命盘 2000-8-16 寅时 女

## 基本信息
- 阳历: 2000-8-16 · 农历: 二〇〇〇年七月十七 · 时辰: 寅时 (03:00~05:00)
- 四柱: 庚辰 甲申 丙午 庚寅 · 生肖: 龙 · 星座: 狮子座
- 五行局: 木三局 · 命主: 破军 · 身主: 文昌
- 命宫: 午 · 身宫: 戌 (官禄) · 来因宫: 辰 (夫妻)
- 生年四化: 太阳化禄→子女, 武曲化权→财帛, 太阴化科→仆役, 天同化忌→疾厄

## 十二宫总览
| 宫位 | 主星 | 辅星 | 大限 |
|---|---|---|---|
| **命宫** 午 | 紫微(庙) | 文曲(陷) | 3-12 |
| 兄弟 巳 | 天机(平) | — | 13-22 |
| 夫妻 辰 [来因宫] | 七杀(庙) | 右弼, 火星(陷) | 23-32 |
… (其余九宫同款列全)

## 格局
- **府相朝垣** (命宫): 天府(庙), 天相(庙)`;

const COPY = {
  zh: {
    metaTitle: 'x-ziwei — 把紫微斗数完整交给你的 AI',
    metaDescription:
      '公开的紫微斗数 MCP 服务：盘面事实、知识包和解读方法全部公开，可以换成你自己的。在 Claude、Codex、ChatGPT 等客户端里直接用，无需账号。',
    tagline: '盘面 · 知识 · 方法，全部公开',
    headline: ['把紫微斗数', '完整交给你的 AI'],
    lede: '多数 AI 命理产品把提示词和解读方式藏在里面，你只能提问。这里反过来：盘怎么排的、依据的释义是哪一条、按什么方法解读，全都摆在你的模型面前，由它来读，也由你来换。',
    install: '安装到你的 AI',
    tools: '看它提供什么',
    github: '源码',
    layersTitle: '三层都是公开的，后两层可以换',
    layers: [
      {
        title: '盘面事实',
        body: '本命盘、大限流年、格局，由 x-iztro 计算，与 iztro 逐字段对齐。模型不用自己安星，也不许自己安星。',
        swap: '不换：这是计算',
      },
      {
        title: '知识包',
        body: '星耀、格局、宫位、四化的释义，术语，以及「问婚恋看哪些宫」这类主题定义。开放的 JSON 格式，每条都能查到原文和出处。',
        swap: '可以整包替换，或只覆盖几条',
      },
      {
        title: '解读方法',
        body: '一份 Markdown 写成的 Skill：先问清生辰、调哪些工具、怎么把事实和观点分开说。它只是默认做法。',
        swap: '可以改，也可以不用',
      },
    ],
    stats: [
      { value: '5', label: '个工具' },
      { value: '162', label: '颗星耀的释义' },
      { value: '64', label: '条格局' },
      { value: '13', label: '个解读主题' },
    ],
    sampleTitle: '你的模型拿到的是这样一段文字',
    sampleCaption:
      '这是工具返回的原文节选。它是盘面事实，不是结论；怎么读是模型的事。要完整十二宫、运限或知识包释义，模型会再调对应的工具。',
    sampleLink: '五个工具分别返回什么 →',
    clientsTitle: '在哪里用',
    clients: [
      { name: 'Claude Code', how: '装插件，Skill 与 MCP 一起进来' },
      { name: 'Codex', how: '装插件，Skill 与 MCP 一起进来' },
      { name: 'ChatGPT', how: '公开目录上架准备中，现在可加为自定义 MCP' },
      { name: 'Cursor、Grok 等', how: '填一个地址即可' },
    ],
    clientsLink: '各客户端的安装步骤 →',
    devTitle: '给开发者',
    dev: [
      {
        title: 'HTTP 接口',
        body: '同一套功能的 JSON 接口与 OpenAPI 文档，给不接 MCP 的程序和低代码平台。',
        href: 'api',
        external: false,
      },
      {
        title: '自己部署',
        body: '一个二进制或一个容器。用自己的知识包，或让生辰不出本机。',
        href: 'self-host',
        external: false,
      },
      {
        title: '排盘库 x-iztro',
        body: '想把排盘直接嵌进自己的程序：Rust、Python、Go 三种语言的库，本服务的盘面就是它算的。',
        href: LIBRARY_DOCS_URL,
        external: true,
      },
    ],
    strip: ['公开免费', '无需账号', '不保存命盘', 'MIT 开源'],
  },
  en: {
    metaTitle: 'x-ziwei — hand Zi Wei Dou Shu to your AI, in full',
    metaDescription:
      'A public Zi Wei Dou Shu MCP service. Chart facts, the knowledge pack and the reading method are all open and replaceable. Use it from Claude, Codex, ChatGPT and other clients, with no account.',
    tagline: 'Chart · knowledge · method, all open',
    headline: ['Hand Zi Wei Dou Shu', 'to your AI, in full'],
    lede: 'Most AI fortune products hide their prompts and reading method; all you can do is ask. This is the reverse: how the chart was cast, which reference text it leans on and what method it follows are all laid out for your model to read, and for you to replace.',
    install: 'Install it in your AI',
    tools: 'See what it provides',
    github: 'Source',
    layersTitle: 'Three open layers; the last two are replaceable',
    layers: [
      {
        title: 'Chart facts',
        body: 'Natal chart, decadal and yearly layers, patterns. Computed by x-iztro, field-for-field with iztro. The model does not place the stars itself, and must not.',
        swap: 'Not replaceable: this is computation',
      },
      {
        title: 'Knowledge pack',
        body: 'Reference notes for stars, patterns, palaces and mutagens, a glossary, and topic definitions such as which palaces to read for romance. An open JSON format; every entry can be looked up with its source.',
        swap: 'Replace the whole pack, or override a few entries',
      },
      {
        title: 'Reading method',
        body: 'A Skill written in Markdown: confirm the birth data first, which tools to call, how to keep facts and opinions apart. It is only the default.',
        swap: 'Edit it, or do without it',
      },
    ],
    stats: [
      { value: '5', label: 'tools' },
      { value: '162', label: 'stars with notes' },
      { value: '64', label: 'patterns' },
      { value: '13', label: 'reading topics' },
    ],
    sampleTitle: 'This is the text your model receives',
    sampleCaption:
      'An excerpt of what the tool returns, as is. The chart text is Chinese by default because models read a Chinese chart more reliably than translated star names. It is chart facts, not a conclusion; reading it is the model\'s job. For all twelve palaces, the horoscope layers or knowledge-pack notes, the model calls the matching tool.',
    sampleLink: 'What each of the five tools returns →',
    clientsTitle: 'Where to use it',
    clients: [
      { name: 'Claude Code', how: 'Install the plugin; the Skill and MCP arrive together' },
      { name: 'Codex', how: 'Install the plugin; the Skill and MCP arrive together' },
      { name: 'ChatGPT', how: 'Directory listing in preparation; add it as a custom MCP for now' },
      { name: 'Cursor, Grok and others', how: 'Enter one URL' },
    ],
    clientsLink: 'Install steps for each client →',
    devTitle: 'For developers',
    dev: [
      {
        title: 'HTTP API',
        body: 'The same functions as a JSON API with an OpenAPI document, for programs and low-code platforms without MCP.',
        href: 'api',
        external: false,
      },
      {
        title: 'Self-hosting',
        body: 'One binary or one container. Use your own knowledge pack, or keep birth data on your machine.',
        href: 'self-host',
        external: false,
      },
      {
        title: 'The x-iztro library',
        body: 'To embed chart casting in your own program: libraries for Rust, Python and Go. The charts this service returns are computed by it.',
        href: LIBRARY_DOCS_URL,
        external: true,
      },
    ],
    strip: ['Public and free', 'No account', 'Charts are not stored', 'MIT licensed'],
  },
} as const;

/** 首页内容不随请求变化，两种语言都在构建期生成。 */
export function generateStaticParams() {
  return i18n.languages.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: PageProps<'/[lang]'>): Promise<Metadata> {
  const { lang } = await params;
  const t = COPY[lang as keyof typeof COPY] ?? COPY.en;

  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: {
      canonical: `${SITE_URL}/${lang}`,
      languages: languageAlternates((l) => `${SITE_URL}/${l}`),
    },
    openGraph: {
      title: t.metaTitle,
      description: t.metaDescription,
      url: `${SITE_URL}/${lang}`,
      siteName: 'x-ziwei',
      type: 'website',
    },
  };
}

const buttonBase = 'rounded-xl px-5 py-2.5 text-sm font-medium';

export default async function HomePage({ params }: PageProps<'/[lang]'>) {
  const { lang } = await params;
  const t = COPY[lang as keyof typeof COPY] ?? COPY.en;
  const page = (path: string) => `/${lang}/${path}`;

  return (
    <main className="flex flex-1 flex-col">
      <section
        aria-labelledby="hero-heading"
        className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.1fr_1fr] lg:py-28"
      >
        <div className="flex flex-col gap-6">
          <p className="text-xs font-medium tracking-[0.08em] text-fd-muted-foreground uppercase">
            {t.tagline}
          </p>
          <h1 id="hero-heading" className="text-4xl leading-[1.2] font-bold tracking-tight sm:text-5xl">
            {t.headline.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-fd-muted-foreground">{t.lede}</p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Link
              href={page('install')}
              className={`${buttonBase} bg-fd-primary text-fd-primary-foreground transition-opacity hover:opacity-90`}
            >
              {t.install}
            </Link>
            <Link
              href={page('tools')}
              className={`${buttonBase} border border-fd-primary/40 bg-fd-primary/10 transition-colors hover:bg-fd-accent`}
            >
              {t.tools}
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className={`${buttonBase} border border-fd-border transition-colors hover:bg-fd-accent`}
            >
              {t.github}
            </a>
          </div>

          <code className="w-fit max-w-full overflow-x-auto rounded-lg border border-fd-border bg-fd-card px-3 py-1.5 text-xs text-fd-muted-foreground sm:text-sm">
            {SERVICE_URL}/mcp
          </code>
        </div>

        <div className="flex justify-center lg:justify-end">
          <ChartPreview lang={lang} />
        </div>
      </section>

      <section aria-labelledby="layers-heading" className="border-t border-fd-border">
        <div className="mx-auto w-full max-w-5xl px-6 py-20">
          <h2 id="layers-heading" className="text-2xl font-semibold tracking-tight">
            {t.layersTitle}
          </h2>
          <ul className="mt-8 grid gap-6 md:grid-cols-3">
            {t.layers.map((layer) => (
              <li key={layer.title} className="flex flex-col rounded-xl border border-fd-border p-6">
                <h3 className="text-base font-semibold">{layer.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-fd-muted-foreground">
                  {layer.body}
                </p>
                <p className="mt-4 border-t border-fd-border pt-3 text-sm text-[var(--color-accent-figure)]">
                  {layer.swap}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-y border-fd-border">
        <dl className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-px px-6 sm:grid-cols-4">
          {t.stats.map((s) => (
            <div key={s.label} className="flex flex-col-reverse py-8">
              <dt className="mt-1 text-sm text-fd-muted-foreground">{s.label}</dt>
              <dd className="text-3xl font-semibold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        aria-labelledby="sample-heading"
        className="mx-auto grid w-full max-w-5xl items-center gap-8 px-6 py-20 md:grid-cols-[1fr_1.4fr]"
      >
        <div className="flex flex-col gap-4">
          <h2 id="sample-heading" className="text-2xl font-semibold tracking-tight">
            {t.sampleTitle}
          </h2>
          <p className="text-sm leading-relaxed text-fd-muted-foreground">{t.sampleCaption}</p>
          <Link
            href={page('tools')}
            className="text-sm font-medium underline-offset-4 hover:underline"
          >
            {t.sampleLink}
          </Link>
        </div>
        <pre
          lang="zh"
          className="overflow-x-auto rounded-xl border border-fd-border bg-fd-card p-5 text-xs leading-relaxed"
        >
          <code>{SAMPLE}</code>
        </pre>
      </section>

      <section aria-labelledby="clients-heading" className="border-t border-fd-border">
        <div className="mx-auto w-full max-w-5xl px-6 py-20">
          <h2 id="clients-heading" className="text-2xl font-semibold tracking-tight">
            {t.clientsTitle}
          </h2>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {t.clients.map((c) => (
              <li
                key={c.name}
                className="flex flex-col gap-1 rounded-xl border border-fd-border px-4 py-3"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-sm text-fd-muted-foreground">{c.how}</span>
              </li>
            ))}
          </ul>
          <Link
            href={page('install')}
            className="mt-6 inline-block text-sm font-medium underline-offset-4 hover:underline"
          >
            {t.clientsLink}
          </Link>
        </div>
      </section>

      <section aria-labelledby="dev-heading" className="border-t border-fd-border">
        <div className="mx-auto w-full max-w-5xl px-6 py-20">
          <h2 id="dev-heading" className="text-2xl font-semibold tracking-tight">
            {t.devTitle}
          </h2>
          <ul className="mt-8 grid gap-6 md:grid-cols-3">
            {t.dev.map((d) => {
              const body = (
                <>
                  <h3 className="text-base font-semibold">
                    {d.title}
                    {d.external ? ' ↗' : ''}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-fd-muted-foreground">{d.body}</p>
                </>
              );
              const className =
                'block h-full rounded-xl border border-fd-border p-6 transition-colors hover:bg-fd-accent';
              return (
                <li key={d.title}>
                  {d.external ? (
                    <a href={`${d.href}/${lang}`} target="_blank" rel="noreferrer" className={className}>
                      {body}
                    </a>
                  ) : (
                    <Link href={page(d.href)} className={className}>
                      {body}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="border-t border-fd-border">
        <ul className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-6 py-8 text-sm text-fd-muted-foreground">
          {t.strip.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
