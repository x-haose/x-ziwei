import * as xiztro from 'x-iztro';
import { TopBar } from '../components/top-bar';
import { MESSAGES } from '../i18n/messages';
import { defaultPackInfo } from '../knowledge/kernel-pack';
import { KnowledgePage } from '../knowledge/knowledge-page';
import { metaLang, pageMeta } from '../lib/meta';
import type { Route } from './+types/knowledge';

export const meta: Route.MetaFunction = ({ location }) => {
  const t = MESSAGES[metaLang(location.pathname)];
  return pageMeta(`${t.knowledge.title}：${t.brand.name}`, t.knowledge.metaDescription);
};

/**
 * 预渲染时（Node 里）由排盘内核取出默认包的信息，写进页面：内核在浏览器里装好之前，默认包也能显示。
 * 只在构建时执行，不进浏览器端的代码。
 */
export async function loader() {
  await xiztro.init();
  return { defaultPack: defaultPackInfo(xiztro) };
}

/** 知识包页：本机的包、当前生效的组合、导入、查看、导出与删除。 */
export default function KnowledgeRoute({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <TopBar />
      <KnowledgePage initialDefault={loaderData.defaultPack} />
    </>
  );
}
