import type { Astrolabe } from 'x-iztro';
import * as controls from '../components/controls.css';
import { fmt, type Messages } from '../i18n/messages';
import type { LayerView, PalaceView, StarView } from './model';
import * as css from './read-panel.css';

function StarLine({ star, t }: { star: StarView; t: Messages }) {
  return (
    <span>
      <b className={css.starName}>{star.name}</b>
      {star.brightness}
      {star.hua.map((h) => (
        <span key={h.source} className={h.source === 'd' ? undefined : css.huaAccent}>
          {` ${t.read.huaPrefix[h.source]}${h.text}`}
        </span>
      ))}
    </span>
  );
}

/**
 * 读数区：选中宫的宫名、干支、各层宫名、大限岁数；该宫全部星曜（含四化与各层运星）、杂耀；
 * 三方四正（每行可点去切换）；落在该宫的格局。盘上因密度或重叠收起的内容在这里都能看到。
 * 换宫时读屏只播报一句摘要（宫名、干支、各层宫名），不把整块重读一遍。
 */
export function ReadPanel({
  chart,
  palaces,
  layers,
  surround,
  onSelect,
  t,
}: {
  chart: Astrolabe;
  palaces: readonly PalaceView[];
  layers: readonly LayerView[];
  surround: readonly [number, number, number, number];
  onSelect: (index: number) => void;
  t: Messages;
}) {
  const p = palaces[surround[0]]!;
  const layerNames = layers.map((l) => `${t.layer[l.kind]}${l.names[p.index]}`);
  const flow = layers.flatMap((l) => l.stars[p.index] ?? []);
  const patterns = chart.patterns().filter((h) => h.palaceIndex === p.index);
  return (
    <section className={css.section} aria-label={t.chart.read}>
      <p className={controls.visuallyHidden} aria-live="polite">
        {[p.name, `${p.stem}${p.branch}`, ...layerNames].join('，')}
      </p>
      <div className={css.head}>
        <b className={css.name}>{p.name}</b>
        <span className={css.headNote}>{`${p.stem}${p.branch}`}</span>
        {layerNames.map((n) => (
          <span key={n} className={css.headNote}>
            {n}
          </span>
        ))}
        <span className={css.headAges}>{fmt(t.layer.ages, { a: p.decadal[0], b: p.decadal[1] })}</span>
      </div>
      <div className={css.stars}>
        {p.majors.length + p.minors.length === 0 && <span>{t.read.noMajor}</span>}
        {[...p.majors, ...p.minors].map((s) => (
          <StarLine key={s.key} star={s} t={t} />
        ))}
        {p.adjectives.length > 0 && <span className={css.extra}>{p.adjectives.map((s) => s.name).join(' ')}</span>}
        {flow.length > 0 && <span className={css.extra}>{flow.join(' ')}</span>}
      </div>
      <div>
        {surround.slice(1).map((j, k) => {
          const q = palaces[j]!;
          return (
            <button key={j} type="button" className={css.row} onClick={() => onSelect(j)}>
              <small className={css.role}>{t.read.roles[k + 1]}</small>
              <span className={css.rowName}>
                {q.name}
                <span className={css.rowBranch}>{q.branch}</span>
              </span>
              <span className={css.rowStars}>{q.majors.map((s) => s.name).join(' ') || t.read.noMajor}</span>
            </button>
          );
        })}
      </div>
      {patterns.map((h) => (
        <div key={h.key} className={css.pattern}>
          {t.read.pattern}
          <b className={css.patternName}>{h.name}</b>
          {h.stars.map((s) => `${s.name}${s.brightness ? `(${s.brightness})` : ''}`).join('、')}
        </div>
      ))}
    </section>
  );
}
