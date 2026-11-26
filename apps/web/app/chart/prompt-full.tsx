import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import * as controls from '../components/controls.css';
import { CaretIcon, CheckIcon, CloseIcon } from '../components/icons';
import { Segmented } from '../components/segmented';
import type { Lang } from '../i18n/lang';
import { fmt, type Messages } from '../i18n/messages';
import { Markdown } from '../markdown/markdown';
import * as css from './prompt-full.css';
import { useCopy } from './use-copy';

/** 原文视图：保留换行；`#` 开头的行是标题（带层级，供目录定位），「我的问题」一节用强调色。 */
function RawView({ text, questionHeading }: { text: string; questionHeading: string }) {
  const at = text.lastIndexOf(questionHeading);
  const body = at >= 0 ? text.slice(0, at) : text;
  const question = at >= 0 ? text.slice(at) : '';
  return (
    <>
      {body.split('\n').map((line, i) => {
        const level = /^(#{1,3}) /.exec(line)?.[1]?.length;
        return (
          // 行号即行在原文里的位置，原文不变时稳定。
          <span key={i} className={level ? css.rawHeading : undefined} data-level={level}>
            {line}
            {'\n'}
          </span>
        );
      })}
      {question && (
        <span className={css.rawQuestion}>
          {/* 只有标题行带层级：目录与窄屏头部取的是带 data-level 元素的全部文字。 */}
          <span data-level={1}>{questionHeading}</span>
          {question.slice(questionHeading.length)}
        </span>
      )}
    </>
  );
}

interface TocItem {
  level: number;
  text: string;
}

/**
 * 提示词全文（设计规范 21.5）：全屏阅读视图，左侧按一到三级标题的段落目录（随正文滚动标出当前段），右侧正文
 * （渲染或原文），头部可复制原文。打开时背后的页面不渲染、不进读屏；Esc 或关闭按钮收起，焦点回到「查看全文」（由调用方处理）。
 */
export function PromptFull({ t, lang, text, questionHeading, onClose }: { t: Messages; lang: Lang; text: string; questionHeading: string; onClose: () => void }) {
  const [mode, setMode] = useState<'md' | 'raw'>('md');
  const [toc, setToc] = useState<TocItem[]>([]);
  const [current, setCurrent] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const heads = useRef<HTMLElement[]>([]);
  const { copy, run } = useCopy();
  const copied = copy.kind === 'ok';

  useEffect(() => {
    document.documentElement.dataset.fullview = '';
    return () => {
      delete document.documentElement.dataset.fullview;
    };
  }, []);

  // 目录取自渲染出来的标题（原文视图里是标了层级的行），切换渲染 / 原文时重取。
  useLayoutEffect(() => {
    const root = content.current;
    if (!root) throw new Error('全文正文没有挂上');
    const nodes = [...root.querySelectorAll<HTMLElement>('h1, h2, h3, [data-level]')];
    heads.current = nodes;
    setToc(nodes.map((n) => ({ level: n.dataset.level ? Number(n.dataset.level) : Number(n.tagName.slice(1)), text: (n.textContent ?? '').replace(/^#+\s*/, '').trim() })));
    setCurrent(0);
    root.scrollTop = 0;
  }, [mode, text]);

  const onScroll = () => {
    const root = content.current;
    if (!root) return;
    const top = root.getBoundingClientRect().top;
    if (root.scrollTop + root.clientHeight >= root.scrollHeight - 2) {
      setCurrent(heads.current.length - 1);
      return;
    }
    let at = 0;
    heads.current.forEach((h, i) => {
      if (h.getBoundingClientRect().top - top <= 24) at = i;
    });
    setCurrent(at);
  };

  const jump = (i: number) => {
    const h = heads.current[i];
    if (!h) throw new Error(`目录第 ${i} 项没有对应的标题`);
    h.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    setCurrent(i);
    setTocOpen(false);
    // 收起目录时被点的按钮随之消失（<1024）；焦点交给正文，Esc 仍能关闭全文视图。
    content.current?.focus({ preventScroll: true });
  };

  const count = fmt(t.chart.count, { n: [...text].length.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en') });
  const levelClass = (l: number) => (l === 1 ? css.tocL1 : l === 2 ? css.tocL2 : css.tocL3);

  return (
    <ModalOverlay isOpen isDismissable={false} isKeyboardDismissDisabled={false} onOpenChange={(o) => !o && onClose()}>
      <Modal className={css.modal}>
        <Dialog className={css.dialog} aria-labelledby="prompt-full-title">
          <div className={css.head}>
            <Button className={css.close} aria-label={t.chart.closeFull} onPress={onClose} autoFocus>
              <CloseIcon />
            </Button>
            <div className={css.title}>
              <Heading slot="title" id="prompt-full-title" className={css.titleText}>
                {t.chart.fullTitle}
              </Heading>
              <small className={css.titleCount}>{count}</small>
            </div>
            <button type="button" className={css.tocButton} aria-expanded={tocOpen} onClick={() => setTocOpen((o) => !o)}>
              {t.chart.toc}
              <span className={css.tocCurrent}>{toc[current]?.text}</span>
              <CaretIcon />
            </button>
            <Segmented
              label={t.chart.previewMode}
              className={css.mode}
              value={mode}
              options={[
                { value: 'md', label: t.chart.rendered },
                { value: 'raw', label: t.chart.raw },
              ]}
              onChange={setMode}
            />
            <button type="button" className={`${controls.button} ${css.copy}`} data-ok={copied ? '' : undefined} onClick={() => run('prompt', text)}>
              {copied ? (
                <>
                  <CheckIcon />
                  {t.chart.copied}
                </>
              ) : (
                t.chart.copyPrompt
              )}
            </button>
          </div>
          <div className={css.body}>
            <nav className={tocOpen ? `${css.toc} ${css.tocOpen}` : css.toc} aria-label={t.chart.tocLabel}>
              <ol>
                {toc.map((h, i) => (
                  // 同名的段落会重复出现（各宫、各层），以位置区分。
                  <li key={i}>
                    <button
                      type="button"
                      className={`${css.tocLink} ${levelClass(h.level)}`}
                      aria-current={i === current ? 'location' : undefined}
                      onClick={() => jump(i)}
                    >
                      {h.text}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
            <div ref={content} className={css.content} tabIndex={-1} onScroll={onScroll} role="document" aria-label={t.chart.fullTitle}>
              {mode === 'md' ? (
                <Markdown source={text} variant="full" />
              ) : (
                <div className={css.raw}>
                  <RawView text={text} questionHeading={questionHeading} />
                </div>
              )}
            </div>
          </div>
          <div role="status" className={controls.visuallyHidden}>
            {copied ? fmt(t.chart.promptCopied, { n: [...text].length.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en') }) : copy.kind === 'failed' ? t.chart.copyFailed : ''}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
