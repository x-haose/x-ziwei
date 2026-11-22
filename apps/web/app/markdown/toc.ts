/** 标题的锚点：小写，去掉反引号与标点，空白换成连字符；中文原样保留。 */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-');
}

export interface TocEntry {
  level: 2 | 3;
  text: string;
  id: string;
}

/**
 * Markdown 原文里的二、三级标题，供「本页目录」使用。围栏代码块里的 `#` 行不算。
 * 标题里的行内标记（链接、代码、加粗）只取文字，与渲染后标题的纯文字一致，锚点因此对得上。
 */
export function tocOf(source: string): TocEntry[] {
  const out: TocEntry[] = [];
  let fenced = false;
  for (const line of source.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const m = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const text = m[2]!
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/(\*\*|__)(.*?)\1/g, '$2');
    out.push({ level: m[1]!.length as 2 | 3, text, id: slugify(text) });
  }
  return out;
}
