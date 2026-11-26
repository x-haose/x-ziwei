import { TopBar } from '../components/top-bar';
import { WritePage } from '../editor/write-page';
import { MESSAGES } from '../i18n/messages';
import { metaLang, pageMeta } from '../lib/meta';
import type { Route } from './+types/knowledge-write';

export const meta: Route.MetaFunction = ({ location }) => {
  const t = MESSAGES[metaLang(location.pathname)];
  return pageMeta(`${t.editor.writeTitle}：${t.brand.name}`, t.editor.writeMeta);
};

/** 「写自己的释义」：编辑器的第一屏，也是看盘里「改写这一条」的入口（带 `entry` 参数时直接换到编辑器）。 */
export default function KnowledgeWriteRoute() {
  return (
    <>
      <TopBar />
      <WritePage />
    </>
  );
}
