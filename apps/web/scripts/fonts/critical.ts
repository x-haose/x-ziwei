import { BRANCHES } from '../../app/chart/layout.ts';
import { MESSAGES } from '../../app/i18n/messages.ts';

/** 可打印 ASCII 与中文常用标点：标题、数字、按钮文字随处会用到。 */
const BASE = (() => {
  let s = '';
  for (let c = 0x20; c <= 0x7e; c++) s += String.fromCharCode(c);
  return `${s}，。、；：？！「」『』（）《》〈〉—…·–　`;
})();

function strings(value: unknown, out: string[]): void {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) strings(v, out);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, out);
}

/**
 * 首屏关键子集的用字：全部界面文案（中英两种语言）、盘面地支与基础字符。
 * 界面文案只出现在 `app/i18n/messages.ts`，所以这份字集随文案自动更新。
 */
export function criticalText(): string {
  const out: string[] = [BASE, BRANCHES.join('')];
  strings(MESSAGES, out);
  return [...new Set(out.join(''))].sort().join('');
}
