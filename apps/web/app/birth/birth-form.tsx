import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import * as controls from '../components/controls.css';
import { Segmented } from '../components/segmented';
import { fmt } from '../i18n/messages';
import { useMessages } from '../i18n/use-lang';
import {
  type Birth,
  type BirthDraft,
  type BirthErrors,
  type BirthField,
  type CalendarKind,
  FIELD_ORDER,
  type Gender,
  PERIODS,
  validateBirth,
} from './birth';
import * as css from './birth-form.css';
import type { LunarCalendar } from './calendar';
import { candidatesText, errorText, lunarDateText, solarDateText } from './labels';
import { DayPicker, HourPicker, MonthPicker, YearPicker } from './pickers';

/** 年月日完整且合法时返回它们（时辰与性别不参与判断），否则 null。 */
function validDate(draft: BirthDraft, lunar: LunarCalendar | null): Pick<Birth, 'year' | 'month' | 'leap' | 'day'> | null {
  const r = validateBirth({ ...draft, time: { kind: 'hour', index: 0 }, gender: 'f' }, lunar);
  return 'birth' in r ? r.birth : null;
}

/**
 * 换历法：日期合法且有农历能力时把已填日期换算过去，不清空；
 * 日期不完整或不合法时只换历法，已填的年月日照留。
 */
function switchCalendar(draft: BirthDraft, cal: CalendarKind, lunar: LunarCalendar | null): BirthDraft {
  if (cal === draft.cal) return draft;
  const date = validDate(draft, lunar);
  if (!lunar || !date) return { ...draft, cal, leap: false };
  if (cal === 'lunar') {
    const l = lunar.toLunar(date);
    return { ...draft, cal, year: l.year, month: l.month, leap: l.leap, day: l.day };
  }
  const s = lunar.toSolar(date);
  if (!s) throw new Error('合法的农历日期换算不出公历日期');
  return { ...draft, cal, year: s.year, month: s.month, leap: false, day: s.day };
}

/**
 * 生辰表单（设计规范第 11 节）：历法、年月日、时辰、性别，全部是自绘控件。
 *
 * 字段被碰过才显示它的错误；提交时显示全部，并把焦点移到第一个出错的字段。
 * 全部合法时把生辰交给 `onSubmit`。
 */
export function BirthForm({
  initial,
  lunar,
  onSubmit,
}: {
  initial: BirthDraft;
  /** 排盘内核提供的农历能力；为空时农历选项不可用。 */
  lunar: LunarCalendar | null;
  onSubmit: (birth: Birth) => void;
}) {
  const t = useMessages();
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState(initial);
  const [touched, setTouched] = useState<ReadonlySet<BirthField>>(new Set());
  const [submitted, setSubmitted] = useState(0);

  const result = validateBirth(draft, lunar);
  const allErrors: BirthErrors = 'errors' in result ? result.errors : {};
  const shown = (f: BirthField) => (submitted > 0 || touched.has(f) ? allErrors[f] : undefined);
  const errorId = (f: BirthField) => (shown(f) ? `${id}-${f}` : undefined);

  useEffect(() => {
    if (submitted === 0) return;
    const first = FIELD_ORDER.find((f) => allErrors[f]);
    if (!first) return;
    const target = formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"] button:not([disabled])`);
    if (!target) throw new Error(`出错的字段 ${first} 没有可聚焦的控件`);
    target.focus();
  }, [submitted]);

  /** 改了某个字段；改年、月会让已选的日失效（如三十落进小月），日已选过时连带检查日。 */
  const update = (patch: Partial<BirthDraft>, fields: BirthField[]) => {
    setDraft((d) => ({ ...d, ...patch }));
    setTouched((s) => {
      const next = new Set(s);
      for (const f of fields) next.add(f);
      if ((fields.includes('year') || fields.includes('month')) && draft.day !== null) next.add('day');
      return next;
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if ('birth' in result) {
      onSubmit(result.birth);
      return;
    }
    setSubmitted((n) => n + 1);
  };

  const err = (f: BirthField) => {
    const e = shown(f);
    return e ? (
      <p className={controls.error} id={`${id}-${f}`}>
        {errorText(t, e, f)}
      </p>
    ) : null;
  };

  const conversion = (() => {
    const date = validDate(draft, lunar);
    if (!lunar || !date) return null;
    if (draft.cal === 'solar') {
      const l = lunar.toLunar(date);
      return { label: t.form.toLunar, date: lunarDateText(t, l.year, l.month, l.leap, l.day) };
    }
    const s = lunar.toSolar(date);
    if (!s) throw new Error('合法的农历日期换算不出公历日期');
    return { label: t.form.toSolar, date: solarDateText(t, s.year, s.month, s.day) };
  })();

  const time = draft.time;
  return (
    <form ref={formRef} className={css.form} noValidate onSubmit={submit}>
      <div className={css.field}>
        <span className={controls.fieldLabel}>{t.form.calendar}</span>
        <Segmented<CalendarKind>
          label={t.form.calendar}
          value={draft.cal}
          options={[
            { value: 'solar', label: t.form.solar },
            lunar ? { value: 'lunar', label: t.form.lunar } : { value: 'lunar', label: t.form.lunar, disabledReason: t.form.lunarUnavailable },
          ]}
          onChange={(cal) => setDraft((d) => switchCalendar(d, cal, lunar))}
        />
      </div>

      <div className={css.field}>
        <span className={controls.fieldLabel}>{t.form.date}</span>
        <div className={css.ymd}>
          <div data-field="year">
            <YearPicker value={draft.year} lunar={lunar} errorId={errorId('year')} onChange={(year) => update({ year }, ['year'])} />
          </div>
          <div data-field="month">
            <MonthPicker
              cal={draft.cal}
              year={draft.year}
              month={draft.month}
              leap={draft.leap}
              lunar={lunar}
              errorId={errorId('month')}
              onChange={(month, leap) => update({ month, leap }, ['month'])}
            />
          </div>
          <div data-field="day">
            <DayPicker
              cal={draft.cal}
              year={draft.year}
              month={draft.month}
              leap={draft.leap}
              day={draft.day}
              lunar={lunar}
              errorId={errorId('day')}
              onChange={(day) => update({ day }, ['day'])}
            />
          </div>
        </div>
        {err('year')}
        {err('month')}
        {err('day')}
        <p className={css.conv} aria-live="polite">
          {conversion && (
            <>
              {conversion.label} <b className={css.convValue}>{conversion.date}</b>
            </>
          )}
        </p>
      </div>

      <div className={css.field} data-field="time">
        <span className={controls.fieldLabel}>{t.form.hour}</span>
        <HourPicker value={time} errorId={errorId('time')} onChange={(next) => update({ time: next }, ['time'])} />
        {time?.kind === 'period' && (
          <p className={css.conv}>
            {fmt(t.form.approxNote, { n: PERIODS[time.period].hours.length, hours: candidatesText(t, time.period) })}
          </p>
        )}
        {err('time')}
      </div>

      <div className={css.field} data-field="gender">
        <span className={controls.fieldLabel}>{t.form.gender}</span>
        <Segmented<Gender>
          label={t.form.gender}
          value={draft.gender}
          options={[
            { value: 'f', label: t.form.female },
            { value: 'm', label: t.form.male },
          ]}
          onChange={(gender) => update({ gender }, ['gender'])}
        />
        {err('gender')}
      </div>

      <button className={controls.button} type="submit">
        {t.form.submit}
      </button>
    </form>
  );
}
