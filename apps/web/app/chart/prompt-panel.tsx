import { useEffect, useRef, useState } from 'react';
import { Checkbox, TextArea } from 'react-aria-components';
import * as controls from '../components/controls.css';
import { CheckIcon } from '../components/icons';
import { Segmented } from '../components/segmented';
import type { Lang } from '../i18n/lang';
import { fmt, type Messages } from '../i18n/messages';
import { Markdown } from '../markdown/markdown';
import type { PromptChoice } from '../prompt/sections';
import * as css from './chart-page.css';

/** 提示词可以粘贴到的聊天 AI。 */
const CHAT_AIS = [
  { href: 'https://chat.deepseek.com/', zh: 'DeepSeek', en: 'DeepSeek' },
  { href: 'https://www.doubao.com/chat/', zh: '豆包', en: 'Doubao' },
  { href: 'https://www.kimi.com/', zh: 'Kimi', en: 'Kimi' },
  { href: 'https://chatgpt.com/', zh: 'ChatGPT', en: 'ChatGPT' },
  { href: 'https://claude.ai/new', zh: 'Claude', en: 'Claude' },
] as const;

/** 复制成功后按钮变色与说明的停留时长（毫秒）。 */
const COPIED_MS = 2400;

/** 原文视图：保留换行，标题行用主色，「我的问题」一节用强调色。 */
function RawView({ text, questionHeading }: { text: string; questionHeading: string }) {
  const at = text.lastIndexOf(questionHeading);
  const body = at >= 0 ? text.slice(0, at) : text;
  const question = at >= 0 ? text.slice(at) : '';
  return (
    <>
      {body.split('\n').map((line, i) => (
        // 行号即行在原文里的位置，原文不变时稳定。
        <span key={i} className={line.startsWith('#') ? css.rawHeading : undefined}>
          {line}
          {'\n'}
        </span>
      ))}
      {question && <span className={css.rawQuestion}>{question}</span>}
    </>
  );
}

type CopyState = { kind: 'idle' } | { kind: 'ok'; which: 'prompt' | 'link' } | { kind: 'failed' };

/**
 * 提示词区（设计规范第 13 节）：勾选盘面各段、写问题、预览（渲染或原文）、复制原文、复制链接、
 * 常用聊天 AI 的入口。`text` 为 null 时（还没有盘）整块禁用，预览写 `emptyText`。
 */
export function PromptPanel({
  t,
  lang,
  text,
  emptyText,
  choice,
  onChoice,
  yearLabel,
  yearsLabel,
  question,
  onQuestion,
  questionHeading,
}: {
  t: Messages;
  lang: Lang;
  text: string | null;
  emptyText: string;
  choice: PromptChoice;
  onChoice: (next: PromptChoice) => void;
  /** 「2026 年运限」：年份在浏览器里求得。 */
  yearLabel: string;
  /** 「2022–2031 流年一览」。 */
  yearsLabel: string;
  question: string;
  onQuestion: (q: string) => void;
  /** 原文里「我的问题」一节的标题行，用于原文视图着色。 */
  questionHeading: string;
}) {
  const [mode, setMode] = useState<'md' | 'raw'>('md');
  const [copy, setCopy] = useState<CopyState>({ kind: 'idle' });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const on = text !== null;

  const doCopy = async (which: 'prompt' | 'link', value: string) => {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(value);
      setCopy({ kind: 'ok', which });
      timer.current = setTimeout(() => setCopy({ kind: 'idle' }), COPIED_MS);
    } catch (err) {
      console.error(err);
      setCopy({ kind: 'failed' });
    }
  };

  const checks: { key: keyof PromptChoice; label: string }[] = [
    { key: 'natal', label: t.chart.checks.natal },
    { key: 'know', label: t.chart.checks.know },
    { key: 'year', label: yearLabel },
    { key: 'decades', label: t.chart.checks.decades },
    { key: 'years', label: yearsLabel },
  ];
  const count = text === null ? '' : fmt(t.chart.count, { n: [...text].length.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en') });
  const message =
    copy.kind === 'failed'
      ? t.chart.copyFailed
      : copy.kind === 'ok'
        ? copy.which === 'prompt'
          ? fmt(t.chart.promptCopied, { n: [...(text ?? '')].length.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en') })
          : t.chart.linkCopied
        : '';
  const okButton = (which: 'prompt' | 'link', label: string) =>
    copy.kind === 'ok' && copy.which === which ? (
      <>
        <CheckIcon />
        {t.chart.copied}
      </>
    ) : (
      label
    );

  return (
    <section className={on ? css.prompt : `${css.prompt} ${css.promptEmpty}`} aria-label={t.chart.prompt}>
      <div className={css.head}>
        <h2 className={css.headTitle}>{t.chart.prompt}</h2>
        <span className={css.headAux}>{t.chart.promptAux}</span>
      </div>
      <div className={css.checks}>
        {checks.map((c) => (
          <Checkbox
            key={c.key}
            className={css.check}
            isDisabled={!on}
            isSelected={choice[c.key]}
            onChange={(v) => onChoice({ ...choice, [c.key]: v })}
          >
            <span className={css.checkBox} aria-hidden="true" />
            {c.label}
          </Checkbox>
        ))}
      </div>
      <div className={css.ask}>
        <TextArea
          className={css.textarea}
          aria-label={t.chart.ask}
          placeholder={t.chart.askPlaceholder}
          disabled={!on}
          value={question}
          onChange={(e) => onQuestion(e.target.value)}
        />
      </div>
      <div className={css.previewHead}>
        <span>{t.chart.preview}</span>
        <Segmented
          label={t.chart.previewMode}
          className={css.previewMode}
          value={mode}
          options={[
            { value: 'md', label: t.chart.rendered },
            { value: 'raw', label: t.chart.raw },
          ]}
          onChange={setMode}
        />
        <span>{count}</span>
      </div>
      <div
        className={!on ? `${css.preview} ${css.previewOff}` : mode === 'raw' ? `${css.preview} ${css.previewRaw}` : css.preview}
        role="region"
        aria-label={t.chart.previewRegion}
        tabIndex={on ? 0 : undefined}
      >
        {text === null ? emptyText : mode === 'md' ? <Markdown source={text} variant="preview" /> : <RawView text={text} questionHeading={questionHeading} />}
      </div>
      <div className={css.actions}>
        <button
          type="button"
          className={controls.button}
          disabled={!on}
          data-ok={copy.kind === 'ok' && copy.which === 'prompt' ? '' : undefined}
          onClick={() => text !== null && doCopy('prompt', text)}
        >
          {okButton('prompt', t.chart.copyPrompt)}
        </button>
        <button
          type="button"
          className={controls.ghost}
          disabled={!on}
          data-ok={copy.kind === 'ok' && copy.which === 'link' ? '' : undefined}
          onClick={() => doCopy('link', location.href)}
        >
          {okButton('link', t.chart.copyLink)}
        </button>
      </div>
      <div className={css.message} role="status">
        {message}
      </div>
      <nav className={css.ai} aria-label={t.chart.openAi}>
        {CHAT_AIS.map((a) => (
          <a key={a.href} className={css.aiLink} href={a.href} target="_blank" rel="noopener">
            {a[lang]}
          </a>
        ))}
      </nav>
    </section>
  );
}
