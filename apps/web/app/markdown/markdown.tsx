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
 * 其余语法（斜体、引用、图片等）只保留文字；原始 HTML 一律不渲染（模型输出不可信）。
 */
const ALLOWED = ['h1', 'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'pre', 'code', 'strong', 'a', 'br'];

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

function heading(level: 1 | 2 | 3 | 4) {
  const Tag = `h${level}` as const;
  return function Heading({ node, children }: { node?: HastNode | undefined; children?: ReactNode }) {
    const id = node ? slugify(textOf(node)) : undefined;
    return <Tag id={id}>{children}</Tag>;
  };
}

const components: Components = {
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
      <a href={href} {...(external ? { target: '_blank', rel: 'noopener' } : {})}>
        {children}
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

/**
 * Markdown 渲染：提示词预览与内容页共用同一套元素映射，样式按 `variant` 区分
 * （`preview` 见设计规范第 13 节，`prose` 见第 14 节）。
 * 输入先经 remend 补全未闭合的标记，流式输出途中的半截文本也能正常显示。
 */
export function Markdown({ source, variant }: { source: string; variant: 'preview' | 'prose' }) {
  return (
    <div className={variant === 'preview' ? css.preview : css.prose}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkCjkFriendly]}
        allowedElements={ALLOWED}
        unwrapDisallowed
        skipHtml
        components={components}
      >
        {remend(source)}
      </ReactMarkdown>
    </div>
  );
}
