import { type LocalState, localStore } from '../lib/local-store';
import type { Draft, Pack, PackRaw, Use } from './library';
import { type Snapshot, openLibrary } from './store';

/**
 * 本机知识包库在页面里的状态，知识包页与排盘页共用一份。改动一律经 `Library` 在读写事务里按库里此刻的数据校验并写入，
 * 写成后用事务给出的快照更新这里，并通知同一浏览器的其他标签页重读。
 * `ready` 上的 `repaired`：最近一次读库时从组合里移出的包（组合与包库对不上时，见 `Library.load`）。
 */
export type LibraryState = LocalState<Snapshot>;

const store = localStore({ channel: 'xzw-knowledge', open: openLibrary, read: (lib) => lib.load() });

/** 本机知识包库的状态；第一次用到时开始读库并监听其他标签页的改动。预渲染与水合时为 loading。 */
export const useLibrary = store.use;

/** 存入一个已通过包格式检查的新包，返回它的包信息。 */
export async function addPack(raw: PackRaw): Promise<Pack> {
  const snap = await store.mutate((lib) => lib.add(raw, Date.now()));
  const pack = snap.packs.find((p) => p.id === raw.id);
  if (!pack) throw new Error(`存入后库里没有 ${String(raw.id)}`);
  return pack;
}

/** 删掉一个包；它在生效组合里时按删包的规则一并移出。 */
export async function removePack(id: string): Promise<void> {
  await store.mutate((lib) => lib.remove(id));
}

/** 改生效组合：`next` 收到库里此刻的组合与包，算出新组合。返回写入后的快照。 */
export async function updateUse(next: (use: Use, packs: readonly Pack[]) => Use): Promise<Snapshot> {
  return store.mutate((lib) => lib.updateUse(next));
}

/** 新建一份草稿。 */
export async function createDraft(draft: Draft): Promise<void> {
  await store.mutate((lib) => lib.createDraft(draft));
}

/** 写下草稿的原文；`known` 是本页上次读到或写下的版本（更新时间），别的标签页改过时报冲突（见 `Library.writeDraft`）。 */
export async function writeDraft(id: string, raw: PackRaw, known: number, at: number): Promise<void> {
  await store.mutate((lib) => lib.writeDraft(id, raw, known, at));
}

/** 丢弃一份草稿。 */
export async function deleteDraft(id: string): Promise<void> {
  await store.mutate((lib) => lib.deleteDraft(id));
}

/** 把草稿存进包库（见 `Library.saveDraft`）；`use` 为真时一并放到生效组合的最上面。 */
export async function saveDraft(id: string, raw: PackRaw, known: number, at: number, use: boolean): Promise<Snapshot> {
  return store.mutate((lib) => lib.saveDraft(id, raw, known, at, use));
}
