import type { LayerKind } from './model';

/**
 * 盘上的固定用字。盘面一律按中文排（内核按 zh-CN 出盘），英文界面上的盘也是中文，所以这些字不进界面文案表。
 */

/** 层宫名的前缀：「大命」「年兄」「月父」。 */
export const LAYER_PREFIX: Record<Exclude<LayerKind, 'natal'>, string> = { decadal: '大', yearly: '年', monthly: '月' };

/** 宫格页脚的身宫、来因宫标记。 */
export const BODY_TAG = '身';
export const ORIGIN_TAG = '因';

/** 中宫四柱的标签。 */
export const PILLAR_LABELS = ['年', '月', '日', '时'] as const;
