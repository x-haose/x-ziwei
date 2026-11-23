import { robotsTxt } from '../lib/crawl';
import { site } from '../lib/site';

/** `/robots.txt`：按部署目标放开或禁止抓取。 */
export function loader() {
  return new Response(robotsTxt(site()), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
