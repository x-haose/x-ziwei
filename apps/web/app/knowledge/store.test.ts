import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PACK_ID, DEFAULT_USE, type Use } from './library';
import { LibraryConflictError, StorageUnavailableError, openLibrary } from './store';

/** 测试里只有一个连接，不会遇到版本协调。 */
const NO_EVENTS = { onBlocked: () => undefined, onSuperseded: () => undefined };

const overlay = (id: string, base = DEFAULT_PACK_ID) => ({ schema: 1, id, version: '1', extends: base });

/** 绕过 Library 直接改库里的组合，模拟别的标签页或旧版本写下的数据。 */
function putUseRaw(value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('xzw-knowledge');
    req.onsuccess = () => {
      const tx = req.result.transaction('state', 'readwrite');
      tx.objectStore('state').put(value, 'use');
      tx.oncomplete = () => {
        req.result.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('本机知识包库（IndexedDB）', () => {
  it('存入的包与组合重新打开后还在，包按导入先后排列', async () => {
    const lib = await openLibrary(NO_EVENTS);
    expect(await lib.load()).toEqual({ packs: [], use: DEFAULT_USE, repaired: [] });
    await lib.add(overlay('b'), 2);
    await lib.add(overlay('a'), 1);
    await lib.updateUse((u) => ({ ...u, stack: ['a'] }));
    lib.close();
    const again = await openLibrary(NO_EVENTS);
    const snap = await again.load();
    expect(snap.packs.map((p) => p.id)).toEqual(['a', 'b']);
    expect(snap.use.stack).toEqual(['a']);
    again.close();
  });

  it('按库里此刻的包查本机包库的规则：同 id、基于不在本机的包都拒绝，库不变', async () => {
    const lib = await openLibrary(NO_EVENTS);
    await lib.add(overlay('a'), 1);
    await expect(lib.add({ ...overlay('a'), version: '2' }, 2)).rejects.toBeInstanceOf(LibraryConflictError);
    await expect(lib.add(overlay('c', 'gone'), 3)).rejects.toBeInstanceOf(LibraryConflictError);
    const snap = await lib.load();
    expect(snap.packs.map((p) => [p.id, p.version])).toEqual([['a', '1']]);
    lib.close();
  });

  it('删包与按删包规则改组合在同一个事务里', async () => {
    const lib = await openLibrary(NO_EVENTS);
    await lib.add(overlay('a'), 1);
    await lib.updateUse((u) => ({ ...u, stack: ['a'] }));
    const snap = await lib.remove('a');
    expect(snap).toEqual({ packs: [], use: DEFAULT_USE, repaired: [] });
    lib.close();
  });

  it('改组合按库里此刻的包校验：别处删了的包不会被写进组合', async () => {
    const lib = await openLibrary(NO_EVENTS);
    await lib.add(overlay('p1'), 1);
    await lib.add(overlay('p2'), 2);
    const stale: Use = { ...DEFAULT_USE, stack: ['p1'] };
    await lib.updateUse(() => stale);
    await lib.remove('p1');
    await expect(lib.updateUse(() => ({ ...stale, stack: ['p1', 'p2'] }))).rejects.toThrow();
    expect((await lib.load()).use.stack).toEqual([]);
    const snap = await lib.updateUse((u) => ({ ...u, stack: [...u.stack, 'p2'] }));
    expect(snap.use.stack).toEqual(['p2']);
    lib.close();
  });

  it('读到的组合引用了不在本机的包：按删包规则移出、写回，并列出移出的包', async () => {
    const lib = await openLibrary(NO_EVENTS);
    await lib.add(overlay('p2'), 2);
    await putUseRaw({ mode: 'stack', stack: ['p1', 'p2'], whole: 'gone', wholeStack: ['x'] });
    const snap = await lib.load();
    expect(snap.use).toEqual({ mode: 'stack', stack: ['p2'], whole: DEFAULT_PACK_ID, wholeStack: [] });
    expect(snap.repaired.sort()).toEqual(['gone', 'p1', 'x']);
    expect((await lib.load()).repaired).toEqual([]);
    lib.close();
  });

  it('存的组合形状不对是数据损坏，读库报错', async () => {
    const lib = await openLibrary(NO_EVENTS);
    await putUseRaw({ mode: 'oops' });
    await expect(lib.load()).rejects.toThrow(/损坏/);
    lib.close();
  });
});

describe('库的版本升级', () => {
  it('版本 1 存的生效组合补上整包模式的叠加', async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('xzw-knowledge', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('packs', { keyPath: 'id' });
        db.createObjectStore('state').put({ mode: 'whole', stack: [], whole: 'iztro-docs' }, 'use');
      };
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
    const lib = await openLibrary(NO_EVENTS);
    expect((await lib.load()).use).toEqual({ mode: 'whole', stack: [], whole: 'iztro-docs', wholeStack: [] });
    lib.close();
  });
});

describe('浏览器不给用 IndexedDB', () => {
  const saved = globalThis.indexedDB;
  afterEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, writable: true, value: saved });
  });

  it('打开时报 StorageUnavailableError', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
    await expect(openLibrary(NO_EVENTS)).rejects.toBeInstanceOf(StorageUnavailableError);
  });
});

describe('与其他标签页的版本协调', () => {
  it('本连接收到更新版本的升级请求时立即关闭、通知本页；对方的升级得以完成', async () => {
    let superseded = 0;
    const lib = await openLibrary({ onBlocked: () => undefined, onSuperseded: () => superseded++ });
    await lib.load();
    const newer = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('xzw-knowledge', 99);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(superseded).toBe(1);
    newer.close();
  });

  it('别处开着旧版本的连接挡住升级时通知本页，旧连接关掉后打开继续完成', async () => {
    const old = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('xzw-knowledge', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('packs', { keyPath: 'id' });
        req.result.createObjectStore('state');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    let blocked = 0;
    const opening = openLibrary({
      onBlocked: () => {
        blocked++;
        old.close();
      },
      onSuperseded: () => undefined,
    });
    const lib = await opening;
    expect(blocked).toBe(1);
    expect((await lib.load()).use).toEqual(DEFAULT_USE);
    lib.close();
  });
});
