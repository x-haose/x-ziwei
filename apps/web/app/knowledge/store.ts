import type { DBSchema, IDBPDatabase, IDBPTransaction } from 'idb';
import { type OpenEvents, openLocalDb, writing } from '../lib/local-db';
import {
  DEFAULT_USE,
  type Draft,
  type DraftConflict,
  draftConflict,
    type LibraryProblem,
  type Pack,
  type PackRaw,
  type StoredPack,
  type Use,
  checkUse,
  describePack,
  libraryProblems,
  migrateUse,
  repairUse,
  addLayer,
  withoutPack,
} from './library';

/**
 * 本机知识包库：浏览器的 IndexedDB（库 `xzw-knowledge`），`packs` 存包的原文与导入、保存时间，`state` 的 `use` 存生效组合，
 * `drafts` 存编辑器的草稿（不进包库、不参与释义）。包与草稿只在这台设备的浏览器里，不上传。
 *
 * 同一个浏览器里可能开着几个标签页，各自内存里的包列表会过时。所以每次改动都在一个读写事务里完成：
 * 先读库里此刻的包与组合，用它们校验，再写入；事务之外不拿内存里的数据做判断。
 */

interface Schema extends DBSchema {
  packs: { key: string; value: StoredPack };
  state: { key: 'use'; value: Use };
  drafts: { key: string; value: Draft };
}

const DB_NAME = 'xzw-knowledge';
/**
 * 4：加编辑器的草稿 `drafts`。
 * 3：生效组合改为有序叠放的列表 `{ layers }`（1、2 存的是叠加 / 整包两种模式，见 `migrateUse`）。
 * 2：组合加了整包模式的叠加 `wholeStack`。
 */
const DB_VERSION = 4;

/** 按库里此刻的包，要存的包不合本机包库的规则（如另一个标签页刚存了同 id 的包）；这次写入没有发生。 */
export class LibraryConflictError extends Error {
  constructor(readonly problems: LibraryProblem[]) {
    super(`本机包库的规则不允许存入：${problems.map((p) => p.code).join(', ')}`);
    this.name = 'LibraryConflictError';
  }
}

/** 库里此刻的包、生效组合与草稿（按上次编辑从新到旧）。`repaired` 是这次读取时从组合里移出的包（组合与包库对不上时）。 */
export interface Snapshot {
  packs: Pack[];
  use: Use;
  drafts: Draft[];
  repaired: string[];
}

/**
 * 草稿与库里的数据对不上，这次写入没有发生：`edited` 别的标签页改过这份草稿；`stale` 包库里这个包已不是开始编辑时的那一版；
 * `packGone` 编辑的包已被删除。
 */
export class DraftConflictError extends Error {
  constructor(readonly kind: 'edited' | DraftConflict) {
    super(`草稿与库里的数据对不上：${kind}`);
    this.name = 'DraftConflictError';
  }
}

/** 要保存的草稿不在库里了（别的标签页删除或已保存了它）；这次写入没有发生。 */
export class DraftGoneError extends Error {
  constructor(readonly draftId: string) {
    super(`草稿 ${draftId} 已不在本机`);
    this.name = 'DraftGoneError';
  }
}

function isUse(v: unknown): v is Use {
  if (typeof v !== 'object' || v === null) return false;
  const u = v as Record<string, unknown>;
  const ids = (x: unknown) => Array.isArray(x) && x.every((y) => typeof y === 'string');
  return ids(u.layers);
}

type Tx = IDBPTransaction<Schema, ('packs' | 'state' | 'drafts')[], 'readwrite'>;

const STORES = ['packs', 'state', 'drafts'] as const;

/** 事务里读出全部包（按导入先后）、生效组合与草稿。存的组合形状不对即是数据损坏，报错。 */
async function readTx(tx: Tx): Promise<{ packs: Pack[]; use: Use; drafts: Draft[] }> {
  const [stored, use, drafts] = await Promise.all([tx.objectStore('packs').getAll(), tx.objectStore('state').get('use'), tx.objectStore('drafts').getAll()]);
  if (use !== undefined && !isUse(use)) throw new Error(`本机知识包库里的生效组合损坏：${JSON.stringify(use)}`);
  const packs = stored.sort((a, b) => a.importedAt - b.importedAt).map((s) => describePack(s.raw, s.importedAt, s.savedAt ?? null));
  return { packs, use: use ?? DEFAULT_USE, drafts: drafts.sort((a, b) => b.updatedAt - a.updatedAt) };
}

export class Library {
  constructor(private readonly db: IDBPDatabase<Schema>) {}

