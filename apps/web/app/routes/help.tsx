import { useLocation } from 'react-router';
import { DocPage, type DocTocItem } from '../doc/doc-page';
import { mdxComponents } from '../doc/mdx';
import { helpPageOf } from '../doc/source';
import { MESSAGES } from '../i18n/messages';
import { metaLang, pageMeta } from '../lib/meta';
import * as markdownCss from '../markdown/markdown.css';
import type { Route } from './+types/help';

export const meta: Route.MetaFunction = ({ location }) => {
  const page = helpPageOf(location.pathname);
  const t = MESSAGES[metaLang(location.pathname)];
  return pageMeta(`${page.data.title}：${t.brand.name}`, page.data.description);
};

/** 帮助页：内容取自 `site/content` 的 MDX，用内容页模板展示。 */
export default function HelpRoute() {
  const { pathname } = useLocation();
  const page = helpPageOf(pathname);
  const Body = page.data.body;
  const toc: DocTocItem[] = page.data.toc
    .filter((item) => item.depth === 2 || item.depth === 3)
    .map((item) => ({ id: decodeURIComponent(item.url.replace(/^#/, '')), depth: item.depth as 2 | 3, title: item.title }));
  return (
    <DocPage current={page.slugs.join('/')} title={page.data.title} lede={page.data.description} toc={toc}>
      <div className={markdownCss.prose}>
        <Body components={mdxComponents} />
      </div>
    </DocPage>
  );
}
