import { type RouteConfig, index, route } from '@react-router/dev/routes';
import { LANGS } from './i18n/lang';

/**
 * 全部是静态路径：每种语言各注册一份同样的页面（路由 id 带语言前缀以示区分），
 * 预渲染时逐个生成 HTML。不在表里的地址落到 404。
 */
export default [
  index('routes/root.tsx'),
  ...LANGS.flatMap((lang) => [
    route(lang, 'routes/home.tsx', { id: `${lang}/home` }),
    route(`${lang}/chart`, 'routes/chart.tsx', { id: `${lang}/chart` }),
    route(`${lang}/method`, 'routes/method.tsx', { id: `${lang}/method` }),
  ]),
  route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig;
