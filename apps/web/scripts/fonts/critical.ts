import { i18n, init } from 'x-iztro';
import { BRANCHES } from '../../app/chart/layout.ts';
import { BODY_TAG, LAYER_PREFIX, ORIGIN_TAG, PILLAR_LABELS } from '../../app/chart/terms.ts';
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
 * 首屏关键子集的用字：全部界面文案（中英两种语言）、盘上的固定用字、基础字符，
 * 以及排盘内核的全部中文译名（星曜、宫位、干支、亮度、四化、五行局、时辰等，取自内核的翻译表）。
 * 界面文案只出现在 `app/i18n/messages.ts`，译名取自内核，所以这份字集随两者自动更新。
 */
export async function criticalText(): Promise<string> {
  await init();
  const out: string[] = [BASE, BRANCHES.join(''), BODY_TAG, ORIGIN_TAG, PILLAR_LABELS.join(''), Object.values(LAYER_PREFIX).join('')];
  strings(MESSAGES, out);
  for (const key of i18n.allKeys()) {
    const zh = i18n.translate(key, 'zh-CN');
    if (zh === undefined) throw new Error(`内核标识没有中文译名：${key}`);
    out.push(zh);
  }
  return [...new Set(out.join(''))].sort().join('');
}
