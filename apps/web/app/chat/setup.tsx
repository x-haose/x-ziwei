import { useId, useState } from 'react';
import { Radio, RadioGroup } from 'react-aria-components';
import { type GridOption, OptionGrid, Picker } from '../birth/picker';
import * as pickerCss from '../birth/picker.css';
import * as controls from '../components/controls.css';
import { LockIcon } from '../components/icons';
import { useToast } from '../components/toast';
import { fmt, type Messages } from '../i18n/messages';
import * as css from './chat.css';
import {
  type ChatSettings,
  PROVIDERS,
  PROVIDER_IDS,
  type ProviderId,
  checkBaseUrl,
  defaultModel,
  hostOf,
  listModels,
  maskKey,
} from './providers';
import { type SetupDraft, saveSettings, serviceName, updateSetup, useChatSession } from './session';

type Result = SetupDraft['result'];

/** 服务的显示名：兼容服务用文案。 */
function providerName(p: ProviderId, t: Messages): string {
  return PROVIDERS[p].name ?? t.chat.setup.compatName;
}

/**
 * 服务、Key 与模型的设置表单（设计规范 19.7）。检查用厂商的模型列表接口：连通即保存（模型取第一个支持工具调用的），
 * 401 / 403 与连不上不保存，429 先保存（Key 有效）、取到列表之前不能对话。Key 只存在这台设备的浏览器里。
 * `settings` 为已存的设置；Key 留空时若服务与 Base URL 没变，用已存的 Key 再检查一次（刷新模型列表）。
 */
