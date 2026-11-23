import type { Lang } from '../i18n/lang';

/** 提示词末尾「用户的问题」一节的标题，以及用户没写问题时代填的那一句。 */
const QUESTION: Record<Lang, { heading: string; fallback: string }> = {
  zh: {
    heading: '# 我的问题',
    fallback: '请先整体看看这张盘：我是个什么样的人，这几年要留意什么。',
  },
  en: {
    heading: '# My question',
    fallback:
      'Please give me an overall reading of this chart first: what kind of person I am, and what to watch for in the next few years.',
  },
};

/** 「我的问题」一节的标题行。 */
export function questionHeading(lang: Lang): string {
  return QUESTION[lang].heading;
}

/**
 * 拼出贴给聊天 AI 的整段提示词。
 *
 * 顺序固定：解读方法（同目录 `reading.<lang>.md` 的正文）、盘面各段、用户的问题。
 * 盘面各段是 x-iztro 文本投影的原文，与 MCP 工具返回给模型的是同一种 Markdown，
 * 各自以 `#` 标题开头，这里只用分隔线把三部分隔开，不改写内容。
 * 空白的盘面段被略去，全部为空时方法与问题之间只有一道分隔线；
 * `question` 去掉首尾空白后为空时用默认问题。
 */
export function buildPrompt({
  lang,
  method,
  sections,
  question,
}: {
  lang: Lang;
  method: string;
  sections: string[];
  question: string;
}): string {
  const q = QUESTION[lang];
  const asked = question.trim() || q.fallback;
  const chart = sections.map((s) => s.trim()).filter(Boolean);
  return [method.trim(), '---', ...(chart.length ? [...chart, '---'] : []), `${q.heading}\n\n${asked}`].join('\n\n');
}
