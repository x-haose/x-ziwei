import type { Lang } from '../i18n/lang';
import { localePath } from '../i18n/lang';
import { type Draft, type Pack, type PackRaw, type Section, draftConflict } from '../knowledge/library';
import { createDraft } from '../knowledge/use-library';
import { blankRaw, freshId, today } from './model';

/** 编辑器的地址（全是静态路径，参数在查询串里；生辰只放在 `#` 之后）。 */
export type EditorFrom = 'read' | 'write' | 'knowledge';

export interface EditorQuery {
  draft: string;
  from: EditorFrom;
  /** 进来时打开的条目。 */
  entry?: { section: Section; key: string } | 'info' | undefined;
  /** 组合释义：对方主星。 */
  combo?: string | undefined;
  /** 左栏的范围：这张盘（缺省）、某个主题、全部条目。 */
  scope?: 'chart' | 'all' | { topic: string } | undefined;
}

export function editorHref(lang: Lang, q: EditorQuery, birth: string): string {
  const p = new URLSearchParams({ draft: q.draft, from: q.from });
  if (q.entry) p.set('entry', q.entry === 'info' ? 'info' : `${q.entry.section}/${q.entry.key}`);
  if (q.combo) p.set('combo', q.combo);
  if (q.scope === 'all') p.set('scope', 'all');
  else if (q.scope && typeof q.scope === 'object') p.set('topic', q.scope.topic);
  return `${localePath(lang, '/knowledge/edit')}?${p.toString()}${birth ? `#${birth}` : ''}`;
}

/** 新建一份草稿并存进本机，返回它。 */
export async function newDraft(raw: PackRaw, editing: Pack | null): Promise<Draft> {
  const now = Date.now();
  const draft: Draft = { id: crypto.randomUUID(), raw, editing: editing?.id ?? null, snapshot: editing?.raw ?? null, createdAt: now, updatedAt: now };
  await createDraft(draft);
  return draft;
}

/** 草稿区里已有一份编辑这个包的草稿，但它是从包库里另一版开始的（见 `draftConflict`）：不能接着用，要先在草稿区处理。 */
export class StaleDraftError extends Error {
  constructor(readonly draft: Draft) {
    super(`草稿 ${draft.id} 不是从包库里现在这一版开始的`);
    this.name = 'StaleDraftError';
  }
}

/**
 * 编辑本机的一个包：已有编辑它、且从包库里现在这一版开始的草稿就接着用，否则从包库里的原文建一份。
 * 已有的草稿是从另一版开始的（别的标签页保存过、或删掉后重新导入了同标识的包）时报 `StaleDraftError`，不覆盖。
 */
export async function draftForPack(pack: Pack, packs: readonly Pack[], drafts: readonly Draft[]): Promise<Draft> {
  const d = drafts.find((x) => x.editing === pack.id);
  if (d) {
    if (draftConflict(d, packs)) throw new StaleDraftError(d);
    return d;
  }
  if (!pack.raw) throw new Error(`默认包 ${pack.id} 不能直接编辑`);
  return newDraft(structuredClone(pack.raw), pack);
}

/** 从看盘直达时新建的包：「我的释义」，标识 `my-pack`（重了加序号），叠在 `base` 上。 */
export async function draftOnTop(base: string, name: string, packs: readonly Pack[], drafts: readonly Draft[]): Promise<Draft> {
  return newDraft(blankRaw({ id: freshId('my-pack', packs, drafts), name, base, version: today(new Date()) }), null);
}
