/** 摘要层的宽度上限：显示宽度不超过它的正文本身就是摘要（与内核的摘要规则一致，SCHEMA §5.1）。 */
export const SUMMARY_WIDTH = 240;

/** 摘要的宽度上限（一句话）。 */
export const SUMMARY_MAX = 100;

/** 显示宽度：汉字等全角字符计 2，其余计 1（与内核的摘要规则一致）。 */
export function displayWidth(text: string): number {
  let n = 0;
  for (const ch of text) n += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch) ? 2 : 1;
  return n;
}
