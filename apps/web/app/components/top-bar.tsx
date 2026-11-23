import { NavLink } from 'react-router';
import { localePath } from '../i18n/lang';
import { useLang, useMessages } from '../i18n/use-lang';
import { Glyph } from './icons';
import { SearchButton } from './search';
import { ThemeButton } from './theme-button';
import * as css from './top-bar.css';

/** 排盘页与内容页共用的顶栏：字标、主导航、主题按钮。首页另有自己的导航栏。 */
export function TopBar() {
  const lang = useLang();
  const t = useMessages();
  return (
    <header className={css.bar}>
      <NavLink to={localePath(lang, '')} className={css.mark} end>
        <Glyph size={22} />
        <b className={css.markName}>{t.brand.name}</b>
        <span className={css.markSub}>{t.brand.sub}</span>
      </NavLink>
      <nav className={css.nav} aria-label={t.nav.label}>
        <NavLink to={localePath(lang, '')} className={css.link} end>
          {t.nav.home}
        </NavLink>
        <NavLink to={localePath(lang, '/chart')} className={css.link}>
          {t.nav.chart}
        </NavLink>
        <NavLink to={localePath(lang, '/method')} className={`${css.link} ${css.optional}`}>
          {t.nav.method}
        </NavLink>
        <NavLink to={localePath(lang, '/knowledge')} className={`${css.link} ${css.optional}`}>
          {t.nav.knowledge}
        </NavLink>
        <NavLink to={localePath(lang, '/install')} className={`${css.link} ${css.optional}`}>
          {t.nav.install}
        </NavLink>
        <SearchButton className={css.theme} />
        <ThemeButton />
      </nav>
    </header>
  );
}
