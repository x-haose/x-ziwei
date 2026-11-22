import { useEffect, useRef, useState } from 'react';
import { Checkbox, TextArea } from 'react-aria-components';
import { useLocation, useNavigate } from 'react-router';
import { BirthForm } from '../birth/birth-form';
import { type Birth, EMPTY_DRAFT, decodeBirth, draftOf, encodeBirth } from '../birth/birth';
import type { LunarCalendar } from '../birth/calendar';
import { birthSummary } from '../birth/labels';
import { type RecentState, pushRecent, removeRecent, useRecent } from '../birth/recent';
import * as controls from '../components/controls.css';
import { CloseIcon } from '../components/icons';
import { Segmented } from '../components/segmented';
import { useToast } from '../components/toast';
import { HTML_LANG } from '../i18n/lang';
import type { Messages } from '../i18n/messages';
import { useLang, useMessages } from '../i18n/use-lang';
import { useHydrated } from '../lib/media';
import { EmptyBoard } from './board';
import * as css from './chart-page.css';

/** 排盘内核提供的农历能力。应用里还没有排盘内核，为空。 */
const LUNAR: LunarCalendar | null = null;

/** 提示词可以粘贴到的聊天 AI。 */
const CHAT_AIS = [
  { href: 'https://chat.deepseek.com/', zh: 'DeepSeek', en: 'DeepSeek' },
  { href: 'https://www.doubao.com/chat/', zh: '豆包', en: 'Doubao' },
  { href: 'https://www.kimi.com/', zh: 'Kimi', en: 'Kimi' },
  { href: 'https://chatgpt.com/', zh: 'ChatGPT', en: 'ChatGPT' },
  { href: 'https://claude.ai/new', zh: 'Claude', en: 'Claude' },
] as const;

/**
 * 地址 `#` 之后的生辰。预渲染的 HTML 里没有 `#`，水合那一次也按没有处理，水合后再读真实地址，
 * 否则首帧会与预渲染的 HTML 对不上。
 */
function useBirthHash(): string {
  const { hash } = useLocation();
  return useHydrated() ? hash : '';
}

function RecentList({ state, onOpen, t }: { state: RecentState | null; onOpen: (hash: string) => void; t: Messages }) {
  const lang = useLang();
  const toast = useToast();
  return (
    <div className={css.recent}>
      <h3 className={css.recentTitle}>{t.form.recent}</h3>
      {state?.kind === 'unavailable' && <p className={css.recentNone}>{t.form.recentUnavailable}</p>}
      {state?.kind === 'corrupt' && <p className={css.recentNone}>{t.form.recentCorrupt}</p>}
      {state?.kind === 'ok' && state.items.length === 0 && <p className={css.recentNone}>{t.form.recentNone}</p>}
      {state?.kind === 'ok' && state.items.length > 0 && (
        <ul>
          {state.items.map((item) => {
            const s = birthSummary(t, item.birth);
            return (
              <li key={item.hash} className={css.recentRow}>
                <button type="button" className={css.recentGo} onClick={() => onOpen(item.hash)}>
                  <b className={css.recentBirth}>{`${s.date} ${s.time}`}</b>
                  <small className={css.recentMeta}>{`${s.gender}　${new Date(item.ts).toLocaleDateString(HTML_LANG[lang])}`}</small>
                </button>
                <button
                  type="button"
                  className={css.recentDelete}
                  aria-label={t.form.recentDelete}
                  onClick={() => {
                    if (!removeRecent(item.hash, state)) toast(t.form.recentUnavailable);
                  }}
                >
                  <CloseIcon />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** 提示词区：排盘之前除预览方式外整块禁用，预览框写明排盘后在这里生成。 */
function PromptPanel({ t, lang }: { t: Messages; lang: 'zh' | 'en' }) {
  const [mode, setMode] = useState<'md' | 'raw'>('md');
  const checks = [t.chart.checks.natal, t.chart.checks.know, t.chart.checks.year, t.chart.checks.decades];
  return (
    <section className={`${css.prompt} ${css.promptEmpty}`} aria-label={t.chart.prompt}>
      <div className={css.head}>
        <h2 className={css.headTitle}>{t.chart.prompt}</h2>
        <span className={css.headAux}>{t.chart.promptAux}</span>
      </div>
      <div className={css.checks}>
        {checks.map((label, i) => (
          <Checkbox key={label} className={css.check} isDisabled defaultSelected={i < 3}>
            <span className={css.checkBox} aria-hidden="true" />
            {label}
          </Checkbox>
        ))}
      </div>
      <div className={css.ask}>
        <TextArea className={css.textarea} aria-label={t.chart.ask} placeholder={t.chart.askPlaceholder} disabled />
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
        <span />
      </div>
      <div className={`${css.preview} ${css.previewOff}`} role="region" aria-label={t.chart.previewRegion}>
        {t.chart.previewEmpty}
      </div>
      <div className={css.actions}>
        <button type="button" className={controls.button} disabled>
          {t.chart.copyPrompt}
        </button>
        <button type="button" className={controls.ghost} disabled>
          {t.chart.copyLink}
        </button>
      </div>
      <div className={css.message} role="status" />
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

/**
 * 排盘页。生辰在地址 `#` 之后（不发给服务器），表单据此预填；提交后写进地址并记进本机的「最近排过」。
 * 盘面、运限、读数与提示词由排盘内核驱动；应用里还没有排盘内核，盘区是空状态。
 */
export function ChartPage() {
  const t = useMessages();
  const lang = useLang();
  const toast = useToast();
  const navigate = useNavigate();
  const hash = useBirthHash();
  const recent = useRecent(LUNAR);
  const decoded = decodeBirth(hash, LUNAR);
  const reported = useRef('');

  useEffect(() => {
    if (reported.current === hash) return;
    reported.current = hash;
    if (decoded.kind === 'invalid') toast(t.chart.badHash);
    if (decoded.kind === 'unsupported') toast(t.form.lunarUnavailable);
  }, [hash, decoded.kind, toast, t]);

  const open = (birth: Birth) => {
    if (recent && !pushRecent(birth, recent, Date.now())) toast(t.form.recentUnsaved);
    navigate({ hash: encodeBirth(birth) }, { replace: true, preventScrollReset: true });
  };

  return (
    <main className={css.page}>
      <section className={css.birth} aria-label={t.chart.birth}>
        <BirthForm key={hash} initial={decoded.kind === 'ok' ? draftOf(decoded.birth) : EMPTY_DRAFT} lunar={LUNAR} onSubmit={open} />
        <RecentList
          state={recent}
          t={t}
          onOpen={(h) => navigate({ hash: h }, { replace: true, preventScrollReset: true })}
        />
      </section>
      <EmptyBoard className={css.board} title={t.chart.empty} hint={{ wide: t.chart.emptyHintSide, narrow: t.chart.emptyHintTop }} />
      <PromptPanel t={t} lang={lang} />
    </main>
  );
}
