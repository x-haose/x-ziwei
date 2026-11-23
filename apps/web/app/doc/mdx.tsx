import { type ComponentProps, type ReactElement, type ReactNode, isValidElement } from 'react';
import { Link } from 'react-router';
import { scrollToAnchor } from '../lib/scroll';
import { currentDocHref } from './paths';
import { CodeBlock } from '../markdown/markdown';
import * as markdownCss from '../markdown/markdown.css';
import * as css from './mdx.css';

/** 代码块里 `code` 元素的纯文字。 */
function codeText(children: ReactNode): string {
  if (typeof children === 'string') return children;
  if (isValidElement(children)) return codeText((children as ReactElement<{ children?: ReactNode }>).props.children);
  if (Array.isArray(children)) return children.map(codeText).join('');
  return '';
}

/** 站内链接走前端路由（内容里的旧地址改写到现址，见 `currentDocHref`），页内锚点平滑滚动且不改地址，站外链接在新标签页打开。 */
function Anchor({ href, children }: ComponentProps<'a'>) {
  if (!href) throw new Error('MDX 里的链接没有地址');
  if (href.startsWith('#')) {
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
  if (href.startsWith('/')) return <Link to={currentDocHref(href)}>{children}</Link>;
  return (
    <a href={href} target="_blank" rel="noopener">
      {children}
    </a>
  );
}

/** 提示框。`type` 为 warn、warning、error 时是警示样式，其余是普通提示。 */
function Callout({ title, type, children }: { title?: string; type?: string; children?: ReactNode }) {
  const warn = type === 'warn' || type === 'warning' || type === 'error';
  return (
    <aside className={warn ? `${css.callout} ${css.calloutWarn}` : css.callout} role="note">
      {title && <p className={css.calloutTitle}>{title}</p>}
      {children}
    </aside>
  );
}

function Steps({ children }: { children?: ReactNode }) {
  return <ol className={css.steps}>{children}</ol>;
}

function Step({ children }: { children?: ReactNode }) {
  return <li className={css.step}>{children}</li>;
}

/**
 * 帮助页 MDX 的元素映射：版式由内容页正文的样式（设计规范第 14 节）负责，这里接管链接、代码块、
 * 表格的横向滚动容器，以及内容里用到的 Callout、Steps、Step。
 */
export const mdxComponents = {
  a: Anchor,
  pre: ({ children, title, 'data-language': lang }: ComponentProps<'pre'> & { 'data-language'?: string }) => (
    <CodeBlock code={codeText(children).replace(/\n$/, '')} lang={lang ?? 'text'} title={title ?? (lang && lang !== 'text' ? lang : '')} />
  ),
  table: (props: ComponentProps<'table'>) => (
    <div className={markdownCss.tableWrap}>
      <table {...props} />
    </div>
  ),
  th: (props: ComponentProps<'th'>) => <th scope="col" {...props} />,
  Callout,
  Steps,
  Step,
};
