import { type ReactNode, useEffect, useRef, useState } from 'react';
import ReactMarkdown, { type Components, type ExtraProps } from 'react-markdown';
import remarkCjkFriendly from 'remark-cjk-friendly';
import remarkGfm from 'remark-gfm';
import remend from 'remend';
import { CheckIcon } from '../components/icons';
import { fmt } from '../i18n/messages';
import { useMessages } from '../i18n/use-lang';
import { scrollToAnchor } from '../lib/scroll';
import * as css from './markdown.css';
import { slugify } from './toc';

/**
 * 本站只渲染这些元素：一到四级标题、段落、列表、表格、分隔线、代码块、行内代码、加粗、链接。
 * 其余语法（斜体、引用等）只保留文字；原始 HTML 一律不渲染。图片语法不加载图片，显示为指向图片地址的链接：
 * 模型输出与知识包正文不可信，能自动发出的请求（图片地址里可以带上对话内容）一律不发。
 */
const ALLOWED = ['h1', 'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'pre', 'code', 'strong', 'a', 'img', 'br'];

/** 站外链接：只在点击时新开页，不带 Referer、新页拿不到本页（`window.opener`）。 */
const EXTERNAL = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** 代码块纯文本超过这个长度时折行并改用正文字体（给模型的长段说明）。 */
const WRAP_TEXT_OVER = 160;

/** 复制成功的提示停留时长（毫秒）。 */
const COPIED_MS = 2000;

type HastNode = NonNullable<ExtraProps['node']>;

/** hast 节点下的纯文字。 */
function textOf(node: HastNode | HastNode['children'][number]): string {
  if (node.type === 'text') return node.value;
  if ('children' in node) return node.children.map((c) => textOf(c as HastNode)).join('');
  return '';
}

export function CodeBlock({ code, lang, title }: { code: string; lang: string; title: string }) {
  const t = useMessages();
  const [state, setState] = useState<'idle' | 'ok' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const wrap = lang === 'text' && code.length > WRAP_TEXT_OVER;
  return (
    <figure className={wrap ? `${css.codeBlock} ${css.codeWrap}` : css.codeBlock}>
      <figcaption className={css.codeHead}>
        <span>{title}</span>
        <button
          type="button"
          className={css.codeCopy}
          data-ok={state === 'ok' ? '' : undefined}
          aria-label={fmt(t.doc.copyLabel, { title: title || t.doc.copyCode })}
          onClick={async () => {
            clearTimeout(timer.current);
            try {
              await navigator.clipboard.writeText(code);
              setState('ok');
              timer.current = setTimeout(() => setState('idle'), COPIED_MS);
            } catch (err) {
              console.error(err);
              setState('failed');
            }
          }}
        >
          {state === 'ok' && <CheckIcon />}
          {state === 'ok' ? t.doc.copied : state === 'failed' ? t.doc.copyFailed : t.doc.copy}
        </button>
      </figcaption>
      <pre className={css.pre}>
        <code>{code}</code>
      </pre>
    </figure>
  );
}

/** 标题带锚点 id（内容页的目录与站内锚点用）。 */
function heading(level: 1 | 2 | 3 | 4) {
  const Tag = `h${level}` as const;
  return function Heading({ node, children }: { node?: HastNode | undefined; children?: ReactNode }) {
    const id = node ? slugify(textOf(node)) : undefined;
    return <Tag id={id}>{children}</Tag>;
  };
}

/**
 * 不带 id 的标题：提示词、对话的回答里的标题含生辰（「命盘 2000-8-16 寅时 女」）或模型照抄的生辰，
 * 生辰不能进元素 id（统计脚本会上报元素选择器）；这些地方不需要锚点。
 */
function plainHeading(level: 1 | 2 | 3 | 4) {
  const Tag = `h${level}` as const;
  return function Heading({ children }: { children?: ReactNode }) {
    return <Tag>{children}</Tag>;
  };
}

const proseComponents: Components = {
  h1: heading(1),
  h2: heading(2),
  h3: heading(3),
  h4: heading(4),
  table: ({ children }) => (
    <div className={css.tableWrap}>
      <table>{children}</table>
    </div>
  ),
  th: ({ children }) => <th scope="col">{children}</th>,
  a: ({ href, children }) => {
    if (href?.startsWith('#')) {
      const id = decodeURIComponent(href.slice(1));
      return (
        <a
          href={href}
          onClick={(e) => {
            e.preventDefault();
            scrollToAnchor(id);
          }}
        >
          {children}
        </a>
      );
    }
    const external = href !== undefined && /^https?:/.test(href);
    return (
      <a href={href} {...(external ? EXTERNAL : {})}>
        {children}
      </a>
    );
  },
  img: ({ src, alt }) => {
    const href = typeof src === 'string' ? src : '';
    return (
      <a href={href} {...(/^https?:/.test(href) ? EXTERNAL : {})}>
        {alt || href}
      </a>
    );
  },
  pre: ({ node }) => {
    const code = node?.children.find((c) => c.type === 'element' && c.tagName === 'code');
    if (!code || code.type !== 'element') throw new Error('代码块里没有 code 元素');
    const classes = code.properties.className;
    const lang = Array.isArray(classes)
      ? (classes.map(String).find((c) => c.startsWith('language-'))?.slice('language-'.length) ?? 'text')
      : 'text';
    const meta = (code.data as { meta?: string } | undefined)?.meta ?? '';
    const title = /title="([^"]*)"/.exec(meta)?.[1] ?? (lang === 'text' ? '' : lang);
    return <CodeBlock code={textOf(code).replace(/\n$/, '')} lang={lang} title={title} />;
  },
};

const plainComponents: Components = { ...proseComponents, h1: plainHeading(1), h2: plainHeading(2), h3: plainHeading(3), h4: plainHeading(4) };

/**
 * Markdown 渲染：提示词预览、对话的回答与内容页共用同一套元素映射，样式按 `variant` 区分
 * （`preview` 见设计规范第 13 节，`chat` 见 19.4，`full` 见 21.6，`prose` 见第 14 节）。
 * 只有 `prose` 的标题带锚点 id，其余的不带。
 * 输入先经 remend 补全未闭合的标记，流式输出途中的半截文本也能正常显示。
 */
export function Markdown({ source, variant }: { source: string; variant: 'preview' | 'chat' | 'full' | 'prose' }) {
  return (
    <div className={variant === 'preview' ? css.preview : variant === 'chat' ? `${css.preview} ${css.chat}` : variant === 'full' ? `${css.preview} ${css.full}` : css.prose}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkCjkFriendly]}
        allowedElements={ALLOWED}
        unwrapDisallowed
        skipHtml
        components={variant === 'prose' ? proseComponents : plainComponents}
      >
        {remend(source)}
      </ReactMarkdown>
    </div>
  );
}
