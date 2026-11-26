import { type DBSchema, type IDBPDatabase, type OpenDBCallbacks, openDB } from 'idb';

/**
 * 本机 IndexedDB 库的打开与错误分类，知识包库（`xzw-knowledge`）与对话库（`xzw-chat`）共用。
 * 数据只在这台设备的浏览器里，不上传。
 */

/** 浏览器不让本页用 IndexedDB（隐私窗口、关了网站数据等）。 */
export class StorageUnavailableError extends Error {
  constructor(cause: unknown) {
    super('这个浏览器不让本页存数据', { cause });
    this.name = 'StorageUnavailableError';
  }
}

/** 本机的库比这一页的代码新（本站回退过版本，或这一页是更新之前打开的）：打不开，要刷新到新版本。 */
export class StorageNewerError extends Error {
  constructor(db: string, cause: unknown) {
    super(`本机的 ${db} 库版本比这一页新`, { cause });
    this.name = 'StorageNewerError';
  }
}

/** 浏览器给本站的存储空间满了，写入被拒绝；这次写入没有发生。 */
export class StorageFullError extends Error {
  constructor(cause: unknown) {
    super('这台设备给本站的存储空间满了', { cause });
    this.name = 'StorageFullError';
  }
}

/** 打开库时与其他标签页的版本协调。 */
export interface OpenEvents {
  /** 别的标签页还开着旧版本的连接，挡住了这次升级；那些连接关掉后打开会自动继续。 */
  onBlocked: () => void;
  /** 别的标签页要把库升到更新的版本：本连接已关闭，这一页要刷新才能继续用。 */
  onSuperseded: () => void;
}

/**
 * 打开本机库。浏览器不给用 IndexedDB 时报 `StorageUnavailableError`；库的版本比 `version` 新时报 `StorageNewerError`。
 * 本连接收到升级请求时立即关闭，不挡别的标签页升级（见 `OpenEvents`）。
 */
export async function openLocalDb<S extends DBSchema>(
  name: string,
  version: number,
  upgrade: NonNullable<OpenDBCallbacks<S>['upgrade']>,
  events: OpenEvents,
): Promise<IDBPDatabase<S>> {
  try {
    const db: IDBPDatabase<S> = await openDB<S>(name, version, {
      upgrade,
      blocked: events.onBlocked,
      blocking() {
        db.close();
        events.onSuperseded();
      },
    });
    return db;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'VersionError') throw new StorageNewerError(name, err);
    throw new StorageUnavailableError(err);
  }
}

/** 写入失败时把配额错误换成 `StorageFullError`，其余原样抛出。 */
export async function writing<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') throw new StorageFullError(err);
    throw err;
  }
}
