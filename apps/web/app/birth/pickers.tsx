import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Button } from 'react-aria-components';
import { CaretIcon } from '../components/icons';
import { fmt } from '../i18n/messages';
import { useMessages } from '../i18n/use-lang';
import { type BirthTime, PERIOD_KEYS, PERIODS, type Period, periodTime } from './birth';
import { type LunarCalendar, YEAR_MIN, solarDaysInMonth, solarFirstWeekday } from './calendar';
import { hourName, hourRange, lunarDayName, lunarMonthName, lunarYearName, periodName } from './labels';
import { type GridOption, OptionGrid, Picker } from './picker';
import * as css from './picker.css';
import { DECADE_COUNT, NO_TYPING, type YearTyping, decadeOf, typeYearDigit, yearsOfDecade } from './year-typing';

/** 年份弹层未选过年份时打开的年代。 */
const DEFAULT_YEAR = 1990;

/** 打开年份弹层时的年代页：所选年份所在的年代；没选或不在可排范围内时为缺省年代。 */
function startPage(value: number | null): number {
  const page = decadeOf(value ?? DEFAULT_YEAR) ?? decadeOf(DEFAULT_YEAR);
  if (page === null) throw new Error('缺省年份不在可排范围内');
  return page;
}

/**
 * 出生年份：每页一个年代的 10 年（5 列）；点页头切到年代总览（21 格，3 列），选了年代回到该年代。
 * 弹层打开时直接键入数字即跳转：3 位跳到年代，4 位把焦点落到该年，回车确认。
 */
