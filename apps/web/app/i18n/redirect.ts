import { DEFAULT_LANG, LANGS } from './lang';

/**
 * 根路径的语言跳转，内联进根路径页面的 `<head>`，在绘制之前执行。
 *
 * 纯静态站没有服务端读 `Accept-Language`，桌面端也没有，所以在浏览器里按
 * `navigator.languages` 的先后找第一个受支持的语言（只看主标签，`zh-TW` 也算中文），
 * 找不到就去默认语言。用 `location.replace`，根路径不留在历史记录里；查询串与 `#` 之后的部分原样带过去。
 * 只在地址确实是 `/` 时跳转：SPA 回退页也是按 `/` 预渲染的，它会被用来显示任意未预渲染的地址（如 404），
 * 那时不能跳走。写成源码字符串而不是由函数 `toString()` 得来，理由同主题引导脚本（`app/theme/theme.ts`）。
 */
export const rootRedirectScript = `(function(){if(location.pathname!=="/")return;var l=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||""];var a=${JSON.stringify(LANGS)};var t=${JSON.stringify(DEFAULT_LANG)};for(var i=0;i<l.length;i++){var p=String(l[i]).toLowerCase().split("-")[0];if(a.indexOf(p)>=0){t=p;break}}location.replace("/"+t+location.search+location.hash)})()`;
