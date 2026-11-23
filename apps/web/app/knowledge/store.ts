import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import { DEFAULT_USE, type StoredPack, type Use } from './library';

/**
 * 本机知识包库：浏览器的 IndexedDB（库 `xzw-knowledge`），`packs` 存包的原文与导入时间，`state` 的 `use` 存生效组合。
 * 包只在这台设备的浏览器里，不上传。改包与改组合在同一个事务里提交，要么都成、要么都不成。
 */

interface Schema extends DBSchema {
  packs: { key: string; value: StoredPack };
  state: { key: 'use'; value: Use };
}

const DB_NAME = 'xzw-knowledge';
const DB_VERSION = 1;

/** 浏览器不让本页用 IndexedDB（隐私窗口、关了网站数据等）。默认包照常可用，导入关闭。 */
export class StorageUnavailableError extends Error {
  constructor(cause: unknown) {
    super('这个浏览器不让本页存数据', { cause });
    this.name = 'StorageUnavailableError';
  }
}

/** 浏览器给本站的存储空间满了，写入被拒绝；这次写入没有发生。 */
export class StorageFullError extends Error {
  constructor(cause: unknown) {
    super('这台设备给本站的存储空间满了', { cause });
    this.name = 'StorageFullError';
  }
}

/** 写入失败时把配额错误换成 `StorageFullError`，其余原样抛出。 */
async function writing<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') throw new StorageFullError(err);
    throw err;
  }
}

function isUse(v: unknown): v is Use {
  if (typeof v !== 'object' || v === null) return false;
  const u = v as Record<string, unknown>;
  return (
    (u.mode === 'stack' || u.mode === 'whole') &&
    Array.isArray(u.stack) &&
    u.stack.every((x) => typeof x === 'string') &&
    typeof u.whole === 'string'
  );
}

export class Library {
  constructor(private readonly db: IDBPDatabase<Schema>) {}

  /** 全部本机包，按导入先后。 */
  async packs(): Promise<StoredPack[]> {
    const all = await this.db.getAll('packs');
    return all.sort((a, b) => a.importedAt - b.importedAt);
  }

  /** 生效组合；从没设过时是默认（只用默认包）。存的值形状不对即是数据损坏，报错。 */
  async use(): Promise<Use> {
    const v = await this.db.get('state', 'use');
    if (v === undefined) return DEFAULT_USE;
    if (!isUse(v)) throw new Error(`本机知识包库里的生效组合损坏：${JSON.stringify(v)}`);
    return v;
  }

  /** 存入一个新包。同 `id` 的包已存在时报错（导入前已查过，这里是兜底的约束）。 */
  async add(pack: StoredPack): Promise<void> {
    await writing(async () => {
      const tx = this.db.transaction('packs', 'readwrite');
      await Promise.all([tx.store.add(pack), tx.done]);
    });
  }

  /** 删掉一个包，并在同一个事务里写入删后的生效组合。 */
  async remove(id: string, use: Use): Promise<void> {
    await writing(async () => {
      const tx = this.db.transaction(['packs', 'state'], 'readwrite');
      await Promise.all([tx.objectStore('packs').delete(id), tx.objectStore('state').put(use, 'use'), tx.done]);
    });
  }

  async setUse(use: Use): Promise<void> {
    await writing(() => this.db.put('state', use, 'use'));
  }

  close(): void {
    this.db.close();
  }
}

/** 打开本机包库。浏览器不给用 IndexedDB 时报 `StorageUnavailableError`。 */
export async function openLibrary(): Promise<Library> {
  let db: IDBPDatabase<Schema>;
  try {
    db = await openDB<Schema>(DB_NAME, DB_VERSION, {
      upgrade(d) {
        d.createObjectStore('packs', { keyPath: 'id' });
        d.createObjectStore('state');
      },
    });
  } catch (err) {
    throw new StorageUnavailableError(err);
  }
  return new Library(db);
}