export function YearPicker({
  value,
  lunar,
  onChange,
  errorId,
}: {
  value: number | null;
  /** 有农历能力时，每个年份下方写该年干支。 */
  lunar: LunarCalendar | null;
  onChange: (year: number) => void;
  errorId?: string | undefined;
}) {
  const t = useMessages();
  const [mode, setMode] = useState<'years' | 'decades'>('years');
  const [page, setPage] = useState(() => startPage(value));
  const [typing, setTyping] = useState<YearTyping>(NO_TYPING);
  const [focusYear, setFocusYear] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusYear === null) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-key="${focusYear}"]`);
    if (!el) throw new Error(`年份 ${focusYear} 不在当前页`);
    el.focus();
    setFocusYear(null);
  }, [focusYear]);

  const onKeys = (e: KeyboardEvent) => {
    if (!/^\d$/.test(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    const next = typeYearDigit(typing, e.key, Date.now());
    setTyping(next.state);
    if (next.page !== null) {
      setMode('years');
      setPage(next.page);
    }
    if (next.focus !== null) setFocusYear(next.focus);
  };

  const first = YEAR_MIN + page * 10;
  const header =
    mode === 'decades' ? (
      t.picker.decades
    ) : (
      <Button className={css.headSwitch} aria-label={fmt(t.picker.decadeSwitch, { a: first })} onPress={() => setMode('decades')}>
        {fmt(t.picker.decade, { a: first })}
        <span className={css.headSwitchCaret}>
          <CaretIcon />
        </span>
      </Button>
    );

  return (
    <Picker
      label={t.form.year}
      title={t.picker.yearTitle}
      value={value === null ? null : String(value)}
      placeholder={t.form.yearPh}
      errorId={errorId}
      width={300}
      header={header}
      paging={
        mode === 'years'
          ? {
              canPrev: page > 0,
              canNext: page < DECADE_COUNT - 1,
              onPrev: () => setPage((p) => p - 1),
              onNext: () => setPage((p) => p + 1),
            }
          : undefined
      }
      onKeyDownCapture={onKeys}
      onOpenChange={(open) => {
        if (!open) return;
        setMode('years');
        setPage(startPage(value));
        setTyping(NO_TYPING);
      }}
    >
      {(close) => (
        <>
          <p className={css.note} aria-live="polite">
            {typing.typed ? (
              <>
                {t.picker.typed}
                <b className={css.noteTyped}>{typing.typed.padEnd(4, '_')}</b>
              </>
            ) : (
              t.picker.typeHint
            )}
          </p>
          {mode === 'decades' ? (
            <OptionGrid
              key="decades"
              label={t.picker.decadesList}
              columns={3}
              autoFocus
              options={Array.from({ length: DECADE_COUNT }, (_, k) => {
                const a = YEAR_MIN + k * 10;
                const years = yearsOfDecade(k);
                const text = years.length > 1 ? `${a}–${years.at(-1)}` : String(a);
                return { key: k, text, content: <b className={css.optionNumber}>{text}</b> };
              })}
              selected={value === null ? null : decadeOf(value)}
              onSelect={(k) => {
                setPage(k);
                setMode('years');
              }}
            />
          ) : (
            <OptionGrid
              key={`years-${page}`}
              listRef={listRef}
              label={fmt(t.picker.yearsList, { a: first })}
              columns={5}
              autoFocus
              options={yearsOfDecade(page).map((y) => ({
                key: y,
                text: String(y),
                content: (
                  <>
                    <b className={css.optionNumber}>{y}</b>
                    {lunar && <small className={css.optionNote}>{lunar.yearGanzhi(y)}</small>}
                  </>
                ),
              }))}
              selected={value}
              onSelect={(y) => {
                onChange(y);
                close();
              }}
            />
          )}
        </>
      )}
    </Picker>
  );
}

/**
 * 出生月份。公历 12 格（年已选时写当月天数）；农历按该年的实际月份列出，
 * 闰月作为单独一格紧跟在本月之后，上方注明该年的闰月。
 */
export function MonthPicker({
  cal,
  year,
  month,
  leap,
  lunar,
  onChange,
  errorId,
}: {
  cal: 'solar' | 'lunar';
  year: number | null;
  month: number | null;
  leap: boolean;
  lunar: LunarCalendar | null;
  onChange: (month: number, leap: boolean) => void;
  errorId?: string | undefined;
}) {
  const t = useMessages();
  const isLunar = cal === 'lunar';
  if (isLunar && !lunar) throw new Error('没有农历能力时不能打开农历月份');
  const months =
    isLunar && lunar && year !== null
      ? lunar.months(year)
      : Array.from({ length: 12 }, (_, k) => ({ month: k + 1, leap: false, days: year !== null && !isLunar ? solarDaysInMonth(year, k + 1) : null }));
  const leapMonth = isLunar && year !== null ? months.find((m) => m.leap) : undefined;
  const keyOf = (m: number, l: boolean) => `${m}${l ? 'L' : ''}`;
  const label = (m: number, l: boolean) => (isLunar ? lunarMonthName(t, m, l) : fmt(t.picker.monthSolar, { m }));
  const options: GridOption<string>[] = months.map((m) => ({
    key: keyOf(m.month, m.leap),
    text: label(m.month, m.leap),
    content: (
      <>
        <b className={css.optionMain}>{label(m.month, m.leap)}</b>
        {m.days !== null && <small className={css.optionNote}>{fmt(t.picker.days, { n: m.days })}</small>}
      </>
    ),
  }));
  const title = isLunar ? (year !== null ? fmt(t.picker.lunarMonthTitleYear, { y: year }) : t.picker.lunarMonthTitle) : t.picker.monthTitle;
  return (
    <Picker
      label={t.form.month}
      title={title}
      value={month === null ? null : label(month, leap)}
      placeholder={t.form.monthPh}
      errorId={errorId}
      width={300}
    >
      {(close) => (
        <>
          {leapMonth && year !== null && (
            <p className={css.note}>{fmt(t.picker.leapNote, { y: year, month: lunarMonthName(t, leapMonth.month, false) })}</p>
          )}
          <OptionGrid
            label={t.picker.monthsList}
            columns={4}
            autoFocus
            options={options}
            selected={month === null ? null : keyOf(month, leap)}
            onSelect={(key) => {
              const m = months.find((x) => keyOf(x.month, x.leap) === key);
              if (!m) throw new Error(`月份不在列表里：${key}`);
              onChange(m.month, m.leap);
              close();
            }}
          />
        </>
      )}
    </Picker>
  );
}

/**
 * 出生日。公历是按星期排的月历（周一起，首日前留空）；农历是初一到三十的五列网格，
 * 小月的三十不可选并注明原因。年月没选时不可用。
 */
export function DayPicker({
  cal,
  year,
  month,
  leap,
  day,
  lunar,
  onChange,
  errorId,
}: {
  cal: 'solar' | 'lunar';
  year: number | null;
  month: number | null;
  leap: boolean;
  day: number | null;
  lunar: LunarCalendar | null;
  onChange: (day: number) => void;
  errorId?: string | undefined;
}) {
  const t = useMessages();
  const ready = year !== null && month !== null;
  const isLunar = cal === 'lunar';
  const display = day === null ? null : isLunar ? lunarDayName(t, day) : String(day);
  if (!ready) {
    return (
      <Picker label={t.form.day} title={t.form.day} value={display} placeholder={t.form.dayPh} isDisabled width={300} errorId={errorId}>
        {() => null}
      </Picker>
    );
  }
  if (isLunar) {
    if (!lunar) throw new Error('没有农历能力时不能打开农历日');
    const m = lunar.months(year).find((x) => x.month === month && x.leap === leap);
    if (!m) {
      // 所选的月在这一年不存在（如换了年份后没有的闰月）：月份字段已报错，先改月份才能选日。
      return (
        <Picker label={t.form.day} title={t.form.day} value={display} placeholder={t.form.dayPh} isDisabled width={300} errorId={errorId}>
          {() => null}
        </Picker>
      );
    }
    const days = m.days;
    return (
      <Picker
        label={t.form.day}
        title={fmt(t.picker.dayTitleLunar, { y: lunarYearName(t, year), month: lunarMonthName(t, month, leap) })}
        value={display}
        placeholder={t.form.dayPh}
        errorId={errorId}
        width={300}
      >
        {(close) => (
          <>
            {days === 29 && <p className={css.note}>{t.picker.smallMonth}</p>}
            <OptionGrid
              label={t.picker.daysList}
              columns={5}
              autoFocus
              options={Array.from({ length: 30 }, (_, k) => ({
                key: k + 1,
                text: lunarDayName(t, k + 1),
                content: <b className={css.optionMain}>{lunarDayName(t, k + 1)}</b>,
                ...(k + 1 > days ? { disabledReason: t.picker.noThirtieth } : {}),
              }))}
              selected={day}
              onSelect={(d) => {
                onChange(d);
                close();
              }}
            />
          </>
        )}
      </Picker>
    );
  }
  const count = solarDaysInMonth(year, month);
  return (
    <Picker
      label={t.form.day}
      title={fmt(t.picker.dayTitleSolar, { y: year, m: month })}
      value={display}
      placeholder={t.form.dayPh}
      errorId={errorId}
      width={308}
    >
      {(close) => (
        <>
          <div className={css.weekdays} aria-hidden="true">
            {t.picker.weekdays.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <OptionGrid
            label={t.picker.daysList}
            columns={7}
            autoFocus
            firstColumn={solarFirstWeekday(year, month) + 1}
            options={Array.from({ length: count }, (_, k) => ({
              key: k + 1,
              text: String(k + 1),
              content: <span className={css.optionNumber}>{k + 1}</span>,
            }))}
            selected={day !== null && day <= count ? day : null}
            onSelect={(d) => {
              onChange(d);
              close();
            }}
          />
        </>
      )}
    </Picker>
  );
}

/**
 * 出生时辰：上半是 13 档（两列，写钟点范围），下半是「只知道大概时间」四个时段。
 */
export function HourPicker({
  value,
  onChange,
  errorId,
}: {
  value: BirthTime | null;
  onChange: (time: BirthTime) => void;
  errorId?: string | undefined;
}) {
  const t = useMessages();
  const display =
    value === null ? null : value.kind === 'hour' ? (
      <>
        <b className={css.valueSerif}>{hourName(t, value.index)}</b>
        <small className={css.valueNote}>{hourRange(value.index)}</small>
      </>
    ) : (
      <>
        <b className={css.valueSerif}>{periodName(t, value.period)}</b>
        <small className={css.valueNote}>{PERIODS[value.period].range}</small>
      </>
    );
  const hours: GridOption<number>[] = Array.from({ length: 13 }, (_, k) => ({
    key: k,
    text: `${hourName(t, k)} ${hourRange(k)}`,
    content: (
      <>
        <b className={css.optionMain}>{hourName(t, k)}</b>
        <small className={css.optionNote}>{hourRange(k)}</small>
      </>
    ),
  }));
  const periods: GridOption<Period>[] = PERIOD_KEYS.map((p) => ({
    key: p,
    text: `${periodName(t, p)} ${PERIODS[p].range}`,
    content: (
      <>
        <b className={css.optionMain}>{periodName(t, p)}</b>
        <small className={css.optionNote}>{PERIODS[p].range}</small>
      </>
    ),
  }));
  return (
    <Picker label={t.form.hourName} title={t.picker.hourTitle} value={display} placeholder={t.form.hourPh} errorId={errorId} width={340}>
      {(close) => (
        <>
          <OptionGrid
            label={t.picker.hoursList}
            columns={2}
            row
            autoFocus={value === null || value.kind === 'hour'}
            options={hours}
            selected={value?.kind === 'hour' ? value.index : null}
            onSelect={(index) => {
              onChange({ kind: 'hour', index });
              close();
            }}
          />
          <p className={css.section}>{t.picker.approx}</p>
          <OptionGrid
            label={t.picker.periodsList}
            columns={1}
            row
            autoFocus={value?.kind === 'period'}
            options={periods}
            selected={value?.kind === 'period' ? value.period : null}
            onSelect={(period) => {
              onChange(periodTime(period));
              close();
            }}
          />
        </>
      )}
    </Picker>
  );
}
