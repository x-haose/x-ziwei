import { useEffect, useSyncExternalStore } from 'react';
import { type OpenEvents, StorageNewerError, StorageUnavailableError } from './local-db';

/**
 * 一个本机库在页面里的状态。读好后快照的字段直接摊在 `ready` 上。
 */
export type LocalState<S> =
  | { status: 'loading' }
  /** 浏览器不让本页存数据。 */
  | { status: 'unavailable' }
  /** 读库出错（IndexedDB 本身的故障或数据损坏）。 */
  | { status: 'failed'; message: string }
  /** 打开库被挡住（别的标签页开着旧版本的连接）或等了太久：打开后会自动继续。 */
  | { status: 'blocked' }
  /** 别的标签页把库升到了更新的版本，本页的连接已关闭；或本机的库本来就比这一页的代码新。刷新后才能继续。 */
  | { status: 'superseded' }
  | ({ status: 'ready' } & S);

/**
 * 打开库超过这么久（毫秒）仍没完成，按「被别的标签页挡住」处理。挡住时浏览器只给排在最前的那个打开请求发 blocked 事件，
 * 排在它后面的请求（同时开着的几个新版本标签页）收不到，只能按等待时间判断；正常打开只需几毫秒。
 */
const OPEN_PATIENCE_MS = 3000;

const LOADING = { status: 'loading' } as const;

/**
 * 页面里共用一份的本机库：第一次用到时打开并读出快照，同一浏览器的其他标签页改了库时（经 BroadcastChannel `channel`）重读。
 * 改动经 `mutate` 跑在库连接上，成功后用返回的快照更新状态并通知其他标签页。
 */
export function localStore<C, S extends object>({
  channel: channelName,
  open,
  read,
}: {
  channel: string;
  open: (events: OpenEvents) => Promise<C>;
  read: (conn: C) => Promise<S>;
}) {
  let state: LocalState<S> = LOADING;
  let conn: C | null = null;
  /** 正在打开的库：被别的标签页挡住时会等很久，期间再次读库共用这一次。 */
  let opening: Promise<C> | null = null;
  let channel: BroadcastChannel | null = null;
  let started = false;
  const listeners = new Set<() => void>();

  const set = (next: LocalState<S>) => {
    state = next;
    for (const l of listeners) l();
  };
  const apply = (snap: S) => set({ status: 'ready', ...snap });

  /** 读库。另一个标签页改了库时也走这里。 */
  async function load(): Promise<void> {
    try {
      opening ??= open({
        onBlocked: () => set({ status: 'blocked' }),
        onSuperseded: () => {
          conn = null;
          opening = null;
          set({ status: 'superseded' });
        },
      });
      const slow = setTimeout(() => {
        if (state.status === 'loading') set({ status: 'blocked' });
      }, OPEN_PATIENCE_MS);
      try {
        conn ??= await opening;
      } finally {
        clearTimeout(slow);
      }
      apply(await read(conn));
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
      channel = new BroadcastChannel(channelName);
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

  return {
    /** 库的状态；第一次用到时开始读库。预渲染与水合时为 loading。 */
    use(): LocalState<S> {
      useEffect(start, []);
      return useSyncExternalStore(
        subscribe,
        () => state,
        () => LOADING,
      );
    },
    /** 此刻的状态（事件处理里用）。 */
    current(): LocalState<S> {
      return state;
    },
    /**
     * 跑一次改动：成功后更新状态并通知其他标签页。失败时（存满了、按库里此刻的数据校验不过等）先按库重读，
     * 让页面回到库里的真实状态，再把错误原样抛给调用方。
     */
    async mutate(run: (conn: C) => Promise<S>): Promise<S> {
      if (!conn || state.status !== 'ready') throw new Error(`本机库 ${channelName} 还没有就绪`);
      try {
        const snap = await run(conn);
        apply(snap);
        channel?.postMessage('changed');
        return snap;
      } catch (err) {
        await load();
        throw err;
      }
    },
  };
}
