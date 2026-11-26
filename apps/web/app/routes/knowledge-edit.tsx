import { TopBar } from '../components/top-bar';
import { EditorPage } from '../editor/editor-page';
import { MESSAGES } from '../i18n/messages';
import { metaLang, pageMeta } from '../lib/meta';
import type { Route } from './+types/knowledge-edit';

export const meta: Route.MetaFunction = ({ location }) => {
  const t = MESSAGES[metaLang(location.pathname)];
  return pageMeta(`${t.editor.writeTitle}：${t.brand.name}`, t.editor.writeMeta);
};

/** 知识包编辑器：编辑哪份草稿在查询串 `draft` 里（草稿只在本机）。 */
export default function KnowledgeEditRoute() {
  return (
    <>
      <TopBar />
      <EditorPage />
    </>
  );
}
