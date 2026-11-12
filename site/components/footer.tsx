import Link from 'next/link';
import { LIBRARY_DOCS_URL, REPO_URL } from '@/lib/layout.shared';

const TEXT = {
  zh: {
    tagline: '把紫微斗数的盘面事实、知识资料和解读方法公开给任何大模型。',
    use: '使用',
    install: '安装',
    tools: '工具',
    knowledge: '知识包',
    developers: '开发者',
    api: 'HTTP 接口',
    selfHost: '自己部署',
    library: '排盘库 x-iztro',
    llmsIndex: '站点索引',
    llmsFull: '全文',
    about: '关于',
    privacy: '隐私政策',
    terms: '服务条款',
    support: '支持',
  },
  en: {
    tagline:
      'Zi Wei Dou Shu chart facts, reference knowledge and a reading method, open to any model.',
    use: 'Use',
    install: 'Install',
    tools: 'Tools',
    knowledge: 'Knowledge pack',
    developers: 'Developers',
    api: 'HTTP API',
    selfHost: 'Self-hosting',
    library: 'x-iztro library',
    llmsIndex: 'Site index',
    llmsFull: 'Full text',
    about: 'About',
    privacy: 'Privacy policy',
    terms: 'Terms of service',
    support: 'Support',
  },
} as const;

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <h2 className="text-xs font-medium tracking-wide text-fd-foreground">{title}</h2>
      {children}
    </div>
  );
}

const linkClass =
  'text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground';

/**
 * 全站页脚。
 *
 * 隐私政策、服务条款与支持只在这里露出，不进顶栏；
 * 给模型读的两个纯文本端点也列在这里，它们不出现在任何页面的正文里。
 *
 * `className` 供调用方交代自己版式里的落位：内容页版式是 CSS 网格，
 * 页脚要显式横跨整行才不会被塞进侧栏旁的空格子。
 */
export function Footer({ lang, className }: { lang: string; className?: string }) {
  const t = TEXT[lang as keyof typeof TEXT] ?? TEXT.en;
  const page = (path: string) => `/${lang}/${path}`;

  return (
    <footer className={`relative ${className ?? ''}`}>
      {/*
        分隔线单独画，不用 footer 自己的 border-t：内容页版式里侧栏是悬浮的
        （absolute、占满视口高度），横贯整行的上边框会从侧栏中间穿过去。
        线从侧栏右缘起，`--fd-sidebar-width` 在窄屏与首页版式下为 0，线即回到最左。
      */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 ms-[var(--fd-sidebar-width,0px)] border-t border-fd-border"
      />
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-2.5">
          <span className="text-sm font-semibold">x-ziwei</span>
          <p className="text-sm leading-relaxed text-fd-muted-foreground">{t.tagline}</p>
        </div>

        <Column title={t.use}>
          <Link className={linkClass} href={page('install')}>{t.install}</Link>
          <Link className={linkClass} href={page('tools')}>{t.tools}</Link>
          <Link className={linkClass} href={page('knowledge')}>{t.knowledge}</Link>
        </Column>

        <Column title={t.developers}>
          <Link className={linkClass} href={page('api')}>{t.api}</Link>
          <Link className={linkClass} href={page('self-host')}>{t.selfHost}</Link>
          <a className={linkClass} href={`${LIBRARY_DOCS_URL}/${lang}`} target="_blank" rel="noreferrer">
            {t.library}
          </a>
          <a className={linkClass} href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a>
          <a className={`${linkClass} font-mono`} href={`/${lang}/llms.txt`}>
            /{lang}/llms.txt <span className="font-sans">· {t.llmsIndex}</span>
          </a>
          <a className={`${linkClass} font-mono`} href={`/${lang}/llms-full.txt`}>
            /{lang}/llms-full.txt <span className="font-sans">· {t.llmsFull}</span>
          </a>
        </Column>

        <Column title={t.about}>
          <Link className={linkClass} href={page('privacy')}>{t.privacy}</Link>
          <Link className={linkClass} href={page('terms')}>{t.terms}</Link>
          <Link className={linkClass} href={page('support')}>{t.support}</Link>
        </Column>
      </div>
    </footer>
  );
}
