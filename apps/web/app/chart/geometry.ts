/**
 * 盘面的几何：格子尺寸、底星位置、外圈刻度、星官连线与宫名标签的摆放。全部是纯计算，单位 px，
 * 原点在盘外框（含外圈刻度带）的左上角。
 */

export interface Geometry {
  /** 外框宽高（含外圈刻度带）。 */
  width: number;
  height: number;
  /** 外圈刻度带宽度，0 表示不画外圈。 */
  band: number;
}

export type Point = readonly [x: number, y: number];

/** 矩形 [左, 上, 右, 下]。 */
export type Box = readonly [number, number, number, number];

export function cellSize({ width, height, band }: Geometry): { w: number; h: number } {
  return { w: (width - 2 * band) / 4, h: (height - 2 * band) / 4 };
}

/** 中宫（2×2）的矩形。 */
export function innerBox(g: Geometry): Box {
  const { w, h } = cellSize(g);
  return [g.band + w, g.band + h, g.band + 3 * w, g.band + 3 * h];
}

/**
 * 某格的底星：落在中宫边沿，边宫取它与中宫相邻那条边的中点，角宫取中宫的角。
 * 返回点坐标与它相对中宫的朝向（指向中宫内部的单位方向，角宫为对角方向）。
 */
export function anchor(cell: readonly [row: number, col: number], g: Geometry): { at: Point; inward: Point } {
  const [r, c] = cell;
  const { w, h } = cellSize(g);
  const x = c === 0 ? 1 : c === 3 ? 3 : c + 0.5;
  const y = r === 0 ? 1 : r === 3 ? 3 : r + 0.5;
  const ix = c === 0 ? 1 : c === 3 ? -1 : 0;
  const iy = r === 0 ? 1 : r === 3 ? -1 : 0;
  return { at: [g.band + x * w, g.band + y * h], inward: [ix, iy] };
}

/** 盘的密度（设计规范第 7 节）：按实际格宽决定。紧凑且格高不足 110px 时再标为矮格。 */
export type Density = 'full' | 'medium' | 'compact';

export function densityOf(g: Geometry): { density: Density; short: boolean } {
  const { w, h } = cellSize(g);
  const c = Math.min(w, h);
  const density: Density = c >= 176 ? 'full' : c >= 130 && h <= w * 1.05 ? 'medium' : 'compact';
  return { density, short: density === 'compact' && h < 110 };
}

/** 一宫外沿的刻度带：从 `from` 到 `to` 的一段边，`normal` 朝盘外。 */
export interface RingSide {
  from: Point;
  to: Point;
  normal: Point;
  /** 这一段刻度带的点选矩形 [x, y, 宽, 高]。 */
  hit: readonly [number, number, number, number];
}

/**
 * 某格外沿的刻度带。上排画上沿、下排画下沿，左右两列（不含角宫）画外侧边；角宫只画上下沿。
 * 边的走向是顺时针，`clockwise` 为假时由调用方把参数取反（1 − t）。
 */
export function ringSide(cell: readonly [number, number], g: Geometry): RingSide {
  const [r, c] = cell;
  const { w, h } = cellSize(g);
  const { band: b, width: W, height: H } = g;
  if (r === 0) return { from: [b + c * w, b], to: [b + (c + 1) * w, b], normal: [0, -1], hit: [b + c * w, 0, w, b] };
  if (r === 3) return { from: [b + (c + 1) * w, H - b], to: [b + c * w, H - b], normal: [0, 1], hit: [b + c * w, H - b, w, b] };
  if (c === 3) return { from: [W - b, b + r * h], to: [W - b, b + (r + 1) * h], normal: [1, 0], hit: [W - b, b + r * h, b, h] };
  return { from: [b, b + (r + 1) * h], to: [b, b + r * h], normal: [-1, 0], hit: [0, b + r * h, b, h] };
}

/** 刻度带上参数 t（0–1）处的点；逆行的盘从另一端起算。 */
export function along(side: RingSide, t: number, clockwise: boolean): Point {
  const u = clockwise ? t : 1 - t;
  return [side.from[0] + (side.to[0] - side.from[0]) * u, side.from[1] + (side.to[1] - side.from[1]) * u];
}

function intersects(a: Box, b: Box): boolean {
  return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}

function segmentHits(box: Box, [x1, y1, x2, y2]: readonly [number, number, number, number]): boolean {
  for (let s = 0; s <= 20; s++) {
    const x = x1 + ((x2 - x1) * s) / 20;
    const y = y1 + ((y2 - y1) * s) / 20;
    if (x > box[0] && x < box[2] && y > box[1] && y < box[3]) return true;
  }
  return false;
}

/** 罚分：越出中宫最重，其次压线、压其他标签、压中宫文字块；离底星越远略有罚分。 */
const COST = { outside: 200, line: 100, label: 80, block: 60, distance: 0.4 } as const;

/**
 * 给竖排宫名标签找位置（设计规范第 5 节「线在字下」）。
 * 每个标签在朝中宫的方向上取候选点（24 个方向 × 3 个距离），按罚分取最低者，依次摆放，
 * 后摆的避开先摆的。返回各标签的矩形，顺序同 `anchors`。
 *
 * @param anchors 底星位置与朝向
 * @param sizes 各标签的宽高
 * @param segments 连线 [x1, y1, x2, y2]
 * @param blocks 中宫文字块的矩形（已含留白）
 * @param inner 中宫矩形
 */
export function placeLabels(
  anchors: readonly { at: Point; inward: Point }[],
  sizes: readonly (readonly [w: number, h: number])[],
  segments: readonly (readonly [number, number, number, number])[],
  blocks: readonly Box[],
  inner: Box,
): Box[] {
  const placed: Box[] = [];
  anchors.forEach(({ at: [x, y], inward: [ix, iy] }, k) => {
    const [bw, bh] = sizes[k]!;
    const norm = Math.hypot(ix, iy);
    let best: { cost: number; box: Box } | null = null;
    for (let a = 0; a < 24; a++) {
      const t = (a * Math.PI) / 12;
      const vx = Math.cos(t);
      const vy = Math.sin(t);
      if ((vx * ix + vy * iy) / norm < 0.3) continue;
      for (const R of [12, 18, 26]) {
        const cx = x + vx * (R + (Math.abs(vx) * bw) / 2);
        const cy = y + vy * (R + (Math.abs(vy) * bh) / 2);
        const box: Box = [cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2];
        let cost = R * COST.distance;
        if (box[0] < inner[0] + 2 || box[2] > inner[2] - 2 || box[1] < inner[1] + 2 || box[3] > inner[3] - 2) cost += COST.outside;
        for (const s of segments) if (segmentHits(box, s)) cost += COST.line;
        for (const b of blocks) if (intersects(box, b)) cost += COST.block;
        for (const p of placed) if (intersects(box, p)) cost += COST.label;
        if (!best || cost < best.cost) best = { cost, box };
      }
    }
    if (!best) throw new Error('标签没有任何朝向中宫的候选位置');
    placed.push(best.box);
  });
  return placed;
}