export function SetupForm({
  t,
  settings,
  intro,
  autoFocus = false,
  onUsePrompt,
}: {
  t: Messages;
  settings: ChatSettings | null;
  intro: boolean;
  /** 打开即把焦点放在 Key 输入框（全屏面板里未设 Key 时）。 */
  autoFocus?: boolean;
  onUsePrompt: () => void;
}) {
  const s = t.chat.setup;
  const toast = useToast();
  const draft = useChatSession().setup;
  const provider = draft.provider ?? settings?.provider ?? 'deepseek';
  const baseURL = draft.baseURL ?? settings?.baseURL ?? '';
  const { key, show, result, urlError, keyError } = draft;
  const setResult = (r: Result) => updateSetup({ result: r });
  const urlId = useId();
  const keyId = useId();
  const busy = result.kind === 'checking';

  const check = async () => {
    updateSetup({ urlError: null, keyError: null });
    let url: string | null = null;
    if (provider === 'compatible') {
      const c = checkBaseUrl(baseURL);
      if (!c.ok) {
        updateSetup({ urlError: c.problem === 'empty' ? s.baseUrlEmpty : c.problem === 'invalid' ? s.baseUrlInvalid : s.baseUrlNotHttps });
        return;
      }
      url = c.url;
    }
    const same = settings !== null && settings.provider === provider && settings.baseURL === url;
    const useKey = key.trim() || (same ? settings.key : '');
    if (!useKey) {
      updateSetup({ keyError: s.keyEmpty });
      return;
    }
    const target = { provider, key: useKey, baseURL: url };
    const service = PROVIDERS[provider].name ?? s.compatService;
    setResult({ kind: 'checking', host: hostOf(target) });
    const r = await listModels(target);
    try {
      if (r.ok) {
        if (r.models.length === 0) {
          setResult({ kind: 'bad', text: s.noModels });
          return;
        }
        const model = same && r.models.some((m) => m.id === settings.model) ? settings.model : defaultModel(r.models);
        await saveSettings({ ...target, model, models: r.models });
        updateSetup({ key: '', provider: null, baseURL: null });
        const info = r.models.find((m) => m.id === model);
        setResult({ kind: 'ok', text: info?.tools ? fmt(s.ok, { n: r.models.length, model }) : fmt(s.okUnknown, { n: r.models.length }) });
        return;
      }
      if (r.status === 401 || r.status === 403) setResult({ kind: 'bad', text: fmt(s.auth, { status: r.status, service }) });
      else if (r.status === 429) {
        await saveSettings({ ...target, model: '', models: [] });
        updateSetup({ key: '', provider: null, baseURL: null });
        setResult({ kind: 'bad', text: fmt(s.rate, { service }) });
      } else if (r.status === null) setResult({ kind: 'bad', text: s.network });
      else setResult({ kind: 'bad', text: fmt(s.other, { service, status: r.status, detail: r.detail ?? '' }) });
    } catch (err) {
      console.error(err);
      setResult({ kind: 'bad', text: fmt(t.chat.saveFailed, { reason: err instanceof Error ? err.message : String(err) }) });
    }
  };

  const service = provider === 'compatible' ? null : providerName(provider, t);
  return (
    <div className={css.setup}>
      {intro && (
        <>
          <h3 className={css.setupTitle}>{s.title}</h3>
          <p className={css.setupBody}>{s.body}</p>
        </>
      )}
      <form
        className={css.form}
        onSubmit={(e) => {
          e.preventDefault();
          void check();
        }}
      >
        <RadioGroup
          value={provider}
          onChange={(v) => updateSetup({ provider: v as ProviderId, result: { kind: 'idle' } })}
          aria-label={s.service}
        >
          <span className={css.fieldLabel}>{s.service}</span>
          <div className={css.providers}>
            {PROVIDER_IDS.map((p) => (
              <Radio key={p} value={p} className={css.provider}>
                <i className={css.providerDot} aria-hidden="true" />
                <b className={css.providerName}>{providerName(p, t)}</b>
                <small className={css.providerHost}>{p === 'compatible' ? s.compatHint : new URL(PROVIDERS[p].baseURL!).host}</small>
              </Radio>
            ))}
          </div>
        </RadioGroup>
        {provider === 'compatible' && (
          <div>
            <label className={css.fieldLabel} htmlFor={`${urlId}-input`}>
              {s.baseUrl}
            </label>
            <input
              id={`${urlId}-input`}
              className={css.textInput}
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder={s.baseUrlPlaceholder}
              value={baseURL}
              aria-invalid={urlError ? true : undefined}
              aria-describedby={urlError ? urlId : undefined}
              onChange={(e) => updateSetup({ baseURL: e.target.value })}
            />
            {urlError && (
              <p id={urlId} className={css.fieldError}>
                {urlError}
              </p>
            )}
          </div>
        )}
        {settings && (
          <div className={css.saved}>
            <span>
              {s.saved}
              <b className={css.savedKey}>{maskKey(settings.key)}</b>
            </span>
            <button
              type="button"
              className={css.textButton}
              onClick={() =>
                saveSettings(null).then(
                  () => toast(s.keyDeleted),
                  (err: unknown) => {
                    console.error(err);
                    toast(fmt(t.chat.saveFailed, { reason: err instanceof Error ? err.message : String(err) }));
                  },
                )
              }
            >
              {s.deleteKey}
            </button>
          </div>
        )}
        <div>
          <label className={css.fieldLabel} htmlFor={`${keyId}-input`}>
            {settings ? s.keyChange : s.key}
          </label>
          <div className={css.keyRow}>
            <input
              id={`${keyId}-input`}
              className={css.keyInput}
              type={show ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              placeholder={PROVIDERS[provider].keyHint}
              autoFocus={autoFocus}
              value={key}
              aria-invalid={keyError ? true : undefined}
              aria-describedby={keyError ? keyId : undefined}
              onChange={(e) => updateSetup({ key: e.target.value })}
            />
            <button type="button" className={css.keyToggle} aria-pressed={show} onClick={() => updateSetup({ show: !show })}>
              {show ? s.hide : s.show}
            </button>
          </div>
          {keyError && (
            <p id={keyId} className={css.fieldError}>
              {keyError}
            </p>
          )}
        </div>
        <div className={css.formActions}>
          <button type="submit" className={controls.button} disabled={busy}>
            {s.check}
          </button>
          <button type="button" className={controls.ghost} onClick={onUsePrompt}>
            {s.usePrompt}
          </button>
        </div>
        <div aria-live="polite">
          {result.kind === 'checking' && (
            <p className={css.result}>
              <span className={css.resultRun} aria-hidden="true" />
              {fmt(s.checking, { host: result.host })}
            </p>
          )}
          {result.kind === 'ok' && <p className={`${css.result} ${css.resultOk}`}>{result.text}</p>}
          {result.kind === 'bad' && <p className={`${css.result} ${css.resultBad}`}>{result.text}</p>}
        </div>
        <p className={css.privacy}>
          <LockIcon />
          <span>
            <b className={css.privacyLead}>{s.privacyLead}</b>
            {service ? fmt(s.privacy, { service }) : s.privacyCompat}
          </span>
        </p>
      </form>
    </div>
  );
}

/**
 * 模型选择器（设计规范 19.7）：列表取自所选服务的模型接口，每项写能否查盘；底部「换服务或 Key」打开设置。
 * 还没取到列表时（检查时被限流）可以重新取。
 */
export function ModelPicker({
  t,
  settings,
  onPick,
  onSettings,
  inSheet,
}: {
  t: Messages;
  settings: ChatSettings;
  onPick: (model: string) => void;
  onSettings: () => void;
  inSheet: boolean;
}) {
  const p = t.chat.picker;
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const service = serviceName(settings, t);
  const options: GridOption<string>[] = settings.models.map((m) => {
    const tag = m.tools === true ? p.tools : m.tools === false ? p.noTools : p.unknown;
    return {
      key: m.id,
      text: m.id,
      label: `${m.id}，${tag}`,
      content: (
        <>
          <b className={pickerCss.optionMain}>{m.id}</b>
          <small className={css.pickTag}>{tag}</small>
        </>
      ),
    };
  });
  const refresh = async () => {
    setRefreshing(true);
    try {
      const r = await listModels(settings);
      if (!r.ok) {
        toast(r.status === null ? t.chat.setup.network : fmt(t.chat.setup.other, { service, status: r.status, detail: r.detail ?? '' }));
        return;
      }
      await saveSettings({ ...settings, models: r.models, model: settings.model || defaultModel(r.models) });
    } catch (err) {
      console.error(err);
      toast(fmt(t.chat.saveFailed, { reason: err instanceof Error ? err.message : String(err) }));
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <Picker
      label={t.chat.modelPicker}
      title={t.chat.modelPicker}
      value={
        <>
          <span className={css.pickService}>{service}</span>
          <span className={css.pickModel}>{settings.model || p.noModel}</span>
        </>
      }
      placeholder={p.noModel}
      width={320}
      triggerClass={inSheet ? `${css.pick} ${css.pickSheet}` : css.pick}
    >
      {(close) => (
        <>
          <p className={css.pickNote}>{fmt(p.note, { service })}</p>
          {options.length > 0 ? (
            <OptionGrid
              label={t.chat.modelPicker}
              columns={1}
              row
              autoFocus
              options={options}
              selected={settings.model || null}
              onSelect={(m) => {
                close();
                if (m !== settings.model) onPick(m);
              }}
            />
          ) : (
            <p className={css.pickNote}>
              {p.empty}
              <button type="button" className={css.textButton} disabled={refreshing} onClick={() => void refresh()}>
                {refreshing ? p.refreshing : p.refresh}
              </button>
            </p>
          )}
          <button
            type="button"
            className={css.pickLink}
            onClick={() => {
              close();
              onSettings();
            }}
          >
            {p.change}
          </button>
        </>
      )}
    </Picker>
  );
}
