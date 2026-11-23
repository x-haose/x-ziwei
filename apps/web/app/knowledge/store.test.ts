import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_USE } from './library';
import { StorageUnavailableError, openLibrary } from './store';

const raw = (id: string) => ({ schema: 1, id, version: '1' });

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('本机知识包库（IndexedDB）', () => {
  it('存入的包与生效组合重新打开后还在，包按导入先后排列', async () => {
    const lib = await openLibrary();
    expect(await lib.packs()).toEqual([]);
    expect(await lib.use()).toEqual(DEFAULT_USE);
    await lib.add({ id: 'b', raw: raw('b'), importedAt: 2 });
    await lib.add({ id: 'a', raw: raw('a'), importedAt: 1 });
    await lib.setUse({ mode: 'stack', stack: ['a'], whole: 'iztro-docs' });
    lib.close();
    const again = await openLibrary();
    expect((await again.packs()).map((p) => p.id)).toEqual(['a', 'b']);
    expect(await again.use()).toEqual({ mode: 'stack', stack: ['a'], whole: 'iztro-docs' });
    again.close();
  });

  it('同 id 再存报错，库不变', async () => {
    const lib = await openLibrary();
    await lib.add({ id: 'a', raw: raw('a'), importedAt: 1 });
    await expect(lib.add({ id: 'a', raw: { ...raw('a'), version: '2' }, importedAt: 2 })).rejects.toThrow();
    expect((await lib.packs()).map((p) => p.raw.version)).toEqual(['1']);
    lib.close();
  });

  it('删包与改组合在同一个事务里', async () => {
    const lib = await openLibrary();
    await lib.add({ id: 'a', raw: raw('a'), importedAt: 1 });
    await lib.setUse({ mode: 'stack', stack: ['a'], whole: 'iztro-docs' });
    await lib.remove('a', DEFAULT_USE);
    expect(await lib.packs()).toEqual([]);
    expect(await lib.use()).toEqual(DEFAULT_USE);
    lib.close();
  });

  it('存的生效组合形状不对即报错，不当成默认', async () => {
    const lib = await openLibrary();
    await lib.setUse({ mode: 'oops' } as never);
    await expect(lib.use()).rejects.toThrow(/损坏/);
    lib.close();
  });
});

describe('浏览器不给用 IndexedDB', () => {
  const saved = globalThis.indexedDB;
  afterEach(() => {
    globalThis.indexedDB = saved;
  });

  it('打开时报 StorageUnavailableError', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
    await expect(openLibrary()).rejects.toBeInstanceOf(StorageUnavailableError);
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, writable: true, value: saved });
  });
});
