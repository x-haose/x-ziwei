import type { DBSchema, IDBPDatabase, IDBPTransaction } from 'idb';
import { type OpenEvents, openLocalDb, writing } from '../lib/local-db';
import {
  DEFAULT_USE,
  type LibraryProblem,
  type Pack,
  type PackRaw,
  type StoredPack,
  type Use,
  checkUse,
  describePack,
  libraryProblems,
  repairUse,
  withoutPack,
} from './library';

/**
 * 本机知识包库：浏览器的 IndexedDB（库 `xzw-knowledge`），`packs` 存包的原文与导入时间，`state` 的 `use` 存生效组合。
 * 包只在这台设备的浏览器里，不上传。
 *
 * 同一个浏览器里可能开着几个标签页，各自内存里的包列表会过时。所以每次改动都在一个读写事务里完成：
 * 先读库里此刻的包与组合，用它们校验，再写入；事务之外不拿内存里的数据做判断。
 */

interface Schema extends DBSchema {
  packs: { key: string; value: StoredPack };
  state: { key: 'use'; value: Use };
}

const DB_NAME = 'xzw-knowledge';
/** 2：生效组合加了整包模式的叠加 `wholeStack`。 */
const DB_VERSION = 2;

/** 按库里此刻的包，要存的包不合本机包库的规则（如另一个标签页刚存了同 id 的包）；这次写入没有发生。 */
export class LibraryConflictError extends Error {
  constructor(readonly problems: LibraryProblem[]) {
    super(`本机包库的规则不允许存入：${problems.map((p) => p.code).join(', ')}`);
    this.name = 'LibraryConflictError';
  }
}

/** 库里此刻的包与生效组合。`repaired` 是这次读取时从组合里移出的包（组合与包库对不上时）。 */
export interface Snapshot {
  packs: Pack[];
  use: Use;
  repaired: string[];
}

function isUse(v: unknown): v is Use {
  if (typeof v !== 'object' || v === null) return false;
  const u = v as Record<string, unknown>;
  const ids = (x: unknown) => Array.isArray(x) && x.every((y) => typeof y === 'string');
  return (u.mode === 'stack' || u.mode === 'whole') && ids(u.stack) && typeof u.whole === 'string' && ids(u.wholeStack);
}

type Tx = IDBPTransaction<Schema, ('packs' | 'state')[], 'readwrite'>;

/** 事务里读出全部包（按导入先后）与生效组合。存的组合形状不对即是数据损坏，报错。 */
async function readTx(tx: Tx): Promise<{ packs: Pack[]; use: Use }> {
  const [stored, use] = await Promise.all([tx.objectStore('packs').getAll(), tx.objectStore('state').get('use')]);
  if (use !== undefined && !isUse(use)) throw new Error(`本机知识包库里的生效组合损坏：${JSON.stringify(use)}`);
  const packs = stored.sort((a, b) => a.importedAt - b.importedAt).map((s) => describePack(s.raw, s.importedAt));
  return { packs, use: use ?? DEFAULT_USE };
}

export class Library {
  constructor(private readonly db: IDBPDatabase<Schema>) {}

  /** 在一个读写事务里读、改、再读；`run` 抛错时事务里已发出的写入随事务失败作废，错误原样抛出。 */
  private async change(run: (tx: Tx, now: { packs: Pack[]; use: Use }) => Promise<Use>): Promise<Snapshot> {
    return writing(async () => {
      const tx = this.db.transaction(['packs', 'state'], 'readwrite');
      // run 中途抛错时这里的失败与抛出的是同一件事，由下面 await 处或调用方收到的错误报告。
      const done = tx.done.catch((err: unknown) => err);
      const now = await readTx(tx);
      const use = await run(tx, now);
      const after = await readTx(tx);
      const failed = await done;
      if (failed) throw failed;
      return { packs: after.packs, use, repaired: [] };
    });
  }

  /**
   * 读出包与组合。组合引用了不在本机或用法不对的包时（另一个标签页删了包等），按删包的规则移出它们并写回，
   * 在 `repaired` 里列出；不把整个库当成坏的。
   */
  async load(): Promise<Snapshot> {
    return writing(async () => {
      const tx = this.db.transaction(['packs', 'state'], 'readwrite');
      const { packs, use } = await readTx(tx);
      const fixed = repairUse(use, packs);
      if (fixed.dropped.length) await tx.objectStore('state').put(fixed.use, 'use');
      await tx.done;
      return { packs, use: fixed.use, repaired: fixed.dropped };
    });
  }

  /** 存入一个已通过包格式检查的新包；按库里此刻的包再查一遍本机包库的规则，不合时报 `LibraryConflictError`。 */
  async add(raw: PackRaw, importedAt: number): Promise<Snapshot> {
    return this.change(async (tx, now) => {
      const problems = libraryProblems(raw, now.packs);
      if (problems.length) throw new LibraryConflictError(problems);
      const id = describePack(raw, importedAt).id;
      await tx.objectStore('packs').add({ id, raw, importedAt });
      return now.use;
    });
  }

  /** 删掉一个包，组合按删包的规则随之改变（`withoutPack`），同一个事务里写入。 */
  async remove(id: string): Promise<Snapshot> {
    return this.change(async (tx, now) => {
      const next = withoutPack(now.use, id);
      await Promise.all([tx.objectStore('packs').delete(id), tx.objectStore('state').put(next, 'use')]);
      return next;
    });
  }

  /**
   * 改生效组合：`next` 收到库里此刻的组合与包，算出新组合；新组合按库里的包校验（`checkUse`），对不上时报错、不写入。
   */
  async updateUse(next: (use: Use, packs: readonly Pack[]) => Use): Promise<Snapshot> {
    return this.change(async (tx, now) => {
      const use = next(now.use, now.packs);
      checkUse(use, now.packs);
      await tx.objectStore('state').put(use, 'use');
      return use;
    });
  }

  close(): void {
    this.db.close();
  }
}

/**
 * 打开本机包库（错误分类与多标签页协调见 `openLocalDb`）。
 */
export async function openLibrary(events: OpenEvents): Promise<Library> {
  const db = await openLocalDb<Schema>(
    DB_NAME,
    DB_VERSION,
    async (d, oldVersion, _newVersion, tx) => {
      if (oldVersion < 1) {
        d.createObjectStore('packs', { keyPath: 'id' });
        d.createObjectStore('state');
      }
      if (oldVersion < 2) {
        const state = tx.objectStore('state');
        const use = await state.get('use');
        if (use !== undefined) await state.put({ ...use, wholeStack: [] }, 'use');
      }
    },
    events,
  );
  return new Library(db);
}
