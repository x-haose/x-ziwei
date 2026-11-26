import { useState } from 'react';
import type { Astrolabe } from 'x-iztro';
import type { LunarCalendar } from '../birth/calendar';
import { type GridOption, OptionGrid, Picker } from '../birth/picker';
import * as pickerCss from '../birth/picker.css';
import { lunarMonthName } from '../birth/labels';
import { PageIcon } from '../components/icons';
import { Segmented } from '../components/segmented';
import { fmt, type Messages } from '../i18n/messages';
import * as boardCss from './board.css';
import * as css from './layer-panel.css';
import { LAYER_KINDS, type LayerKind, type MonthKey, nominalAge, yearRange } from './model';
import type { ChartView, Today } from './session';
import { monthKeyOf } from './session';

/** 流月段的标签：常规月写月名，闰月前后段写「闰四月上」「闰四月下」。 */
export function monthLabel(t: Messages, m: { month: number; isLeapMonth: boolean; part: MonthKey['part'] }, full = false): string {
  const name = lunarMonthName(t, m.month, m.isLeapMonth);
  if (m.part === 'normal') return name;
  const tpl = m.part === 'first' ? (full ? t.layer.monthFirstFull : t.layer.monthFirst) : full ? t.layer.monthSecondFull : t.layer.monthSecond;
  return fmt(tpl, { month: name });
}

/**
 * 流年选择器：每页一个大限的十年（5 列），页头写「23–32 岁　夫妻」，可翻遍 12 个大限；
 * 每个年份下写干支，今天所在的年份有小圆点。
 */
function YearPicker({
  chart,
  view,
  lunar,
  today,
  t,
}: {
  chart: Astrolabe;
  view: ChartView;
  lunar: LunarCalendar;
  today: Today;
  t: Messages;
}) {
  const list = chart.decadalList();
  const [page, setPage] = useState(view.sel.decadal);
  const item = list[page]!;
  const year = view.sel.year;
  const years = Array.from({ length: item.yearRange[1] - item.yearRange[0] + 1 }, (_, k) => item.yearRange[0] + k);
  const options: GridOption<number>[] = years.map((y) => ({
    key: y,
    text: String(y),
    label: fmt(t.layer.yearOption, { y, age: nominalAge(chart, y) }),
    now: y === today.year,
    content: (
      <>
        <b className={pickerCss.optionNumber}>{y}</b>
        <small className={pickerCss.optionNote}>{lunar.yearGanzhi(y)}</small>
      </>
    ),
  }));
  return (
    <Picker
      label={fmt(t.layer.yearButton, { y: year, age: nominalAge(chart, year) })}
      title={t.layer.yearPickerTitle}
      value={
        <>
          <b className={pickerCss.valueSerif}>{year}</b>
          <small className={pickerCss.valueNote}>{lunar.yearGanzhi(year)}</small>
        </>
      }
      placeholder=""
      width={320}
      triggerClass={pickerCss.triggerCentered}
      header={fmt(t.layer.agesOf, { a: item.ageRange[0], b: item.ageRange[1], palace: item.palaceName })}
      paging={{
        canPrev: page > 0,
        canNext: page < list.length - 1,
        onPrev: () => setPage((p) => p - 1),
        onNext: () => setPage((p) => p + 1),
      }}
      onOpenChange={(open) => {
        if (open) setPage(view.sel.decadal);
      }}
    >
      {(close) => (
        <OptionGrid
          key={page}
          label={t.layer.years}
          columns={5}
          autoFocus
          options={options}
          selected={years.includes(year) ? year : null}
          onSelect={(y) => {
            view.pickYear(y);
            close();
          }}
        />
      )}
    </Picker>
  );
}

/**
 * 运限选择（设计规范第 12 节）：本命、大限、流年、流月四层，选中层下方是该层的选择格。
 * 底下是四化块的图例：生年加所选的那一层（盘上只叠这一层）。收在「选别的大限、年份或流月」后面（21.2）。
 */
