import { fmt, type Messages } from '../i18n/messages';
import * as css from './knowledge.css';
import { type Counts, type Diff, type Pack, SECTIONS, type Section, type Use, activeIds, shortVersion } from './library';

/** 六段条目数：标签、数字（没有条目写「—」）、相对默认包同段条目数的比例条（超过按满格）。 */
export function CountList({
  counts,
  base,
  marks,
  t,
  className,
  label,
}: {
  counts: Counts;
  /** 比例条的分母：默认包的各段条目数，或（生效卡片里）内核认识的标识数。 */
  base: Counts;
  /** 列表的无障碍名称，缺省「各段条目数」。 */
  label?: string;
  /** 数字后的小字（生效卡片里的「改 N」）。 */
  marks?: Partial<Record<Section, string>>;
  t: Messages;
  className?: string;
}) {
  return (
    <dl className={className ? `${css.counts} ${className}` : css.counts} aria-label={label ?? t.knowledge.countsLabel}>
      {SECTIONS.map((s) => {
        const n = counts[s];
        const ratio = base[s] ? Math.min(1, n / base[s]) : 0;
        return (
          <div key={s} className={css.countItem}>
            <dt className={css.countLabel}>{t.knowledge.sections[s]}</dt>
            <dd className={n ? css.countValue : `${css.countValue} ${css.countZero}`}>
              {n || '—'}
              {marks?.[s] && <i className={css.countMark}>{marks[s]}</i>}
            </dd>
            <span className={css.cover} aria-hidden="true">
              <i className={css.coverFill} style={{ width: `${(ratio * 100).toFixed(1)}%` }} />
            </span>
          </div>
        );
      })}
    </dl>
  );
}

/** 「改 6 条星曜、新增 1 条主题」；没有条目时「没有条目」。 */
export function diffText(d: Diff, t: Messages): string {
  const parts: string[] = [];
  for (const s of SECTIONS) {
    const section = t.knowledge.sections[s];
    if (d.changed[s]) parts.push(fmt(t.knowledge.diff.changed, { n: d.changed[s], section }));
    if (d.added[s]) parts.push(fmt(t.knowledge.diff.added, { n: d.added[s], section }));
  }
  return parts.length ? parts.join(t.knowledge.diff.sep) : t.knowledge.diff.none;
}

export function totalOf(c: Counts): number {
  return SECTIONS.reduce((sum, s) => sum + c[s], 0);
}

/** 当前生效的包，按合并顺序（从下到上）。 */
export function activePacks(use: Use, packs: readonly Pack[], defaultPack: Pack): Pack[] {
  return activeIds(use).map((id) => {
    if (id === defaultPack.id) return defaultPack;
    const p = packs.find((x) => x.id === id);
    if (!p) throw new Error(`生效组合里的 ${id} 不在本机`);
    return p;
  });
}

/** 组合名：「iztro-docs + 我的笔记」。 */
export function useLabel(active: readonly Pack[]): string {
  return active.map((p) => p.name).join(' + ');
}

/** 提示词里的出处：「iztro-docs 2026-08-19 + my-notes 2026-11-20」。 */
export function provenance(active: readonly Pack[]): string {
  return active.map((p) => [p.id, shortVersion(p.version)].filter(Boolean).join(' ')).join(' + ');
}

/** 导入时间：本地时间「2026-11-20 17:12」。 */
export function importedText(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
