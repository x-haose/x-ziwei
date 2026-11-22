import { HTML_LANG, LANGS } from '../i18n/lang';
import { MESSAGES } from '../i18n/messages';
import * as css from '../components/not-found.css';

export const meta = () => [{ title: 'x-ziwei' }, { name: 'robots', content: 'noindex, follow' }];

/**
 * 根路径：`<head>` 里的跳转脚本（见 `app/i18n/redirect.ts`）在绘制前按浏览器语言跳到对应语言。
 * 这里的两种语言入口只在脚本没有运行时（禁用脚本、爬虫）才看得到。
 */
export default function RootRoute() {
  return (
    <main className={css.page}>
      {LANGS.map((l) => (
        <a key={l} className={css.back} href={`/${l}`} lang={HTML_LANG[l]}>
          {MESSAGES[l].root.title}：{MESSAGES[l].brand.sub}
        </a>
      ))}
    </main>
  );
}
