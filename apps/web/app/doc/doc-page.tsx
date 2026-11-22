import { type ReactNode, useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Footer } from '../components/footer';
import { CaretIcon } from '../components/icons';
import { TopBar } from '../components/top-bar';
import { useLang, useMessages } from '../i18n/use-lang';
import { scrollToAnchor } from '../lib/scroll';
import { Markdown } from '../markdown/markdown';
import { type TocEntry, tocOf } from '../markdown/toc';
import * as css from './doc-page.css';
import { DOC_GROUPS, DOC_ORDER, type DocId, docGroup, docLink, docTitle } from './docs';

/** 标题越过视口上沿这么多像素（含）之后，算作当前所在的节。 */
const SPY_OFFSET = 120;

/** 滚动时把越过视口上沿 120px 的最后一个标题标为当前节。 */
function useCurrentSection(toc: readonly TocEntry[]): string | null {
  const [current, setCurrent] = useState<string | null>(toc[0]?.id ?? null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      let cur = toc[0]?.id ?? null;
      for (const entry of toc) {
        const el = document.getElementById(entry.id);
        if (!el) throw new Error(`目录项没有对应的标题：${entry.id}`);
        if (el.getBoundingClientRect().top < SPY_OFFSET) cur = entry.id;
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
  }, [toc]);
  return current;
}

function DocLink({ id, className, current, children }: { id: DocId; className: string; current?: boolean; children: ReactNode }) {
  const lang = useLang();
  const link = docLink(lang, id);
  return 'to' in link ? (
    <Link className={className} to={link.to} aria-current={current ? 'page' : undefined}>
      {children}
    </Link>
  ) : (
    <a className={className} href={link.href}>
      {children}
    </a>
  );
}

function TocList({ toc, current, onPick }: { toc: readonly TocEntry[]; current: string | null; onPick?: () => void }) {
  return (
    <ul>
      {toc.map((e) => (
        <li key={e.id}>
          <a
            className={e.level === 3 ? `${css.tocLink} ${css.tocSub}` : css.tocLink}
            href={`#${e.id}`}
            data-current={e.id === current ? '' : undefined}
            onClick={(ev) => {
              ev.preventDefault();
              scrollToAnchor(e.id);
              onPick?.();
            }}
          >
            {e.text}
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * 内容页模板：侧栏列出全部文档分组，正文是 Markdown，右侧是本页目录，末尾是上一篇/下一篇。
 * 页内锚点平滑滚动且不改地址。
 */
export function DocPage({ id, lede, source }: { id: DocId; lede: string; source: string }) {
  const t = useMessages();
  const toc = useMemo(() => tocOf(source), [source]);
  const current = useCurrentSection(toc);
  const [tocOpen, setTocOpen] = useState(false);
  const tocListId = useId();
  const index = DOC_ORDER.indexOf(id);
  const prev = DOC_ORDER[index - 1];
  const next = DOC_ORDER[index + 1];
  return (
    <>
      <TopBar />
      <div className={css.page}>
        <nav className={css.side} aria-label={t.doc.sideLabel}>
          {DOC_GROUPS.map((g) => (
            <div key={g.group} className={css.sideSection}>
              <h3 className={css.sideGroup}>{t.doc.groups[g.group]}</h3>
              {g.items.map((d) => (
                <DocLink key={d} id={d} className={css.sideLink} current={d === id}>
                  {docTitle(t, d)}
                </DocLink>
              ))}
            </div>
          ))}
        </nav>
        <article className={css.article}>
          <header className={css.header}>
            <p className={css.crumb}>{t.doc.groups[docGroup(id)]}</p>
            <h1 className={css.title}>{docTitle(t, id)}</h1>
            <p className={css.lede}>{lede}</p>
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
                <TocList toc={toc} current={current} onPick={() => setTocOpen(false)} />
              </div>
            </div>
          )}
          <Markdown source={source} variant="prose" />
          <nav className={css.pager} aria-label={t.doc.pager}>
            {prev && (
              <DocLink id={prev} className={css.pagerLink}>
                <small className={css.pagerLabel}>{t.doc.prev}</small>
                <b className={css.pagerTitle}>{docTitle(t, prev)}</b>
              </DocLink>
            )}
            {next && (
              <DocLink id={next} className={`${css.pagerLink} ${css.pagerNext}`}>
                <small className={css.pagerLabel}>{t.doc.next}</small>
                <b className={css.pagerTitle}>{docTitle(t, next)}</b>
              </DocLink>
            )}
          </nav>
        </article>
        {toc.length > 0 && (
          <aside className={css.toc} aria-label={t.doc.tocLabel}>
            <p className={css.tocLabel}>{t.doc.toc}</p>
            <TocList toc={toc} current={current} />
          </aside>
        )}
      </div>
      <Footer />
    </>
  );
}
