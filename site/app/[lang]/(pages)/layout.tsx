import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import { baseOptions, libraryLink } from '@/lib/layout.shared';
import { Footer } from '@/components/footer';

/**
 * 内容页版式：左侧页面树、右侧本页目录，顶栏与首页相同。
 *
 * notebook 版式的容器是 CSS 网格，`col-span-full` 让页脚落在
 * 正文与侧栏下方的整行，不占具名区域之间的空格子。
 */
export default async function Layout({ params, children }: LayoutProps<'/[lang]'>) {
  const { lang } = await params;
  const options = baseOptions(lang);

  return (
    <DocsLayout
      {...options}
      tree={source.getPageTree(lang)}
      nav={{ ...options.nav, mode: 'top' }}
      // 本站各页已在侧栏，顶栏只留去排盘库文档的入口；全挂上去会把搜索框旁的位置挤满。
      links={[libraryLink(lang)]}
    >
      {children}
      <Footer lang={lang} className="col-span-full" />
    </DocsLayout>
  );
}