export function LayerPanel({
  id,
  hidden,
  chart,
  view,
  lunar,
  today,
  t,
}: {
  id: string;
  hidden: boolean;
  chart: Astrolabe;
  view: ChartView;
  lunar: LunarCalendar;
  today: Today;
  t: Messages;
}) {
  const { sel } = view;
  const decadals = chart.decadalList();
  const todayAge = nominalAge(chart, today.year);
  const [ymin, ymax] = yearRange(chart);
  const todayMonth = monthKeyOf(today.month, today.leap, today.day);
  const tile = (now: boolean, extra = '') => [css.tile, extra, now ? css.tileNow : ''].filter(Boolean).join(' ');
  const hua = view.hua[0]!;
  const legend: { cls: string; label: string }[] = [{ cls: boardCss.huaNatal, label: t.layer.legendNatal }];
  if (sel.layer === 'decadal') legend.push({ cls: boardCss.huaDecadal, label: t.layer.decadal });
  if (sel.layer === 'yearly') legend.push({ cls: boardCss.huaYearly, label: t.layer.yearly });
  if (sel.layer === 'monthly') legend.push({ cls: boardCss.huaMonthly, label: t.layer.monthly });

  return (
    <section id={id} hidden={hidden} className={css.section} aria-label={t.chart.layer}>
      <div className={css.head}>
        <h2 className={css.headTitle}>{t.chart.layer}</h2>
      </div>
      <Segmented<LayerKind>
        label={t.layer.tabs}
        className={css.tabs}
        serif
        value={sel.layer}
        options={LAYER_KINDS.map((k) => ({ value: k, label: t.layer[k] }))}
        onChange={view.setLayer}
      />

      {sel.layer === 'natal' && (
        <p className={css.natal}>
          {t.layer.birthYear} <b className={css.natalStrong}>{chart.rawDates.chineseDate.yearly.join('')}</b>　{t.layer.natalHua}{' '}
          {chart.palaces
            .flatMap((p) => [...p.majorStars, ...p.minorStars])
            .filter((s) => s.mutagen)
            .map((s) => (
              <b key={s.key} className={css.natalStrong}>
                {`${s.name}${s.mutagen} `}
              </b>
            ))}
        </p>
      )}

      {sel.layer === 'decadal' && (
        <div className={css.grid} role="group" aria-label={t.layer.decadals}>
          {decadals.map((d, i) => {
            const now = todayAge >= d.ageRange[0] && todayAge <= d.ageRange[1];
            return (
              <button
                key={i}
                type="button"
                className={tile(now)}
                aria-pressed={sel.decadal === i}
                aria-label={fmt(t.layer.agesOf, { a: d.ageRange[0], b: d.ageRange[1], palace: d.palaceName })}
                onClick={() => view.pickDecadal(i)}
              >
                <b className={css.tileMain}>{`${d.ageRange[0]}–${d.ageRange[1]}`}</b>
                <small className={css.tileNote}>{d.palaceName}</small>
              </button>
            );
          })}
        </div>
      )}

      {sel.layer === 'yearly' && (
        <>
          <div className={css.yearNav}>
            <button
              type="button"
              className={css.yearStep}
              aria-label={t.layer.prevYear}
              disabled={sel.year <= ymin}
              onClick={() => view.pickYear(sel.year - 1)}
            >
              <PageIcon dir={-1} />
            </button>
            <YearPicker chart={chart} view={view} lunar={lunar} today={today} t={t} />
            <button
              type="button"
              className={css.yearStep}
              aria-label={t.layer.nextYear}
              disabled={sel.year >= ymax}
              onClick={() => view.pickYear(sel.year + 1)}
            >
              <PageIcon dir={1} />
            </button>
          </div>
          <div className={`${css.grid} ${css.gridYears}`} role="group" aria-label={t.layer.years}>
            {(() => {
              const d = decadals[sel.decadal]!;
              return Array.from({ length: d.yearRange[1] - d.yearRange[0] + 1 }, (_, k) => d.yearRange[0] + k).map((y) => (
                <button
                  key={y}
                  type="button"
                  className={tile(y === today.year, css.tileCentered)}
                  aria-pressed={sel.year === y}
                  aria-label={fmt(t.layer.yearOption, { y, age: nominalAge(chart, y) })}
                  onClick={() => view.pickYear(y)}
                >
                  <b className={css.tileMain}>{y}</b>
                  <small className={css.tileNote}>{lunar.yearGanzhi(y)}</small>
                </button>
              ));
            })()}
          </div>
        </>
      )}

      {sel.layer === 'monthly' && (
        <div className={`${css.grid} ${css.gridMonths}`} role="group" aria-label={fmt(t.layer.months, { y: sel.year })}>
          {chart.monthlyList(sel.year).map((m) => {
            const pressed = sel.month.month === m.month && sel.month.part === m.part;
            const now = sel.year === today.year && todayMonth.month === m.month && todayMonth.part === m.part;
            return (
              <button
                key={`${m.month}-${m.part}`}
                type="button"
                className={tile(now, css.tileCentered)}
                aria-pressed={pressed}
                aria-label={monthLabel(t, m, true)}
                onClick={() => view.pickMonth({ month: m.month, part: m.part })}
              >
                <b className={`${css.tileMain} ${css.tileMainSerif}`}>{monthLabel(t, m)}</b>
              </button>
            );
          })}
        </div>
      )}

      <div className={css.legend}>
        {legend.map((l) => (
          <span key={l.label} className={css.legendItem}>
            <i className={`${boardCss.hua} ${l.cls} ${css.legendHua}`}>
              {hua}
            </i>
            {l.label}
          </span>
        ))}
      </div>
    </section>
  );
}
