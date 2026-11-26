import { useRef, useState } from 'react';
import { Checkbox, TextArea } from 'react-aria-components';
import * as controls from '../components/controls.css';
import { CheckIcon } from '../components/icons';
import type { Lang } from '../i18n/lang';
import { fmt, type Messages } from '../i18n/messages';
import type { PromptChoice } from '../prompt/sections';
import * as css from './chart-page.css';
import { PromptFull } from './prompt-full';
import { useCopy } from './use-copy';

/** 提示词可以粘贴到的聊天 AI。 */
const CHAT_AIS = [
  { href: 'https://chat.deepseek.com/', zh: 'DeepSeek', en: 'DeepSeek' },
  { href: 'https://www.doubao.com/chat/', zh: '豆包', en: 'Doubao' },
  { href: 'https://www.kimi.com/', zh: 'Kimi', en: 'Kimi' },
  { href: 'https://chatgpt.com/', zh: 'ChatGPT', en: 'ChatGPT' },
  { href: 'https://claude.ai/new', zh: 'Claude', en: 'Claude' },
] as const;

const len = (text: string, lang: Lang) => [...text].length.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en');

/**
 * 提示词页签（设计规范 21.5）：勾选盘面各段、写问题；一行写会发送哪些段与释义按哪套；「查看全文」打开全屏阅读视图，
 * 「复制提示词」复制原文；复制这张盘的链接；常用聊天 AI 的入口。`text` 为 null 时（还没有盘）整块不可用，概要行写 `emptyText`。
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
  knowLabel,
}: {
  t: Messages;
  lang: Lang;
  text: string | null;
  emptyText: string;
  choice: PromptChoice;
  onChoice: (next: PromptChoice) => void;
  /** 「2026 年运限」：年份在浏览器里求得。 */
  yearLabel: string;
  /** 「2022–2031 流年」。 */
  yearsLabel: string;
  question: string;
  onQuestion: (q: string) => void;
  /** 原文里「我的问题」一节的标题行，用于原文视图着色。 */
  questionHeading: string;
  /** 释义所按的组合名；还没有盘时为 null。 */
  knowLabel: string | null;
}) {
  const { copy, run } = useCopy();
  const [full, setFull] = useState(false);
  const fullButton = useRef<HTMLButtonElement>(null);
  const on = text !== null;

  const checks: { key: keyof PromptChoice; label: string }[] = [
    { key: 'natal', label: t.chart.checks.natal },
    { key: 'know', label: t.chart.checks.know },
    { key: 'year', label: yearLabel },
    { key: 'decades', label: t.chart.checks.decades },
    { key: 'years', label: yearsLabel },
  ];
  const parts = [
    t.chart.sendsMethod,
    ...checks.filter((c) => c.key !== 'know' && choice[c.key]).map((c) => c.label),
    t.chart.sendsQuestion,
  ];
  const sends = on
    ? fmt(t.chart.sends, { parts: parts.join(t.read.starsSep), know: choice.know && knowLabel ? fmt(t.chart.sendsKnow, { label: knowLabel }) : '' })
    : emptyText;
  const message =
    copy.kind === 'failed'
      ? t.chart.copyFailed
      : copy.kind === 'ok'
        ? copy.which === 'prompt'
          ? fmt(t.chart.promptCopied, { n: len(text ?? '', lang) })
          : t.chart.linkCopied
        : '';
  const copied = copy.kind === 'ok' && copy.which === 'prompt';

  return (
    <div className={css.prompt}>
      <p className={css.head}>{t.chat.promptAux}</p>
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
      <p className={css.sends}>{sends}</p>
      <div className={css.actions}>
        <button ref={fullButton} type="button" className={controls.ghost} disabled={!on} onClick={() => setFull(true)}>
          {t.chart.viewFull}
          {on && <span className={css.count}>{fmt(t.chart.count, { n: len(text, lang) })}</span>}
        </button>
        <button type="button" className={controls.button} disabled={!on} data-ok={copied ? '' : undefined} onClick={() => text !== null && run('prompt', text)}>
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
      <div className={css.message} role="status">
        {message}
      </div>
      <button
        type="button"
        className={css.linkButton}
        disabled={!on}
        data-ok={copy.kind === 'ok' && copy.which === 'link' ? '' : undefined}
        onClick={() => run('link', location.href)}
      >
        {copy.kind === 'ok' && copy.which === 'link' ? t.chart.copied : t.chart.copyLinkText}
      </button>
      <nav className={css.ai} aria-label={t.chart.openAi}>
        {CHAT_AIS.map((a) => (
          <a key={a.href} className={css.aiLink} href={a.href} target="_blank" rel="noopener noreferrer">
            {a[lang]}
          </a>
        ))}
      </nav>
      {full && text !== null && (
        <PromptFull
          t={t}
          lang={lang}
          text={text}
          questionHeading={questionHeading}
          onClose={() => {
            setFull(false);
            fullButton.current?.focus();
          }}
        />
      )}
    </div>
  );
}
