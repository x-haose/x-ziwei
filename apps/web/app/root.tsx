import type { ReactNode } from 'react';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse, useLocation } from 'react-router';
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
 * 所以 `suppressHydrationWarning` 只作用于这一层的属性差异。
 */
export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const lang = langOfPath(pathname);
  const rest = lang ? pathname.slice(lang.length + 1) : '';
  return (
    <html lang={HTML_LANG[lang ?? DEFAULT_LANG]} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {pathname === '/' && <script dangerouslySetInnerHTML={{ __html: rootRedirectScript }} />}
        {lang &&
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

export default function App() {
  return (
    <ToastProvider>
      <Outlet />
    </ToastProvider>
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
