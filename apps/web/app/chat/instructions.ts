import type { Lang } from '../i18n/lang';
import en from './instructions.en.md?raw';
import zh from './instructions.zh.md?raw';

/**
 * 对话的系统提示词：同目录 `instructions.<lang>.md` 的正文（与插件的 Skill `plugin/skills/ziwei/SKILL.md` 并列维护，
 * 去掉了问生辰与八字反推两节：盘就是页面上这张），末尾补今天的日期与模式。
 */
const BODY: Record<Lang, string> = { zh, en };

const TAIL: Record<Lang, { today: string; noTools: string }> = {
  zh: {
    today: '今天是公历 {date}。',
    noTools:
      '这次对话不能调用工具：盘面（本命与当年运限）以文本附在最后一个问题前的 `<chart>…</chart>` 里。只用附上的内容作答；问到没附的年份、月份或某一天，请他在网页上选好那一段，或换一个能调用工具的模型。',
  },
  en: {
    today: "Today's Gregorian date is {date}.",
    noTools:
      'Tools are not available in this conversation: the chart (natal and the current year) is attached as text in `<chart>…</chart>` before the last question. Answer only from what is attached; for a year, month or day that is not attached, ask them to pick it on the page or switch to a model that can call tools.',
  },
};

/** `date` 为公历 `YYYY-M-D`。`tools` 为假时是无工具模式。 */
export function instructions(lang: Lang, date: string, tools: boolean): string {
  const tail = TAIL[lang];
  return [BODY[lang].trim(), tail.today.replace('{date}', date), ...(tools ? [] : [tail.noTools])].join('\n\n');
}
