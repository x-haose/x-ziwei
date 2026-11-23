import { docNav } from '../doc/nav';
import { DEFAULT_LANG, LANGS } from '../i18n/lang';
import { MESSAGES } from '../i18n/messages';
import { sitemapXml } from '../lib/crawl';
import { site } from '../lib/site';

/** `/sitemap.xml`：各语言的首页、排盘页、方法页与全部帮助页。两种语言的页面一一对应，按默认语言的侧栏列出。 */
export function loader() {
  const docs = docNav(DEFAULT_LANG, MESSAGES[DEFAULT_LANG]).flatMap((g) => g.items.map((i) => `/${i.id}`));
  return new Response(sitemapXml(site(), LANGS, ['', '/chart', ...docs]), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
