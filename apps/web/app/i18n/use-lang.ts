import { useLocation } from 'react-router';
import { type Lang, langOfPath } from './lang';
import { MESSAGES, type Messages } from './messages';

/**
 * 当前页面的语言，取自地址的语言段。
 *
 * 只能在语言段之下的页面里调用：路由表（`app/routes.ts`）只为受支持的语言注册这些页面，
 * 地址里取不到语言说明组件被挂到了语言段之外，属于代码写错，直接抛错。
 */
export function useLang(): Lang {
  const { pathname } = useLocation();
  const lang = langOfPath(pathname);
  if (!lang) throw new Error(`useLang 只能用在语言段之下的页面：${pathname}`);
  return lang;
}

/** 当前语言的界面文案。 */
export function useMessages(): Messages {
  return MESSAGES[useLang()];
}
