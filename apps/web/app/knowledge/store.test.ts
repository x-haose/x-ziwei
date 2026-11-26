import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PACK_ID, DEFAULT_USE, type Draft, type Use } from './library';
import { StorageNewerError, StorageUnavailableError } from '../lib/local-db';
import { DraftConflictError, DraftGoneError, LibraryConflictError, openLibrary } from './store';

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
    expect(await lib.load()).toEqual({ packs: [], use: DEFAULT_USE, drafts: [], repaired: [] });
    await lib.add(overlay('b'), 2);
    await lib.add(overlay('a'), 1);
    await lib.updateUse(() => ({ layers: ['a', DEFAULT_PACK_ID] }));
    lib.close();
    const again = await openLibrary(NO_EVENTS);
    const snap = await again.load();
    expect(snap.packs.map((p) => p.id)).toEqual(['a', 'b']);
    expect(snap.use.layers).toEqual(['a', DEFAULT_PACK_ID]);
    again.close();
  });

  it('按库里此刻的包查本机包库的规则：同 id 拒绝、库不变；声明基于不在本机的包照常存入', async () => {
    const lib = await openLibrary(NO_EVENTS);
    await lib.add(overlay('a'), 1);
    await expect(lib.add({ ...overlay('a'), version: '2' }, 2)).rejects.toBeInstanceOf(LibraryConflictError);
    await lib.add(overlay('c', 'gone'), 3);
    const snap = await lib.load();
    expect(snap.packs.map((p) => [p.id, p.version])).toEqual([['a', '1'], ['c', '1']]);
    lib.close();
  });

  it('删包与按删包规则改组合在同一个事务里', async () => {
    const lib = await openLibrary(NO_EVENTS);
    await lib.add(overlay('a'), 1);
    await lib.updateUse(() => ({ layers: ['a'] }));
    const snap = await lib.remove('a');
    expect(snap).toEqual({ packs: [], use: DEFAULT_USE, drafts: [], repaired: [] });
    lib.close();
  });

  it('改组合按库里此刻的包校验：别处删了的包不会被写进组合', async () => {
    const lib = await openLibrary(NO_EVENTS);
    await lib.add(overlay('p1'), 1);
    await lib.add(overlay('p2'), 2);
    const stale: Use = { layers: [DEFAULT_PACK_ID, 'p1'] };
    await lib.updateUse(() => stale);
    await lib.remove('p1');
    await expect(lib.updateUse(() => ({ layers: [...stale.layers, 'p2'] }))).rejects.toThrow();
    expect((await lib.load()).use).toEqual(DEFAULT_USE);
    const snap = await lib.updateUse((u) => ({ layers: [...u.layers, 'p2'] }));
    expect(snap.use.layers).toEqual([DEFAULT_PACK_ID, 'p2']);
    lib.close();
  });

  it('读到的组合引用了不在本机的包：按删包规则移出、写回，并列出移出的包', async () => {
    const lib = await openLibrary(NO_EVENTS);
    await lib.add(overlay('p2'), 2);
    await putUseRaw({ layers: ['p1', 'p2', 'p2'] });
    const snap = await lib.load();
    expect(snap.use).toEqual({ layers: ['p2'] });
    expect(snap.repaired.sort()).toEqual(['p1', 'p2']);
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
  /** 按旧版本建库并写入组合（与包），模拟旧版本的网页留下的数据。 */
  const legacy = (version: number, use: unknown, packs: unknown[] = []) =>
    new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('xzw-knowledge', version);
      req.onupgradeneeded = () => {
        const db = req.result;
        const store = db.createObjectStore('packs', { keyPath: 'id' });
        for (const p of packs) store.put(p);
        db.createObjectStore('state').put(use, 'use');
      };
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });

  it('版本 2 的叠加模式 → 默认包加叠加；整包模式 → 整包加它的叠加', async () => {
    const packs = ['a', 'b'].map((id, i) => ({ id, raw: overlay(id), importedAt: i }));
    await legacy(2, { mode: 'stack', stack: ['a', 'b'], whole: 'iztro-docs', wholeStack: [] }, packs);
    let lib = await openLibrary(NO_EVENTS);
    expect((await lib.load()).use).toEqual({ layers: [DEFAULT_PACK_ID, 'a', 'b'] });
    lib.close();
    globalThis.indexedDB = new IDBFactory();
    const whole = [{ id: 'school', raw: { schema: 1, id: 'school', version: '1' }, importedAt: 1 }, { id: 'on', raw: overlay('on', 'school'), importedAt: 2 }];
    await legacy(2, { mode: 'whole', stack: [], whole: 'school', wholeStack: ['on'] }, whole);
    lib = await openLibrary(NO_EVENTS);
    expect((await lib.load()).use).toEqual({ layers: ['school', 'on'] });
    lib.close();
  });

  it('版本 1 的组合（没有 wholeStack）同样转换', async () => {
    await legacy(1, { mode: 'whole', stack: [], whole: 'iztro-docs' });
    const lib = await openLibrary(NO_EVENTS);
    expect((await lib.load()).use).toEqual(DEFAULT_USE);
    lib.close();
  });

  it('认不出的旧组合不悄悄换成默认组合：读库时报损坏', async () => {
    await legacy(2, { mode: 'oops' });
    const lib = await openLibrary(NO_EVENTS);
    await expect(lib.load()).rejects.toThrow(/损坏/);
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
  it('本机的库比本页代码新（本站回退过版本）时报 StorageNewerError，不当成存储不可用', async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('xzw-knowledge', 50);
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
    await expect(openLibrary(NO_EVENTS)).rejects.toBeInstanceOf(StorageNewerError);
  });

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

  describe('编辑器的草稿', () => {
    const draft = (id: string, raw: Record<string, unknown>, editing: string | null = null, snapshot: Record<string, unknown> | null = null): Draft => ({ id, raw, editing, snapshot, createdAt: 1, updatedAt: 1 });

    it('草稿不进包库；保存新包时存入包库、草稿改为与包库一致，要求时一并放到生效组合最上面', async () => {
      const lib = await openLibrary(NO_EVENTS);
      await lib.createDraft(draft('d1', overlay('mine')));
      let snap = await lib.load();
      expect(snap.packs).toEqual([]);
      snap = await lib.saveDraft('d1', overlay('mine'), 1, 5, true);
      expect(snap.packs.map((p) => [p.id, p.importedAt, p.savedAt])).toEqual([['mine', 5, 5]]);
      expect(snap.drafts.map((d) => [d.id, d.editing, d.updatedAt, JSON.stringify(d.snapshot) === JSON.stringify(d.raw)])).toEqual([['d1', 'mine', 5, true]]);
      expect(snap.use.layers).toEqual([DEFAULT_PACK_ID, 'mine']);
      lib.close();
    });

    it('写草稿以库里当前版本为准：别的标签页改过（更新时间对不上）时报冲突、不写', async () => {
      const lib = await openLibrary(NO_EVENTS);
      await lib.createDraft(draft('d1', overlay('mine')));
      await lib.writeDraft('d1', { ...overlay('mine'), version: '2' }, 1, 7);
      await expect(lib.writeDraft('d1', { ...overlay('mine'), version: '3' }, 1, 8)).rejects.toMatchObject({ kind: 'edited' });
      await expect(lib.saveDraft('d1', overlay('mine'), 1, 9, false)).rejects.toBeInstanceOf(DraftConflictError);
      await expect(lib.writeDraft('gone', overlay('x'), 1, 9)).rejects.toBeInstanceOf(DraftGoneError);
      const snap = await lib.load();
      expect(snap.drafts.map((d) => [d.updatedAt, d.raw.version])).toEqual([[7, '2']]);
      expect(snap.packs).toEqual([]);
      lib.close();
    });

    it('编辑的包被删除后草稿留着；重新导入同标识的包后，旧草稿不能覆盖它', async () => {
      const lib = await openLibrary(NO_EVENTS);
      await lib.add(overlay('mine'), 1);
      await lib.createDraft(draft('d1', { ...overlay('mine'), version: '2' }, 'mine', overlay('mine')));
      await lib.remove('mine');
      let snap = await lib.load();
      expect(snap.drafts.map((d) => d.id)).toEqual(['d1']);
      await expect(lib.saveDraft('d1', { ...overlay('mine'), version: '2' }, 1, 5, false)).rejects.toMatchObject({ kind: 'packGone' });
      await lib.add({ ...overlay('mine'), version: 'imported' }, 6);
      await expect(lib.saveDraft('d1', { ...overlay('mine'), version: '2' }, 1, 7, false)).rejects.toMatchObject({ kind: 'stale' });
      snap = await lib.load();
      expect(snap.packs.map((p) => [p.id, p.version])).toEqual([['mine', 'imported']]);
      lib.close();
    });

    it('新包的标识与本机的包重复时拒绝且库不变；丢弃草稿不动包库', async () => {
      const lib = await openLibrary(NO_EVENTS);
      await lib.add(overlay('mine'), 1);
      await lib.createDraft(draft('d2', overlay('mine')));
      await expect(lib.saveDraft('d2', overlay('mine'), 1, 10, false)).rejects.toBeInstanceOf(LibraryConflictError);
      const snap = await lib.deleteDraft('d2');
      expect(snap.drafts).toEqual([]);
      expect(snap.packs.map((p) => p.id)).toEqual(['mine']);
      lib.close();
    });
  });
});
