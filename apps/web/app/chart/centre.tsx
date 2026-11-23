import type { ReactNode } from 'react';
import type { Astrolabe } from 'x-iztro';
import { fmt, type Messages } from '../i18n/messages';
import * as css from './board.css';
import type { Density } from './geometry';
import type { LayerView } from './model';
import { PILLAR_LABELS } from './terms';

/**
 * 中宫：全量与中密度放阳历/农历、四柱（竖排）、五行局与命主身主、当前层一行；
 * 紧凑只放四柱、五行局、命主身主（设计规范第 7 节）。
 */
export function ChartCentre({
  chart,
  density,
  layer,
  layerLabel,
  t,
}: {
  chart: Astrolabe;
  density: Density;
  layer: LayerView | undefined;
  /** 当前层一行的文字（「流年 丙午　2026　虚岁 27」）；本命时不显示。 */
  layerLabel: string | null;
  t: Messages;
}) {
  const pillars = (
    <div className={css.pillars}>
      {(['yearly', 'monthly', 'daily', 'hourly'] as const).map((k) => chart.rawDates.chineseDate[k].join('')).map((p, k) => (
        <div key={PILLAR_LABELS[k]} className={css.pillar}>
          <small className={css.pillarLabel}>{PILLAR_LABELS[k]}</small>
          <span className={css.pillarValue}>{p}</span>
        </div>
      ))}
    </div>
  );
  const soulBody = (
    <>
      <span>
        {t.board.soul} <em className={css.elementsStar}>{chart.soul}</em>
      </span>
      <span>
        {t.board.body} <em className={css.elementsStar}>{chart.body}</em>
      </span>
    </>
  );
  if (density === 'compact') {
    return (
      <>
        {pillars}
        <div className={css.elements}>
          <b className={css.elementsMain}>{chart.fiveElementsClass}</b>
        </div>
        <div className={css.elements}>{soulBody}</div>
      </>
    );
  }
  return (
    <>
      <div className={css.centreDate}>
        <b className={css.centreDateMain}>{chart.solarDate}</b> {chart.time}　{chart.gender}
        <br />
        {t.board.lunar} {chart.lunarDate}
      </div>
      {pillars}
      <div className={css.elements}>
        <b className={css.elementsMain}>{chart.fiveElementsClass}</b>
        {soulBody}
      </div>
      {layer && layerLabel && <div className={css.layerLine}>{layerLabel}</div>}
    </>
  );
}

/** 中宫的状态块：标题、说明，或进度条与字节数，或出错原因与重试按钮。 */
export function CentreState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={css.state}>
      <b className={css.stateTitle}>{title}</b>
      {children}
    </div>
  );
}

export function LoadingBar({ progress, loaded, total, t }: { progress: number; loaded: number; total: number; t: Messages }) {
  return (
    <>
      <div className={css.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
        <i className={css.barFill} style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <small className={css.stateHint}>{fmt(t.chart.loadingBytes, { a: Math.round(loaded / 1024), b: Math.round(total / 1024) })}</small>
    </>
  );
}
