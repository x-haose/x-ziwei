import { docMarkdown } from '../doc/llms';
import { langOfPath } from '../i18n/lang';
import { resourcePathname } from '../lib/meta';
import type { Route } from './+types/doc-markdown';

/** 内容页的 Markdown 原文（`/zh/install.md`），预渲染成静态文件。 */
export async function loader({ request }: Route.LoaderArgs) {
  const pathname = resourcePathname(request);
  const lang = langOfPath(pathname);
  const id = pathname.split('/')[2]?.replace(/\.md$/, '');
  if (!lang || !id) throw new Error(`不是内容页原文的地址：${pathname}`);
  return new Response(await docMarkdown(lang, id), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
}
