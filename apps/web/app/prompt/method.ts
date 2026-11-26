import type { Lang } from '../i18n/lang';
import en from './reading.en.md?raw';
import zh from './reading.zh.md?raw';

/**
 * 解读方法正文：没有工具可调的聊天 AI 按它解读，网页生成的提示词以它开头，方法页展示它。
 * 与插件的 Skill（`plugin/skills/ziwei/SKILL.md`）并列维护。
 */
export const READING_METHOD: Record<Lang, string> = { zh, en };

/** 读一个主题的一步：步名与「怎么看」。 */
export interface MethodStep {
  title: string;
  how: string;
}

/** 方法正文里「看一个主题」一节的标题（二级标题，不含 `## `）。 */
const STEPS_HEADING: Record<Lang, string> = { zh: '看一个主题', en: 'Reading one topic' };

/**
 * 从方法正文里取「看一个主题」的五步（`1. **步名**：怎么看`）。看盘每一步的「怎么看」就是这几句，
 * 人和 AI 读同一套步骤。正文里没有这一节或不是五步，是方法正文写错了，直接失败。
 */
export function methodSteps(source: string, lang: Lang): MethodStep[] {
  const lines = source.split('\n');
  const at = lines.indexOf(`## ${STEPS_HEADING[lang]}`);
  if (at < 0) throw new Error(`解读方法里没有「${STEPS_HEADING[lang]}」一节`);
  const steps: MethodStep[] = [];
  for (const line of lines.slice(at + 1)) {
    if (line.startsWith('## ')) break;
    const m = /^\d+\. \*\*(.+?)\*\*[：:]\s*(.+)$/.exec(line);
    if (m) steps.push({ title: m[1]!, how: m[2]! });
  }
  if (steps.length !== 5) throw new Error(`解读方法的「${STEPS_HEADING[lang]}」应有五步，实际 ${steps.length} 步`);
  return steps;
}

export const METHOD_STEPS: Record<Lang, MethodStep[]> = { zh: methodSteps(zh, 'zh'), en: methodSteps(en, 'en') };
