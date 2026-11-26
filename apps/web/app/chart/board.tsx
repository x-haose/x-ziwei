import { assignInlineVars } from '@vanilla-extract/dynamic';
import { type ReactNode, type RefObject, useLayoutEffect, useRef, useState } from 'react';
import * as css from './board.css';
import {
  type Box,
  type Density,
  type Geometry,
  type Point,
  along,
  anchor,
  densityOf,
  innerBox,
  placeLabels,
  ringSide,
} from './geometry';
import { BRANCHES, BRANCH_CELL } from './layout';
import type { HuaMark, LayerView, PalaceView, StarView } from './model';
import { BODY_TAG, LAYER_PREFIX, ORIGIN_TAG } from './terms';

/** 量盘的尺寸：首帧之前量一次，之后随容器尺寸变化重量。预渲染时没有尺寸，为 null。 */
function useGeometry(ref: RefObject<HTMLDivElement | null>): Geometry | null {
  const [geom, setGeom] = useState<Geometry | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) throw new Error('盘的根元素没有挂上');
    const measure = () => {
      const band = Number.parseFloat(getComputedStyle(el).paddingLeft);
      setGeom((g) =>
        g && g.width === el.clientWidth && g.height === el.clientHeight && g.band === band
          ? g
          : { width: el.clientWidth, height: el.clientHeight, band },
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return geom;
}

const HUA_CLASS: Record<HuaMark['source'], string> = {
  n: css.huaNatal,
  d: css.huaDecadal,
  y: css.huaYearly,
  m: css.huaMonthly,
};

function Hua({ marks }: { marks: readonly HuaMark[] }) {
  if (marks.length === 0) return null;
  return (
    <span className={css.huaStack}>
      {marks.map((m) => (
        <i key={m.source} className={`${css.hua} ${HUA_CLASS[m.source]}`}>
          {m.text}
        </i>
      ))}
    </span>
  );
}

function StarColumn({ star, kind }: { star: StarView; kind: 'major' | 'minor' }) {
  return (
    <span className={`${css.star} ${kind === 'major' ? css.starMajor : css.starMinor}`}>
      <span className={css.column}>
        <span className={css.starName} data-star={star.key}>
          {star.name}
        </span>
        {star.brightness && <span className={css.brightness}>{star.brightness}</span>}
      </span>
      <Hua marks={star.hua} />
    </span>
  );
}

/**
 * 一宫的内容。全量与中密度：主星、辅星竖排，当前层运星（中密度不放），右上层宫名，杂耀（中密度不放），
 * 页脚宫名、身/因、干支、大限岁数。紧凑：主星与带四化的辅星竖排，其余辅星横排一行；
 * 页脚宫名与当前层宫名（无运限时为干支）。无主星的宫辅星都竖排。
 */
function CellContent({ p, layers, density }: { p: PalaceView; layers: readonly LayerView[]; density: Density }) {
  const act = layers.at(-1);
  if (density === 'compact') {
    const vertical = p.minors.filter((s) => p.majors.length === 0 || s.hua.length > 0);
    const rest = p.minors.filter((s) => !vertical.includes(s));
    return (
      <>
        <div className={css.stars}>
          {p.majors.map((s) => (
            <StarColumn key={s.key} star={s} kind="major" />
          ))}
          {vertical.map((s) => (
            <StarColumn key={s.key} star={s} kind="minor" />
          ))}
        </div>
        {rest.length > 0 && (
          <div className={css.minorRow}>
            {rest.map((s) => (
              <span key={s.key}>
                {s.name}
                {s.brightness && <small className={css.minorBrightness}>{s.brightness}</small>}
              </span>
            ))}
          </div>
        )}
        <div className={css.foot}>
          <span className={css.palaceName}>{p.name}</span>
          {act ? (
            <span className={css.footLayer}>{`${LAYER_PREFIX[act.kind]}${act.names[p.index]!.slice(0, 1)}`}</span>
          ) : (
            <span className={css.stemBranch}>{`${p.stem}${p.branch}`}</span>
          )}
        </div>
      </>
    );
  }
  return (
    <>
      <div className={css.stars}>
        {p.majors.map((s) => (
          <StarColumn key={s.key} star={s} kind="major" />
        ))}
        {p.minors.map((s) => (
          <StarColumn key={s.key} star={s} kind="minor" />
        ))}
        {density === 'full' &&
          act?.stars[p.index]!.map((name) => (
            <span key={name} className={`${css.star} ${css.starFlow}`}>
              <span className={css.column}>
                <span className={css.starName}>{name}</span>
              </span>
            </span>
          ))}
      </div>
      {layers.length > 0 && (
        <div className={css.layerNames}>
          {layers.map((l) => (
            <span key={l.kind} className={l === act ? `${css.layerName} ${css.layerNameActive}` : css.layerName}>
              {`${LAYER_PREFIX[l.kind]}${l.names[p.index]!.slice(0, 1)}`}
            </span>
          ))}
        </div>
      )}
      {density === 'full' && p.adjectives.length > 0 && (
        <div className={css.adjectives}>
          {p.adjectives.map((s) => (
            <span key={s.key}>{s.name}</span>
          ))}
        </div>
      )}
      <div className={css.foot}>
        <span className={css.palaceName}>{p.name}</span>
        {p.isBody && <span className={css.palaceTag}>{BODY_TAG}</span>}
        {p.isOriginal && <span className={css.palaceTag}>{ORIGIN_TAG}</span>}
        <span className={css.stemBranch}>{`${p.stem}${p.branch}`}</span>
        <span className={css.decadalAges}>{`${p.decadal[0]}–${p.decadal[1]}`}</span>
      </div>
    </>
  );
}

/**
 * 宫内收起的顺序：当前层的运星（盘上只放当前层的运星）→ 非当前层的层宫名 → 杂耀 → 横排辅星。
 * 收起的内容读数区都列出：各层运星、各层宫名、杂耀与全部辅星。
 */
const FOLD_LEVELS = 4;

/**
 * 宫内不重叠（设计规范第 7 节）：逐宫量各块（星列、层宫名、杂耀、横排辅星、页脚）的位置，
 * 有两块相交或任何一块超出宫格，就把收起级数加一，直到不冲突。收起的内容在读数区都列出。
 */
function foldCells(grid: HTMLElement): void {
  const rect = (n: Element | null) => (n && (n as HTMLElement).offsetParent ? n.getBoundingClientRect() : null);
  const union = (nodes: Element[]) => {
    const rs = nodes.filter((n) => (n as HTMLElement).offsetParent).map((n) => n.getBoundingClientRect());
    if (rs.length === 0) return null;
    return {
      left: Math.min(...rs.map((r) => r.left)),
      top: Math.min(...rs.map((r) => r.top)),
      right: Math.max(...rs.map((r) => r.right)),
      bottom: Math.max(...rs.map((r) => r.bottom)),
    };
  };
  type R = { left: number; top: number; right: number; bottom: number };
  const hit = (a: R, b: R) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  for (const cell of grid.querySelectorAll<HTMLElement>('[data-index]')) {
    const clash = () => {
      const box = cell.getBoundingClientRect();
      const parts = [
        union([...cell.querySelectorAll(`.${css.stars} > .${css.star}`)]),
        union([...cell.querySelectorAll(`.${css.layerName}`)]),
        rect(cell.querySelector(`.${css.adjectives}`)),
        rect(cell.querySelector(`.${css.minorRow}`)),
        rect(cell.querySelector(`.${css.foot}`)),
      ].filter((r): r is R => r !== null);
      for (let a = 0; a < parts.length; a++) for (let b = a + 1; b < parts.length; b++) if (hit(parts[a]!, parts[b]!)) return true;
      return parts.some((r) => r.bottom > box.bottom + 0.5 || r.right > box.right + 0.5);
    };
    cell.removeAttribute('data-fold');
    for (let level = 1; level <= FOLD_LEVELS && clash(); level++) cell.setAttribute('data-fold', String(level));
  }
}

/** 外圈刻度的显示方式。 */
export type RingMode =
  | { kind: 'blank' }
  | { kind: 'loading'; progress: number }
  | {
      kind: 'chart';
      clockwise: boolean;
      /** 标出的虚岁：贯穿刻度带并在带外写岁数。 */
      markAge: number | null;
      /** 所选大限所在宫的宫位索引；没选为 null。 */
      selectedDecadal: number | null;
      /** 点外圈某宫的刻度带选该宫的大限；不给则刻度带不可点。 */
      onPick?: (palaceIndex: number, label: string) => void;
      /** 点选区的提示文字（「23–32 岁　夫妻：点选这个大限」），按宫位索引。 */
      hitTitles?: readonly string[];
    };

/** 加载进度点亮刻度的虚岁上限：3 岁起，进度满时覆盖到 123 岁。 */
const litAge = (progress: number) => 3 + progress * 120;

function Ring({ geom, palaces, mode }: { geom: Geometry; palaces: readonly PalaceView[] | null; mode: RingMode }) {
  const [on, setOn] = useState(false);
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
    return () => cancelAnimationFrame(id);
  }, []);
  if (geom.band <= 0) return null;
  const b = geom.band;
  const chart = mode.kind === 'chart' ? mode : null;
  const clockwise = chart ? chart.clockwise : true;
  const items: ReactNode[] = [];
  const cells: { cell: readonly [number, number]; range: readonly [number, number]; index: number; label: string }[] = palaces
    ? palaces.map((p) => ({ cell: p.cell, range: p.decadal, index: p.index, label: `${p.decadal[0]}–${p.decadal[1]}` }))
    : BRANCHES.map((br, k) => ({ cell: BRANCH_CELL[br], range: [3 + k * 10, 12 + k * 10] as const, index: k, label: '' }));
  for (const { cell, range, index } of cells) {
    const side = ringSide(cell, geom);
    const [n0, n1] = side.normal;
    const [a0, a1] = range;
    const selected = chart?.selectedDecadal === index;
    if (chart?.onPick) {
      const [x, y, w, h] = side.hit;
      items.push(
        <rect
          key={`hit-${index}`}
          className={css.ringHit}
          x={x}
          y={y}
          width={w}
          height={h}
          onClick={() => chart.onPick!(index, chart.hitTitles?.[index] ?? '')}
        >
          {chart.hitTitles && <title>{chart.hitTitles[index]}</title>}
        </rect>,
      );
    }
    for (let k = 0; k <= a1 - a0; k++) {
      const [x, y] = along(side, (k + 0.5) / 10, clockwise);
      const age = a0 + k;
      const marked = chart !== null && age === chart.markAge;
      const len = marked ? b - 4 : 5;
      const lit = mode.kind === 'loading' && age <= litAge(mode.progress);
      items.push(
        <g
          key={`t-${index}-${k}`}
          className={marked || selected ? `${css.tick} ${css.tickAccent}` : css.tick}
          data-lit={lit ? '' : undefined}
          style={{ transitionDelay: chart ? `${(age - 3) * 4}ms` : undefined }}
        >
          <line x1={x} y1={y} x2={x + n0 * len} y2={y + n1 * len} />
          {marked && (
            <text x={x + n0 * (b + 10)} y={y + n1 * (b + 10)} textAnchor="middle" dominantBaseline="central">
              {age}
            </text>
          )}
        </g>,
      );
    }
    const [sx, sy] = along(side, 0, clockwise);
    const [ex, ey] = along(side, 1, clockwise);
    items.push(
      <g key={`s-${index}`} className={selected ? `${css.tick} ${css.tickAccent}` : css.tick} data-lit={mode.kind === 'loading' && a0 <= litAge(mode.progress) ? '' : undefined}>
        <line x1={sx} y1={sy} x2={sx + n0 * 11} y2={sy + n1 * 11} />
        {chart && (
          <text
            x={sx + n0 * 17 + (n0 === 0 ? (ex > sx ? 13 : -13) : 0)}
            y={sy + n1 * 17 + (n1 === 0 ? (ey > sy ? 11 : -11) : 0)}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {a0}
          </text>
        )}
      </g>,
    );
  }
  return (
    <svg className={mode.kind === 'loading' ? `${css.overlay} ${css.loading}` : css.overlay} data-on={on ? '' : undefined} aria-hidden="true">
      {items}
    </svg>
  );
}

