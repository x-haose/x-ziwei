import { useMemo } from 'react';
import { DocPage } from '../doc/doc-page';
import { MESSAGES } from '../i18n/messages';
import { useLang, useMessages } from '../i18n/use-lang';
import { metaLang, pageMeta } from '../lib/meta';
import { Markdown } from '../markdown/markdown';
import { tocOf } from '../markdown/toc';
import { READING_METHOD } from '../prompt/method';
import type { Route } from './+types/method';

export const meta: Route.MetaFunction = ({ location }) => {
  const t = MESSAGES[metaLang(location.pathname)];
  return pageMeta(`${t.doc.methodTitle}：${t.brand.name}`, t.method.lede);
};

/** 方法页：用内容页模板展示解读方法正文。 */
export default function MethodRoute() {
  const lang = useLang();
  const t = useMessages();
  const source = READING_METHOD[lang];
  const toc = useMemo(() => tocOf(source).map((e) => ({ id: e.id, depth: e.level, title: e.text })), [source]);
  return (
    <DocPage current="method" title={t.doc.methodTitle} lede={t.method.lede} toc={toc}>
      <Markdown source={source} variant="prose" />
    </DocPage>
  );
}
