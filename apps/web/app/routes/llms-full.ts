import { llmsFull } from '../doc/llms';
import { langOfPath } from '../i18n/lang';
import { resourcePathname } from '../lib/meta';
import type { Route } from './+types/llms-full';

/** `/{lang}/llms-full.txt`：该语言全部内容页的 Markdown 原文，按侧栏顺序。 */
export async function loader({ request }: Route.LoaderArgs) {
  const pathname = resourcePathname(request);
  const lang = langOfPath(pathname);
  if (!lang) throw new Error(`不是全文的地址：${pathname}`);
  return new Response(await llmsFull(lang), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
