import { useSyncExternalStore } from 'react';

/** 本机记住的主题选择：`system` 跟随系统，`light`、`dark` 固定。没存过等于 `system`。 */
export type ThemePref = 'system' | 'light' | 'dark';

/** 主题按钮的轮换顺序。 */
export const THEME_CYCLE: readonly ThemePref[] = ['system', 'light', 'dark'];

const STORAGE_KEY = 'xzw-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * 首帧前执行的主题引导，内联进每个页面 `<head>` 的最前面，在样式与正文之前运行，
 * 页面第一次绘制就是正确的明暗。写成源码字符串而不是由函数 `toString()` 得来：
 * 预渲染与浏览器端是两次独立构建，函数转出的文本会不同，水合时就对不上。
 *
 * 在 `<html>` 上写两项：`data-theme` 是实际生效的明暗（令牌按它取值），`data-pref` 是本机选择
 * （主题按钮的图标按它显示）。本机存储读不出来（隐私模式、被禁用）或值不认识时按跟随系统处理，
 * 与 `setThemePref` 存不进去时的说法一致。
 */
export const themeBootScript = `(function(){var p="system";try{var s=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});if(s==="light"||s==="dark")p=s}catch(e){p="system"}var d=p==="dark"||(p==="system"&&matchMedia(${JSON.stringify(DARK_QUERY)}).matches);var r=document.documentElement;r.setAttribute("data-theme",d?"dark":"light");r.setAttribute("data-pref",p)})()`;

function isPref(value: string | null): value is ThemePref {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** 当前选择，取自引导脚本写在 `<html>` 上的 `data-pref`。 */
function readPref(): ThemePref {
  const pref = document.documentElement.getAttribute('data-pref');
  if (!isPref(pref)) throw new Error(`<html data-pref> 不是合法的主题选择：${pref}；主题引导脚本没有运行`);
  return pref;
}

function apply(pref: ThemePref): void {
  const dark = pref === 'dark' || (pref === 'system' && matchMedia(DARK_QUERY).matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-pref', pref);
}

const listeners = new Set<() => void>();
let systemQuery: MediaQueryList | null = null;

/** 选择是「跟随系统」时，系统明暗一变就立即跟着变。 */
function onSystemChange(): void {
  apply(readPref());
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  if (!systemQuery) {
    systemQuery = matchMedia(DARK_QUERY);
    systemQuery.addEventListener('change', onSystemChange);
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * 换主题并存进本机。返回是否存成功：存不进去（隐私模式、配额满）时本次照样换，
 * 但下次打开会回到跟随系统，调用方要把这一点告诉用户。
 */
export function setThemePref(pref: ThemePref): boolean {
  let saved = true;
  try {
    if (pref === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    saved = false;
  }
  apply(pref);
  for (const l of listeners) l();
  return saved;
}

/**
 * 当前主题选择。预渲染时没有本机选择，按 `system` 渲染；水合后换成真实值。
 * 依赖它的只有无障碍标签与提示文字，图标由 CSS 按 `data-pref` 直接显示，首帧不会错。
 */
export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, readPref, () => 'system');
}
