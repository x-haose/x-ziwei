import { type RefObject, useLayoutEffect, useRef, useState } from 'react';
import * as css from './board.css';
import { BRANCHES, BRANCH_CELL } from './layout';

interface Geometry {
  /** 外框宽高（px，含外圈刻度带）。 */
  width: number;
  height: number;
  /** 外圈刻度带宽度（px），0 表示不画外圈。 */
  band: number;
}

/** 量盘的尺寸：首帧之前量一次，之后随容器尺寸变化重量。预渲染时没有尺寸，返回 null。 */
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

/**
 * 外圈刻度：每宫外沿 10 道短刻度，每段起点一道长刻度。角宫只画上下沿。
 * 空状态没有大限数据，只画刻度不写岁数。
 */
function Ring({ width, height, band }: Geometry) {
  if (band <= 0) return null;
  const cw = (width - 2 * band) / 4;
  const ch = (height - 2 * band) / 4;
  const lines: [number, number, number, number][] = [];
  for (const branch of BRANCHES) {
    const [r, c] = BRANCH_CELL[branch];
    let a: [number, number];
    let b: [number, number];
    let n: [number, number];
    if (r === 0) [a, b, n] = [[band + c * cw, band], [band + (c + 1) * cw, band], [0, -1]];
    else if (r === 3) [a, b, n] = [[band + (c + 1) * cw, height - band], [band + c * cw, height - band], [0, 1]];
    else if (c === 3) [a, b, n] = [[width - band, band + r * ch], [width - band, band + (r + 1) * ch], [1, 0]];
    else [a, b, n] = [[band, band + (r + 1) * ch], [band, band + r * ch], [-1, 0]];
    const at = (t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    for (let k = 0; k < 10; k++) {
      const [x, y] = at((k + 0.5) / 10);
      lines.push([x, y, x + n[0] * 5, y + n[1] * 5]);
    }
    const [sx, sy] = at(0);
    lines.push([sx, sy, sx + n[0] * 11, sy + n[1] * 11]);
  }
  return (
    <svg className={css.overlay} aria-hidden="true">
      {lines.map(([x1, y1, x2, y2]) => (
        <line key={`${x1},${y1},${x2},${y2}`} className={css.tick} x1={x1} y1={y1} x2={x2} y2={y2} />
      ))}
    </svg>
  );
}

/** 十二宫各一颗底星，落在中宫边沿：边宫取边中点，角宫取中宫角。 */
function BaseStars({ width, height, band }: Geometry) {
  const cw = (width - 2 * band) / 4;
  const ch = (height - 2 * band) / 4;
  return (
    <svg className={css.overlay} aria-hidden="true">
      {BRANCHES.map((branch) => {
        const [r, c] = BRANCH_CELL[branch];
        const x = c === 0 ? 1 : c === 3 ? 3 : c + 0.5;
        const y = r === 0 ? 1 : r === 3 ? 3 : r + 0.5;
        return <circle key={branch} className={css.baseStar} cx={band + x * cw} cy={band + y * ch} r={2.6} />;
      })}
    </svg>
  );
}

/**
 * 空状态的盘（设计规范第 10 节）：十二宫只写地支，外圈只有刻度，中宫写状态。
 * 没有盘面数据时排盘页与首页都显示这一状态。
 * 尺寸与外圈刻度带宽度由放置它的页面通过 `boardWidth`、`boardHeight`、`ringBand` 三个变量给出。
 */
export function EmptyBoard({
  title,
  hint,
  className,
}: {
  title?: string;
  /** 提示语，按屏宽二选一：`wide` 用于生辰表单在左侧时，`narrow` 用于在上方时。 */
  hint?: { wide: string; narrow: string };
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const geom = useGeometry(ref);
  return (
    <div ref={ref} className={className ? `${css.board} ${className}` : css.board}>
      <div className={css.grid} aria-hidden="true">
        {BRANCHES.map((branch) => {
          const [r, c] = BRANCH_CELL[branch];
          return (
            <div key={branch} className={css.cell} style={{ gridArea: `${r + 1} / ${c + 1}` }}>
              <span className={css.ghostBranch}>{branch}</span>
            </div>
          );
        })}
        <div className={css.middle} />
      </div>
      {geom && <Ring {...geom} />}
      {geom && <BaseStars {...geom} />}
      {title && (
        <div className={css.centre}>
          <div className={css.state}>
            <b className={css.stateTitle}>{title}</b>
            {hint && (
              <small className={css.stateHint}>
                <span className={css.hintWide}>{hint.wide}</span>
                <span className={css.hintNarrow}>{hint.narrow}</span>
              </small>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
