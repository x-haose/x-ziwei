import type { Lang } from '../i18n/lang';
import en from './reading.en.md?raw';
import zh from './reading.zh.md?raw';

/**
 * 解读方法正文：没有工具可调的聊天 AI 按它解读，网页生成的提示词以它开头，方法页展示它。
 * 与插件的 Skill（`plugin/skills/ziwei/SKILL.md`）并列维护。
 */
export const READING_METHOD: Record<Lang, string> = { zh, en };
