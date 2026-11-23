import { llmsFull } from '../doc/llms';
import { DEFAULT_LANG, langOfPath } from '../i18n/lang';
import { resourcePathname } from '../lib/meta';
import type { Route } from './+types/llms-full';

/** `/llms-full.txt`（默认语言）与 `/{lang}/llms-full.txt`：该语言全部内容页的 Markdown 原文，按侧栏顺序。 */
export async function loader({ request }: Route.LoaderArgs) {
  const lang = langOfPath(resourcePathname(request)) ?? DEFAULT_LANG;
  return new Response(await llmsFull(lang), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
