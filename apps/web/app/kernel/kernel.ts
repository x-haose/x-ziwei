import { useSyncExternalStore } from 'react';
import type * as XIztro from 'x-iztro';
import wasmUrl from 'x-iztro/x_iztro.wasm?url';

/** 装好的排盘内核（x-iztro 的全部 API）。装好之后所有调用都是同步的。 */
export type Kernel = typeof XIztro;

/**
 * 内核的装载状态。`loaded`、`total` 是已下载与总字节数（解压后的 wasm 大小），用于进度显示。
 * 装载失败时 `message` 是原因，可以重试。
 */
export type KernelState =
  | { status: 'idle' }
  | { status: 'loading'; loaded: number; total: number }
  | { status: 'ready'; kernel: Kernel }
  | { status: 'error'; message: string };

const IDLE: KernelState = { status: 'idle' };
let state: KernelState = IDLE;
const listeners = new Set<() => void>();

function set(next: KernelState): void {
  state = next;
  for (const l of listeners) l();
}

/**
 * 边下载边计数：把响应体换成一路计数的流再交给内核，`Content-Type` 照抄，
 * 是 `application/wasm` 时内核仍可边下边编译。
 */
async function fetchWithProgress(url: string, total: number): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} ${res.statusText}: ${url}`);
  let loaded = 0;
  const counted = res.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        loaded += chunk.byteLength;
        set({ status: 'loading', loaded: Math.min(loaded, total), total });
        controller.enqueue(chunk);
      },
    }),
  );
  return new Response(counted, { headers: { 'content-type': res.headers.get('content-type') ?? '' } });
}

let pending: Promise<Kernel> | null = null;

/**
 * 装载内核：取 JS 外壳与 wasm、编译、实例化，只在浏览器里调用（预渲染阶段不会走到这里）。
 * 已装好或装载中时共用那一次；失败后状态记为 error，再调用即重试。
 */
export function loadKernel(): Promise<Kernel> {
  if (state.status === 'ready') return Promise.resolve(state.kernel);
  pending ??= (async () => {
    const total = __XIZTRO_WASM_BYTES__;
    set({ status: 'loading', loaded: 0, total });
    try {
      const kernel = await import('x-iztro');
      await kernel.init(fetchWithProgress(wasmUrl, total));
      set({ status: 'ready', kernel });
      return kernel;
    } catch (err) {
      set({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      throw err;
    } finally {
      pending = null;
    }
  })();
  return pending;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 内核的装载状态，随进度更新。预渲染与水合时为 idle。 */
export function useKernelState(): KernelState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => IDLE,
  );
}
