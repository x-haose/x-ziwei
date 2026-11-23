import { structure } from 'fumadocs-core/mdx-plugins/remark-structure';
import { createI18nSearchAPI } from 'fumadocs-core/search/server';
import { type Lang, LANGS, localePath } from '../i18n/lang';
import { MESSAGES } from '../i18n/messages';
import { READING_METHOD } from '../prompt/method';
import { docNav } from './nav';
import { docsI18n, source } from './source';

/**
 * 给模型读的文本：每页的 Markdown 原文、各语言的索引与全文，以及站内搜索的索引。
 * 只在构建时（预渲染资源路由）执行。帮助页的原文是 fumadocs-mdx 处理后的 Markdown（MDX 组件已转成 Markdown），
 * 方法页的原文就是 `reading.<lang>.md`。
 */

/** 某页的 Markdown 原文：标题与地址、导语、正文。`id` 是 slug（方法页为 method）。 */
export async function docMarkdown(lang: Lang, id: string): Promise<string> {
  if (id === 'method') {
    const t = MESSAGES[lang];
    return `# ${t.doc.methodTitle} (${localePath(lang, '/method')})\n\n${t.method.lede}\n\n${READING_METHOD[lang].trim()}\n`;
  }
  const page = source.getPage([id], lang);
  if (!page) throw new Error(`没有这一页：${lang}/${id}`);
  return `# ${page.data.title} (${page.url})\n\n${page.data.description ?? ''}\n\n${(await page.data.getText('processed')).trim()}\n`;
}

/** 索引末尾互相指路：本语言的全文与其余语言的索引、全文。文案带英文括注，抓到中文那份的模型未必读中文。 */
const ENDPOINT_LABELS: Record<Lang, { index: string; full: string }> = {
  zh: { index: '中文索引 (Chinese index)', full: '中文全文 (Chinese full text)' },
  en: { index: 'English index', full: 'English full text' },
};

function description(lang: Lang, id: string): string {
  if (id === 'method') return MESSAGES[lang].method.lede;
  return source.getPage([id], lang)?.data.description ?? '';
}

/** 某个语言的站点索引：按侧栏的分组与顺序列出每页（链接指向 `.md` 原文）与导语。 */
export function llmsIndex(lang: Lang): string {
  const t = MESSAGES[lang];
  const lines = [`# ${t.brand.name}`, '', `> ${t.homeNav.blurb}`, ''];
  for (const g of docNav(lang, t)) {
    lines.push(`## ${g.title}`, '');
    for (const item of g.items) lines.push(`- [${item.title}](${item.url}.md): ${description(lang, item.id)}`);
    lines.push('');
  }
  lines.push('## Full text and other languages', '', `- [${ENDPOINT_LABELS[lang].full}](/${lang}/llms-full.txt)`);
  for (const other of LANGS.filter((l) => l !== lang)) {
    lines.push(`- [${ENDPOINT_LABELS[other].index}](/${other}/llms.txt)`, `- [${ENDPOINT_LABELS[other].full}](/${other}/llms-full.txt)`);
  }
  return `${lines.join('\n')}\n`;
}

/** 某个语言的全部内容页原文，按侧栏顺序首尾相接，一次抓取即可作为完整上下文。 */
export async function llmsFull(lang: Lang): Promise<string> {
  const items = docNav(lang, MESSAGES[lang]).flatMap((g) => g.items);
  return (await Promise.all(items.map((i) => docMarkdown(lang, i.id)))).join('\n');
}

/**
 * 站内搜索：构建时把全部内容页（两种语言）编成一份索引，浏览器下载后在本地检索。
 * 默认的多语言分词按 Unicode 词边界切分，中文同样可搜。
 */
export function searchServer() {
  return createI18nSearchAPI('advanced', {
    i18n: docsI18n,
    indexes: LANGS.flatMap((lang) => [
      {
        id: localePath(lang, '/method'),
        url: localePath(lang, '/method'),
        title: MESSAGES[lang].doc.methodTitle,
        description: MESSAGES[lang].method.lede,
        structuredData: structure(READING_METHOD[lang]),
        locale: lang,
      },
      ...source.getPages(lang).map((page) => ({
        id: page.url,
        url: page.url,
        title: page.data.title,
        description: page.data.description,
        structuredData: page.data.structuredData,
        locale: lang,
      })),
    ]),
  });
}
