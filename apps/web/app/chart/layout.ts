/** 十二地支，子起。盘上宫格的位置由地支决定，与命宫落在哪支无关。 */
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

export type Branch = (typeof BRANCHES)[number];

export function isBranch(value: string): value is Branch {
  return (BRANCHES as readonly string[]).includes(value);
}

/**
 * 方盘上各地支所在的格（行、列，从 0 起，4×4 网格的外圈）：巳午未申在上排，
 * 辰卯在左列，酉戌在右列，寅丑子亥在下排；中间 2×2 是中宫。
 */
export const BRANCH_CELL: Readonly<Record<Branch, readonly [row: number, col: number]>> = {
  巳: [0, 0],
  午: [0, 1],
  未: [0, 2],
  申: [0, 3],
  辰: [1, 0],
  酉: [1, 3],
  卯: [2, 0],
  戌: [2, 3],
  寅: [3, 0],
  丑: [3, 1],
  子: [3, 2],
  亥: [3, 3],
};
