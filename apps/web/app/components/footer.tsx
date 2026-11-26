import { Link, useLocation } from 'react-router';
import { LANGS } from '../i18n/lang';
import { useLang, useMessages } from '../i18n/use-lang';
import { localePath } from '../i18n/lang';
import { GITHUB_URL } from '../lib/site';
import * as css from './footer.css';

/** 内容页页脚：项目名、隐私政策、服务条款、GitHub，以及切到另一种语言的同一页。 */
export function Footer() {
  const lang = useLang();
  const t = useMessages();
  const { pathname } = useLocation();
  const other = LANGS.find((l) => l !== lang)!;
  return (
    <footer className={css.footer}>
      <span>{t.footer.project}</span>
      <Link className={css.link} to={localePath(lang, '/privacy')}>
        {t.footer.privacy}
      </Link>
      <Link className={css.link} to={localePath(lang, '/terms')}>
        {t.footer.terms}
      </Link>
      <a className={css.link} href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
        {t.footer.github}
      </a>
      <Link className={css.lang} to={`/${other}${pathname.slice(lang.length + 1)}`} hrefLang={other} lang={other}>
        {t.footer.otherLang}
      </Link>
    </footer>
  );
}