  /** 在一个读写事务里读、改、再读；`run` 抛错时事务里已发出的写入随事务失败作废，错误原样抛出。 */
  private async change(run: (tx: Tx, now: { packs: Pack[]; use: Use; drafts: Draft[] }) => Promise<Use>): Promise<Snapshot> {
    return writing(async () => {
      const tx = this.db.transaction([...STORES], 'readwrite');
      // run 中途抛错时这里的失败与抛出的是同一件事，由下面 await 处或调用方收到的错误报告。
      const done = tx.done.catch((err: unknown) => err);
      const now = await readTx(tx);
      const use = await run(tx, now);
      const after = await readTx(tx);
      const failed = await done;
      if (failed) throw failed;
      return { packs: after.packs, use, drafts: after.drafts, repaired: [] };
    });
  }

  /**
   * 读出包与组合。组合引用了不在本机或用法不对的包时（另一个标签页删了包等），按删包的规则移出它们并写回，
   * 在 `repaired` 里列出；不把整个库当成坏的。
   */
  async load(): Promise<Snapshot> {
    return writing(async () => {
      const tx = this.db.transaction([...STORES], 'readwrite');
      const { packs, use, drafts } = await readTx(tx);
      const fixed = repairUse(use, packs);
      if (fixed.dropped.length) await tx.objectStore('state').put(fixed.use, 'use');
      await tx.done;
      return { packs, use: fixed.use, drafts, repaired: fixed.dropped };
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

  /** 存一份草稿（新建或覆盖同标识的那份）。 */
  /** 新建一份草稿。 */
  async createDraft(draft: Draft): Promise<Snapshot> {
    return this.change(async (tx, now) => {
      await tx.objectStore('drafts').add(draft);
      return now.use;
    });
  }

  /**
   * 写下草稿的原文。以库里此刻的草稿为准，只换原文与更新时间；库里那份的更新时间不是 `known`（本页上次读到或写下的版本）时，
   * 说明别的标签页改过它，报 `DraftConflictError('edited')`、不写。草稿已不在时报 `DraftGoneError`。
   */
  async writeDraft(id: string, raw: PackRaw, known: number, at: number): Promise<Snapshot> {
    return this.change(async (tx, now) => {
      const cur = await tx.objectStore('drafts').get(id);
      if (!cur) throw new DraftGoneError(id);
      if (cur.updatedAt !== known) throw new DraftConflictError('edited');
      await tx.objectStore('drafts').put({ ...cur, raw, updatedAt: at });
      return now.use;
    });
  }

  /** 丢弃一份草稿；包库不受影响。 */
  async deleteDraft(id: string): Promise<Snapshot> {
    return this.change(async (tx, now) => {
      await tx.objectStore('drafts').delete(id);
      return now.use;
    });
  }

  /**
   * 把草稿存进包库（设计规范 20.11）；同一个事务里草稿改为编辑这个包、与包库一致，`use` 为真时再把它放到生效组合的最上面（`addLayer`）。
   * 按库里此刻的数据再查一遍，不合时什么都不写：
   * - 草稿不在（`DraftGoneError`），或别的标签页改过它（`DraftConflictError('edited')`）；
   * - 编辑本机的包时：那个包已被删除（`'packGone'`），或包库里那一版不是开始编辑时的那一版（`'stale'`，别的标签页保存过、或删掉后重新导入了同标识的包）；
   * - 本机包库的标识规则（`LibraryConflictError`）。
   * 包格式的检查在调用之前由内核做过。
   */
  async saveDraft(id: string, raw: PackRaw, known: number, at: number, use: boolean): Promise<Snapshot> {
    return this.change(async (tx, now) => {
      const cur = await tx.objectStore('drafts').get(id);
      if (!cur) throw new DraftGoneError(id);
      if (cur.updatedAt !== known) throw new DraftConflictError('edited');
      const conflict = draftConflict(cur, now.packs);
      if (conflict) throw new DraftConflictError(conflict);
      const problems = libraryProblems(raw, now.packs, cur.editing);
      if (problems.length) throw new LibraryConflictError(problems);
      const packId = String(raw.id);
      const old = await tx.objectStore('packs').get(packId);
      await tx.objectStore('packs').put({ id: packId, raw, importedAt: old?.importedAt ?? at, savedAt: at });
      // 草稿留下、与包库一致（编辑器接着显示这个包）；与包库一致的草稿不列在草稿区。
      await tx.objectStore('drafts').put({ ...cur, raw, editing: packId, snapshot: raw, updatedAt: at });
      if (!use) return now.use;
      const next = addLayer(now.use, packId);
      await tx.objectStore('state').put(next, 'use');
      return next;
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
      if (oldVersion < 4) d.createObjectStore('drafts', { keyPath: 'id' });
      if (oldVersion >= 1 && oldVersion < 3) {
        // 旧的两种模式无损转成列表。认不出的旧值原样留着：读库时按「组合损坏」报出（见 readTx），不悄悄换成默认组合。
        const state = tx.objectStore('state');
        const old: unknown = await state.get('use');
        const use = old === undefined ? null : migrateUse(old);
        if (use) await state.put(use, 'use');
      }
    },
    events,
  );
  return new Library(db);
}
