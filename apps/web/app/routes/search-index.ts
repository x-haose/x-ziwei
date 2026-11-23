import { searchServer } from '../doc/llms';

/** 站内搜索的索引（`/search.json`），预渲染成静态文件，浏览器下载后本地检索。 */
export function loader() {
  return searchServer().staticGET();
}
