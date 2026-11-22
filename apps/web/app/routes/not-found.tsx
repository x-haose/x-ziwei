import { Link, useLocation } from 'react-router';
import * as css from '../components/not-found.css';
import { DEFAULT_LANG, langOfPath, localePath } from '../i18n/lang';
import { MESSAGES } from '../i18n/messages';

export const meta = () => [{ title: '404：x-ziwei' }, { name: 'robots', content: 'noindex' }];

/** 不在路由表里的地址。语言取地址第一段，取不到用默认语言。 */
export default function NotFound() {
  const { pathname } = useLocation();
  const lang = langOfPath(pathname) ?? DEFAULT_LANG;
  const t = MESSAGES[lang];
  return (
    <main className={css.page}>
      <p className={css.code}>404</p>
      <h1 className={css.title}>{t.notFound.title}</h1>
      <Link className={css.back} to={localePath(lang, '')}>
        {t.notFound.back}
      </Link>
    </main>
  );
}
