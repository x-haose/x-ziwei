import { searchServer } from '../doc/llms';
import { langOfPath } from '../i18n/lang';
import { resourcePathname } from '../lib/meta';
import type { Route } from './+types/search-index';

/** 某个语言的站内搜索索引（`/{lang}/search.json`），预渲染成静态文件，浏览器下载后本地检索。 */
export function loader({ request }: Route.LoaderArgs) {
  const pathname = resourcePathname(request);
  const lang = langOfPath(pathname);
  if (!lang) throw new Error(`不是搜索索引的地址：${pathname}`);
  return searchServer(lang).staticGET();
}
