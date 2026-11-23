import { useEffect, useSyncExternalStore } from 'react';
import type { Pack, PackRaw, Use } from './library';
import { type Library, type Snapshot, StorageNewerError, StorageUnavailableError, openLibrary } from './store';

/**
 * 本机知识包库在页面里的状态，知识包页与排盘页共用一份。改动一律经 `Library` 在读写事务里按库里此刻的数据校验并写入，
 * 写成后用事务给出的快照更新这里，并经 BroadcastChannel 通知同一浏览器的其他标签页重读。
 */
export type LibraryState =
  | { status: 'loading' }
  /** 浏览器不让本页存数据：只有默认包，导入关闭。 */
  | { status: 'unavailable' }
  /** 读库出错（IndexedDB 本身的故障或数据损坏）。 */
  | { status: 'failed'; message: string }
  /** 别的标签页开着旧版本的连接，挡住了库的升级：关掉它们后会自动继续。 */
  | { status: 'blocked' }
  /** 别的标签页把库升到了更新的版本，本页的连接已关闭；或本机的库本来就比这一页的代码新。刷新后才能继续。 */
  | { status: 'superseded' }
  /** `repaired`：最近一次读库时从组合里移出的包（组合与包库对不上时，见 `Library.load`）。 */
  | { status: 'ready'; packs: Pack[]; use: Use; repaired: string[] };

const LOADING: LibraryState = { status: 'loading' };
const CHANNEL = 'xzw-knowledge';
/**
 * 打开库超过这么久（毫秒）仍没完成，按「被别的标签页挡住」处理。挡住时浏览器只给排在最前的那个打开请求发 blocked 事件，
 * 排在它后面的请求（同时开着的几个新版本标签页）收不到，只能按等待时间判断；正常打开只需几毫秒。
 */
const OPEN_PATIENCE_MS = 3000;
let state: LibraryState = LOADING;
let library: Library | null = null;
/** 正在打开的库：被别的标签页挡住时会等很久，期间再次读库共用这一次。 */
let opening: Promise<Library> | null = null;
let channel: BroadcastChannel | null = null;
let started = false;
const listeners = new Set<() => void>();

function set(next: LibraryState): void {
  state = next;
  for (const l of listeners) l();
}

function apply(snap: Snapshot): void {
  set({ status: 'ready', packs: snap.packs, use: snap.use, repaired: snap.repaired });
}

/** 读库（含修复组合）。另一个标签页改了库时也走这里。 */
async function load(): Promise<void> {
  try {
    opening ??= openLibrary({
      onBlocked: () => set({ status: 'blocked' }),
      onSuperseded: () => {
        library = null;
        opening = null;
        set({ status: 'superseded' });
      },
    });
    const slow = setTimeout(() => {
      if (state.status === 'loading') set({ status: 'blocked' });
    }, OPEN_PATIENCE_MS);
    try {
      library ??= await opening;
    } finally {
      clearTimeout(slow);
    }
    apply(await library.load());
  } catch (err) {
    opening = null;
    if (err instanceof StorageUnavailableError) {
      set({ status: 'unavailable' });
      return;
    }
    if (err instanceof StorageNewerError) {
      set({ status: 'superseded' });
      return;
    }
    console.error(err);
    set({ status: 'failed', message: err instanceof Error ? err.message : String(err) });
  }
}

function start(): void {
  if (started) return;
  started = true;
  if (typeof BroadcastChannel === 'function') {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => {
      if (state.status !== 'superseded') void load();
    };
  }
  void load();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 本机知识包库的状态；第一次用到时开始读库并监听其他标签页的改动。预渲染与水合时为 loading。 */
export function useLibrary(): LibraryState {
  useEffect(start, []);
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => LOADING,
  );
}

/**
 * 跑一次改动：成功后更新状态并通知其他标签页。失败时（存满了、按库里此刻的数据校验不过等）先按库重读，
 * 让页面回到库里的真实状态，再把错误原样抛给调用方。
 */
async function mutate(run: (lib: Library) => Promise<Snapshot>): Promise<Snapshot> {
  if (!library || state.status !== 'ready') throw new Error('本机知识包库还没有就绪');
  try {
    const snap = await run(library);
    apply(snap);
    channel?.postMessage('changed');
    return snap;
  } catch (err) {
    await load();
    throw err;
  }
}

/** 存入一个已通过包格式检查的新包，返回它的包信息。 */
export async function addPack(raw: PackRaw): Promise<Pack> {
  const snap = await mutate((lib) => lib.add(raw, Date.now()));
  const pack = snap.packs.find((p) => p.id === raw.id);
  if (!pack) throw new Error(`存入后库里没有 ${String(raw.id)}`);
  return pack;
}

/** 删掉一个包；它在生效组合里时按删包的规则一并移出。 */
export async function removePack(id: string): Promise<void> {
  await mutate((lib) => lib.remove(id));
}

/** 改生效组合：`next` 收到库里此刻的组合与包，算出新组合。返回写入后的快照。 */
export async function updateUse(next: (use: Use, packs: readonly Pack[]) => Use): Promise<Snapshot> {
  return mutate((lib) => lib.updateUse(next));
}
