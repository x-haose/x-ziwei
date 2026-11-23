import { llmsIndex } from '../doc/llms';
import { DEFAULT_LANG, langOfPath } from '../i18n/lang';
import { resourcePathname } from '../lib/meta';
import type { Route } from './+types/llms-index';

/** `/llms.txt`（默认语言）与 `/{lang}/llms.txt`：站点结构索引，供模型定位要抓取的页面。 */
export function loader({ request }: Route.LoaderArgs) {
  const lang = langOfPath(resourcePathname(request)) ?? DEFAULT_LANG;
  return new Response(llmsIndex(lang), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
