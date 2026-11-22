import { DocPage } from '../doc/doc-page';
import { useLang, useMessages } from '../i18n/use-lang';
import { MESSAGES } from '../i18n/messages';
import { metaLang, pageMeta } from '../lib/meta';
import { READING_METHOD } from '../prompt/method';
import type { Route } from './+types/method';

export const meta: Route.MetaFunction = ({ location }) => {
  const t = MESSAGES[metaLang(location.pathname)];
  return pageMeta(`${t.doc.titles.method}：${t.brand.name}`, t.method.lede);
};

/** 方法页：用内容页模板展示解读方法正文。 */
export default function MethodRoute() {
  const lang = useLang();
  const t = useMessages();
  return <DocPage id="method" lede={t.method.lede} source={READING_METHOD[lang]} />;
}
