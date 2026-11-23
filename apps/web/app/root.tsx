import { type ReactNode, useSyncExternalStore } from 'react';
import { RouterProvider } from 'react-aria-components';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse, useHref, useLocation, useMatches, useNavigate } from 'react-router';
import fonts from 'virtual:xzw-fonts';
import type { Route } from './+types/root';
import * as errorCss from './components/not-found.css';
import { ToastProvider } from './components/toast';
import { DEFAULT_LANG, HTML_LANG, LANGS, langOfPath } from './i18n/lang';
import { rootRedirectScript } from './i18n/redirect';
import { themeBootScript } from './theme/theme';
import './styles/global.css';

export const links: Route.LinksFunction = () => [
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
  ...fonts.preload.map((href) => ({
    rel: 'preload',
    href,
    as: 'font',
    type: 'font/woff2',
    crossOrigin: 'anonymous' as const,
  })),
  { rel: 'stylesheet', href: fonts.css },
];

/**
 * 每个页面共用的文档外壳。
 *
 * `<head>` 最前面是主题引导脚本，首帧前写好明暗；根路径页面另有语言跳转脚本。
 * `<html>` 的 `data-theme`、`data-pref` 由引导脚本在水合前写入，不经 React 渲染，
 * 所以 `suppressHydrationWarning` 只作用于这一层的属性差异。404 等不是真实页面的地址不输出语言对照链接。
 */
export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const matches = useMatches();
  const notFound = matches.some((m) => m.id === 'routes/not-found');
  const lang = langOfPath(pathname);
  const rest = lang ? pathname.slice(lang.length + 1) : '';
  const htmlLang = useHtmlLang(HTML_LANG[lang ?? DEFAULT_LANG]);
  return (
    <html lang={htmlLang} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {pathname === '/' && <script dangerouslySetInnerHTML={{ __html: rootRedirectScript }} />}
        {lang &&
          !notFound &&
          LANGS.map((l) => <link key={l} rel="alternate" hrefLang={HTML_LANG[l]} href={`/${l}${rest}`} />)}
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

/**
 * `<html lang>` 的取值。水合那一次沿用页面上已有的值：SPA 回退页是按根路径预渲染的，
 * 用它显示未预渲染的地址（如 /en/nope）时，预渲染的 lang 与真实地址不同；
 * 水合后换成按地址算出的值，React 随之更新属性。
 */
function useHtmlLang(lang: string): string {
  return useSyncExternalStore(
    () => () => {},
    () => lang,
    () => (typeof document === 'undefined' ? lang : document.documentElement.lang),
  );
}

/** React Aria 组件里的链接（如搜索结果）走前端路由，不整页刷新。 */
export default function App() {
  const navigate = useNavigate();
  return (
    <RouterProvider navigate={(to, options) => navigate(to, options)} useHref={useHref}>
      <ToastProvider>
        <Outlet />
      </ToastProvider>
    </RouterProvider>
  );
}

/**
 * 渲染出错时的兜底页面。路由错误响应（如 404）显示状态码；其余是代码缺陷，
 * 把错误原样抛到控制台，页面上只写一句，不伪装成正常页面。
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (!isRouteErrorResponse(error)) console.error(error);
  const title = isRouteErrorResponse(error) ? `${error.status}` : 'Error';
  return (
    <main className={errorCss.page}>
      <h1 className={errorCss.title}>{title}</h1>
    </main>
  );
}
