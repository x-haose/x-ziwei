import { useEffect, useSyncExternalStore } from 'react';
import { type Pack, type PackRaw, type Use, checkUse, describePack, withoutPack } from './library';
import { type Library, StorageUnavailableError, openLibrary } from './store';

/**
 * 本机知识包库在页面里的状态，知识包页与排盘页共用一份：打开一次 IndexedDB，读出全部包与生效组合，
 * 之后的导入、删除、改组合先写进库，写成了再更新这里，界面随之刷新。
 */
export type LibraryState =
  | { status: 'loading' }
  /** 浏览器不让本页存数据：只有默认包，导入关闭。 */
  | { status: 'unavailable' }
  /** 读库出错（IndexedDB 本身的故障或数据损坏）。 */
  | { status: 'failed'; message: string }
  | { status: 'ready'; packs: Pack[]; use: Use };

const LOADING: LibraryState = { status: 'loading' };
let state: LibraryState = LOADING;
let library: Library | null = null;
let started = false;
const listeners = new Set<() => void>();

function set(next: LibraryState): void {
  state = next;
  for (const l of listeners) l();
}

async function load(): Promise<void> {
  try {
    library = await openLibrary();
    const [stored, use] = await Promise.all([library.packs(), library.use()]);
    const packs = stored.map((s) => describePack(s.raw, s.importedAt));
    checkUse(use, packs);
    set({ status: 'ready', packs, use });
  } catch (err) {
    if (err instanceof StorageUnavailableError) {
      set({ status: 'unavailable' });
      return;
    }
    console.error(err);
    set({ status: 'failed', message: err instanceof Error ? err.message : String(err) });
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 本机知识包库的状态；第一次用到时开始读库。预渲染与水合时为 loading。 */
export function useLibrary(): LibraryState {
  useEffect(() => {
    if (started) return;
    started = true;
    void load();
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => LOADING,
  );
}

function ready(): { lib: Library; packs: Pack[]; use: Use } {
  if (state.status !== 'ready' || !library) throw new Error('本机知识包库还没有就绪');
  return { lib: library, packs: state.packs, use: state.use };
}

/** 存入一个已通过校验的新包，返回它的包信息。写入失败（含存满了）时原样抛出，库与状态都不变。 */
export async function addPack(raw: PackRaw): Promise<Pack> {
  const { lib, packs, use } = ready();
  const importedAt = Date.now();
  const pack = describePack(raw, importedAt);
  await lib.add({ id: pack.id, raw, importedAt });
  set({ status: 'ready', packs: [...packs, pack], use });
  return pack;
}

/** 删掉一个包；它在生效组合里时一并移出。 */
export async function removePack(id: string): Promise<void> {
  const { lib, packs, use } = ready();
  const next = withoutPack(use, id);
  await lib.remove(id, next);
  set({ status: 'ready', packs: packs.filter((p) => p.id !== id), use: next });
}

/** 改生效组合。 */
export async function setUse(next: Use): Promise<void> {
  const { lib, packs } = ready();
  checkUse(next, packs);
  await lib.setUse(next);
  set({ status: 'ready', packs, use: next });
}
