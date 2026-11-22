import { fmt } from '../i18n/messages';
import { useMessages } from '../i18n/use-lang';
import { THEME_CYCLE, setThemePref, useThemePref } from '../theme/theme';
import { ThemeDarkIcon, ThemeLightIcon, ThemeSystemIcon } from './icons';
import * as css from './theme-button.css';
import { useToast } from './toast';

/** 主题按钮：按 跟随系统 → 浅色 → 深色 轮换，选择存在本机。 */
export function ThemeButton({ className }: { className?: string }) {
  const t = useMessages();
  const toast = useToast();
  const pref = useThemePref();
  const name = t.theme[pref];
  return (
    <button
      type="button"
      className={className ? `${css.button} ${className}` : css.button}
      aria-label={fmt(t.theme.button, { name })}
      title={fmt(t.theme.title, { name })}
      onClick={() => {
        const next = THEME_CYCLE[(THEME_CYCLE.indexOf(pref) + 1) % THEME_CYCLE.length]!;
        const saved = setThemePref(next);
        toast(fmt(saved ? t.theme.saved : t.theme.unsaved, { name: t.theme[next] }));
      }}
    >
      <span className={`${css.icon} ${css.system}`}>
        <ThemeSystemIcon />
      </span>
      <span className={`${css.icon} ${css.light}`}>
        <ThemeLightIcon />
      </span>
      <span className={`${css.icon} ${css.dark}`}>
        <ThemeDarkIcon />
      </span>
    </button>
  );
}