/** 连线与标签（设计规范第 5 节）：选中宫与三合两宫连实线三角，与对宫连虚线；标签按罚分避让。 */
function Sky({
  geom,
  palaces,
  set,
  names,
  blocks,
  compact,
}: {
  geom: Geometry;
  palaces: readonly PalaceView[] | null;
  set: readonly [number, number, number, number] | null;
  names: readonly string[] | null;
  blocks: readonly Box[];
  compact: boolean;
}) {
  const cells = palaces ? palaces.map((p) => p.cell) : BRANCHES.map((b) => BRANCH_CELL[b]);
  const anchors = cells.map((c) => anchor(c, geom));
  const base = anchors.map(({ at: [x, y] }, i) => <circle key={`b${i}`} className={css.baseStar} cx={x} cy={y} r={2.6} />);
  if (!set || !names || !palaces) {
    return (
      <svg className={css.overlay} aria-hidden="true">
        {base}
      </svg>
    );
  }
  const pt = (i: number): Point => anchors[i]!.at;
  const edges: [number, number, boolean][] = [
    [set[0], set[2], false],
    [set[2], set[3], false],
    [set[3], set[0], false],
    [set[0], set[1], true],
  ];
  const segments = edges.map(([a, b]) => [...pt(a), ...pt(b)] as const);
  const fs = compact ? 12 : 13;
  const lh = fs + 1;
  const sizes = set.map((i) => [fs + 6, [...names[i]!].length * lh + 4] as const);
  const boxes = placeLabels(
    set.map((i) => anchors[i]!),
    sizes,
    segments,
    blocks,
    innerBox(geom),
  );
  return (
    <svg className={css.overlay} aria-hidden="true">
      {base}
      {edges.map(([a, b, opposite], k) => {
        const [x1, y1] = pt(a);
        const [x2, y2] = pt(b);
        const len = Math.hypot(x2 - x1, y2 - y1).toFixed(1);
        const cls = [css.skyLine, opposite ? css.skyLineOpposite : '', css.drawn].filter(Boolean).join(' ');
        return (
          <line
            key={`${a}-${b}`}
            className={cls}
            style={{ ...assignInlineVars({ [css.lineLength]: len }), animationDelay: `${k * 60}ms` }}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
          />
        );
      })}
      {set.map((i, k) => {
        const [x, y] = pt(i);
        return (
          <circle
            key={`d${i}`}
            className={[css.dot, k === 0 ? css.dotSelf : '', css.popIn].filter(Boolean).join(' ')}
            cx={x}
            cy={y}
            r={k === 0 ? 5 : 3.6}
          />
        );
      })}
      {set.map((i, k) => {
        const box = boxes[k]!;
        const chars = [...names[i]!];
        const cx = (box[0] + box[2]) / 2;
        const top = (box[1] + box[3]) / 2 - ((chars.length - 1) * lh) / 2;
        return (
          <g key={`l${i}`} className={[css.label, k === 0 ? css.labelSelf : '', css.popIn].filter(Boolean).join(' ')}>
            <rect x={box[0]} y={box[1]} width={box[2] - box[0]} height={box[3] - box[1]} />
            {chars.map((ch, j) => (
              <text key={j} x={cx} y={top + j * lh} textAnchor="middle" dominantBaseline="central">
                {ch}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export interface BoardProps {
  /** 十二宫；null 为空状态（只写地支）。 */
  palaces: readonly PalaceView[] | null;
  /** 叠在盘上的运限层（大限 → 流年 → 流月）。 */
  layers: readonly LayerView[];
  /** 中宫的内容：盘面基本信息，或空、加载、出错状态。紧凑盘只放更少的信息，所以按密度给出。 */
  centre: (density: Density) => ReactNode;
  ring: RingMode;
  /** 选中宫的三方四正 [本宫, 对宫, 三合, 三合]（宫位索引），画星官连线；不选为 null。 */
  surround: readonly [number, number, number, number] | null;
  /** 铺底色的宫（选中宫除外）；不给时铺选中宫的三方四正。 */
  highlight?: readonly number[];
  /** 当前大限所在宫（页脚岁数标强调色）；没有为 null。 */
  nowDecadal: number | null;
  /** 点宫时调用；不给时宫格不可点（首页的示例盘）。 */
  onSelect?: (index: number) => void;
  /** 宫格的无障碍名称，按宫位索引；可点时必给。 */
  cellLabels?: readonly string[];
  /** 换了这个值就重新画连线并重放描线动画（选宫、换层）。 */
  drawKey: string;
  className?: string;
  /** 根元素，供外部量位置（首页引线）。 */
  rootRef?: RefObject<HTMLDivElement | null>;
}

/**
 * 命盘（设计规范第 5–7 节）：Grid 排格子与文字，SVG 画外圈刻度与星官连线。
 * 密度按实测格宽定；每次画盘后逐宫检查重叠并按顺序收起。
 */
export function Board({ palaces, layers, centre, ring, surround, highlight, nowDecadal, onSelect, cellLabels, drawKey, className, rootRef }: BoardProps) {
  const own = useRef<HTMLDivElement>(null);
  const ref = rootRef ?? own;
  const gridRef = useRef<HTMLDivElement>(null);
  const centreRef = useRef<HTMLDivElement>(null);
  const geom = useGeometry(ref);
  const { density, short } = geom ? densityOf(geom) : { density: 'full' as Density, short: false };
  const [blocks, setBlocks] = useState<readonly Box[]>([]);

  useLayoutEffect(() => {
    if (!geom || !gridRef.current || !palaces) return;
    foldCells(gridRef.current);
  }, [geom, palaces, layers, density]);

  useLayoutEffect(() => {
    const root = ref.current;
    const c = centreRef.current;
    if (!geom || !root || !c) return;
    const base = root.getBoundingClientRect();
    const next = [...c.children].map((n) => {
      const r = n.getBoundingClientRect();
      return [r.left - base.left - 4, r.top - base.top - 4, r.right - base.left + 4, r.bottom - base.top + 4] as const;
    });
    setBlocks((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  });

  const selected = surround?.[0] ?? null;
  const shaded = highlight ?? surround ?? [];
  const act = layers.at(-1);
  const names = palaces ? (act ? act.names : palaces.map((p) => p.name)) : null;

  return (
    <div
      ref={ref}
      className={className ? `${css.board} ${className}` : css.board}
      data-density={density}
      data-short={short ? '' : undefined}
    >
      <div ref={gridRef} className={css.grid}>
        {palaces
          ? palaces.map((p) => {
              const Tag = onSelect ? 'button' : 'div';
              return (
                <Tag
                  key={p.index}
                  {...(onSelect
                    ? { type: 'button' as const, onClick: () => onSelect(p.index), 'aria-pressed': selected === p.index, 'aria-label': cellLabels?.[p.index] }
                    : {})}
                  className={css.cell}
                  data-index={p.index}
                  data-sel={selected === p.index ? '' : undefined}
                  data-rel={shaded.includes(p.index) && selected !== p.index ? '' : undefined}
                  data-now={nowDecadal === p.index ? '' : undefined}
                  style={{ gridArea: `${p.cell[0] + 1} / ${p.cell[1] + 1}` }}
                >
                  <span className={css.bracket} />
                  <CellContent p={p} layers={layers} density={density} />
                </Tag>
              );
            })
          : BRANCHES.map((br) => {
              const [r, c] = BRANCH_CELL[br];
              return (
                <div key={br} className={css.cell} style={{ gridArea: `${r + 1} / ${c + 1}` }} aria-hidden="true">
                  <span className={css.ghost}>{br}</span>
                </div>
              );
            })}
        <div className={css.middle} />
      </div>
      {geom && <Ring key={ring.kind} geom={geom} palaces={palaces} mode={ring} />}
      {geom && (
        <Sky
          geom={geom}
          palaces={palaces}
          set={surround}
          names={names}
          blocks={blocks}
          compact={density === 'compact'}
          key={drawKey}
        />
      )}
      <div ref={centreRef} className={css.centre}>
        {centre(density)}
      </div>
    </div>
  );
}
