import { type ReactNode, useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Footer } from '../components/footer';
import { CaretIcon } from '../components/icons';
import { TopBar } from '../components/top-bar';
import { useLang, useMessages } from '../i18n/use-lang';
import { scrollToAnchor } from '../lib/scroll';
import * as css from './doc-page.css';
import { docNav } from './nav';

/** 标题越过视口上沿这么多像素（含）之后，算作当前所在的节。 */
const SPY_OFFSET = 120;

/** 滚动时把越过视口上沿 120px 的最后一个标题标为当前节。 */
function useCurrentSection(ids: readonly string[]): string | null {
  const [current, setCurrent] = useState<string | null>(ids[0] ?? null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      let cur = ids[0] ?? null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) throw new Error(`目录项没有对应的标题：${id}`);
        if (el.getBoundingClientRect().top < SPY_OFFSET) cur = id;
      }
      setCurrent(cur);
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, [ids]);
  return current;
}

export interface DocTocItem {
  id: string;
  depth: 2 | 3;
  title: ReactNode;
}

function TocList({ toc, current, onPick }: { toc: readonly DocTocItem[]; current: string | null; onPick?: () => void }) {
  return (
    <ul>
      {toc.map((e) => (
        <li key={e.id}>
          <a
            className={e.depth === 3 ? `${css.tocLink} ${css.tocSub}` : css.tocLink}
            href={`#${e.id}`}
            data-current={e.id === current ? '' : undefined}
            onClick={(ev) => {
              ev.preventDefault();
              scrollToAnchor(e.id);
              onPick?.();
            }}
          >
            {e.title}
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * 内容页模板（设计规范第 14 节）：侧栏列出全部文档分组，正文，右侧本页目录，末尾上一篇/下一篇。
 * 页内锚点平滑滚动且不改地址。`current` 是本页在侧栏里的 id（slug）。
 */
export function DocPage({
  current,
  title,
  lede,
  toc,
  children,
}: {
  current: string;
  title: string;
  lede?: string | undefined;
  toc: readonly DocTocItem[];
  children: ReactNode;
}) {
  const t = useMessages();
  const lang = useLang();
  const nav = useMemo(() => docNav(lang, t), [lang, t]);
  const flat = nav.flatMap((g) => g.items);
  const index = flat.findIndex((d) => d.id === current);
  if (index < 0) throw new Error(`本页不在侧栏里：${current}`);
  const group = nav.find((g) => g.items.some((d) => d.id === current))!;
  const prev = flat[index - 1];
  const next = flat[index + 1];
  const ids = useMemo(() => toc.map((e) => e.id), [toc]);
  const currentSection = useCurrentSection(ids);
  const [tocOpen, setTocOpen] = useState(false);
  const tocListId = useId();
  return (
    <>
      <TopBar />
      <div className={css.page}>
        <nav className={css.side} aria-label={t.doc.sideLabel}>
          {nav.map((g) => (
            <div key={g.title} className={css.sideSection}>
              <h3 className={css.sideGroup}>{g.title}</h3>
              {g.items.map((d) => (
                <Link key={d.id} className={css.sideLink} to={d.url} aria-current={d.id === current ? 'page' : undefined}>
                  {d.title}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <article className={css.article}>
          <header className={css.header}>
            <p className={css.crumb}>{group.title}</p>
            <h1 className={css.title}>{title}</h1>
            {lede && <p className={css.lede}>{lede}</p>}
          </header>
          {toc.length > 0 && (
            <div className={css.mobileToc}>
              <button
                type="button"
                className={css.mobileTocButton}
                aria-expanded={tocOpen}
                aria-controls={tocListId}
                onClick={() => setTocOpen((o) => !o)}
              >
                {t.doc.tocToggle}
                <span className={css.mobileTocCaret}>
                  <CaretIcon />
                </span>
              </button>
              <div id={tocListId} className={css.mobileTocList} hidden={!tocOpen}>
                <TocList toc={toc} current={currentSection} onPick={() => setTocOpen(false)} />
              </div>
            </div>
          )}
          {children}
          <nav className={css.pager} aria-label={t.doc.pager}>
            {prev && (
              <Link className={css.pagerLink} to={prev.url}>
                <small className={css.pagerLabel}>{t.doc.prev}</small>
                <b className={css.pagerTitle}>{prev.title}</b>
              </Link>
            )}
            {next && (
              <Link className={`${css.pagerLink} ${css.pagerNext}`} to={next.url}>
                <small className={css.pagerLabel}>{t.doc.next}</small>
                <b className={css.pagerTitle}>{next.title}</b>
              </Link>
            )}
          </nav>
        </article>
        {toc.length > 0 && (
          <aside className={css.toc} aria-label={t.doc.tocLabel}>
            <p className={css.tocLabel}>{t.doc.toc}</p>
            <TocList toc={toc} current={currentSection} />
          </aside>
        )}
      </div>
      <Footer />
    </>
  );
}
