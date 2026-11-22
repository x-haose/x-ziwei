/**
 * 改写 SFNT（TrueType/OpenType）字体的 `name` 表，用于给带保留字体名（RFN）的 OFL 字体改名。
 *
 * OFL 第 3 条：修改版（切片、转 WOFF2 都算）不得使用保留字体名。这里把字体对外的名字
 * （族名、全名、PostScript 名、唯一标识等）按替换表改掉；版权、商标、厂商、设计师、描述、
 * 网址与许可证字段（nameID 0、7–14）原样保留，许可证要求每份副本都带着它们。
 *
 * 只改 `name` 表：其余各表的字节原样搬过去，重新计算表目录里的偏移与校验和，以及
 * `head.checkSumAdjustment`。
 */

/** 原样保留的 nameID：版权、商标、厂商、设计师、描述、厂商网址、设计师网址、许可证描述、许可证网址。 */
const PRESERVED_NAME_IDS = new Set([0, 7, 8, 9, 10, 11, 12, 13, 14]);

/** 一条 `name` 记录，`value` 已按平台编码解码成 JS 字符串。 */
export interface NameRecord {
  platformId: number;
  encodingId: number;
  languageId: number;
  nameId: number;
  value: string;
}

interface TableRecord {
  tag: string;
  checksum: number;
  offset: number;
  length: number;
}

function readTag(view: DataView, at: number): string {
  return String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3));
}

function readTables(font: Uint8Array): { view: DataView; tables: TableRecord[] } {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
  const version = view.getUint32(0);
  if (version !== 0x00010000 && version !== 0x4f54544f) {
    throw new Error(`不是 SFNT 字体（版本号 0x${version.toString(16)}）；WOFF/WOFF2 要先解包`);
  }
  const count = view.getUint16(4);
  const tables: TableRecord[] = [];
  for (let i = 0; i < count; i++) {
    const at = 12 + i * 16;
    tables.push({
      tag: readTag(view, at),
      checksum: view.getUint32(at + 4),
      offset: view.getUint32(at + 8),
      length: view.getUint32(at + 12),
    });
  }
  return { view, tables };
}

/** 表的校验和：按 4 字节大端无符号整数求和，末尾不足 4 字节补零。 */
export function tableChecksum(data: Uint8Array): number {
  let sum = 0;
  const padded = new Uint8Array((data.length + 3) & ~3);
  padded.set(data);
  const view = new DataView(padded.buffer);
  for (let i = 0; i < padded.length; i += 4) sum = (sum + view.getUint32(i)) >>> 0;
  return sum;
}

/** Windows 与 Unicode 平台的名字是 UTF-16BE；Mac Roman（平台 1、编码 0）只接受 ASCII。 */
function isUtf16(platformId: number): boolean {
  return platformId === 0 || platformId === 3;
}

function decodeName(bytes: Uint8Array, platformId: number, encodingId: number): string {
  if (isUtf16(platformId)) {
    let s = '';
    for (let i = 0; i + 1 < bytes.length; i += 2) s += String.fromCharCode((bytes[i]! << 8) | bytes[i + 1]!);
    return s;
  }
  if (platformId === 1 && encodingId === 0) {
    // Mac Roman 的低 128 位与 ASCII 相同；高位字符原样按 Latin-1 读出，写回时再校验。
    return String.fromCharCode(...bytes);
  }
  throw new Error(`不支持的 name 记录编码：平台 ${platformId}，编码 ${encodingId}`);
}

function encodeName(value: string, platformId: number): Uint8Array {
  if (isUtf16(platformId)) {
    const out = new Uint8Array(value.length * 2);
    for (let i = 0; i < value.length; i++) {
      const c = value.charCodeAt(i);
      out[i * 2] = c >> 8;
      out[i * 2 + 1] = c & 0xff;
    }
    return out;
  }
  const out = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c > 0xff) throw new Error(`Mac Roman 名字里出现了无法编码的字符：${value}`);
    out[i] = c;
  }
  return out;
}

/** 读出 `name` 表的全部记录。 */
export function readNames(font: Uint8Array): NameRecord[] {
  const { view, tables } = readTables(font);
  const name = tables.find((t) => t.tag === 'name');
  if (!name) throw new Error('字体里没有 name 表');
  const base = name.offset;
  const count = view.getUint16(base + 2);
  const storage = base + view.getUint16(base + 4);
  const records: NameRecord[] = [];
  for (let i = 0; i < count; i++) {
    const at = base + 6 + i * 12;
    const platformId = view.getUint16(at);
    const encodingId = view.getUint16(at + 2);
    const length = view.getUint16(at + 8);
    const offset = view.getUint16(at + 10);
    const bytes = font.subarray(storage + offset, storage + offset + length);
    records.push({
      platformId,
      encodingId,
      languageId: view.getUint16(at + 4),
      nameId: view.getUint16(at + 6),
      value: decodeName(bytes, platformId, encodingId),
    });
  }
  return records;
}

/**
 * 按 0 版格式重建 `name` 表。记录按（平台、编码、语言、nameID）排序，这是规范要求的顺序。
 * 1 版格式的语言标签记录只服务于 languageID ≥ 0x8000 的记录；遇到这种记录直接报错，
 * 本项目用到的字体都没有。
 */
function buildNameTable(records: NameRecord[]): Uint8Array {
  if (records.some((r) => r.languageId >= 0x8000)) {
    throw new Error('name 表含语言标签记录（format 1），改名逻辑不支持');
  }
  const sorted = [...records].sort(
    (a, b) => a.platformId - b.platformId || a.encodingId - b.encodingId || a.languageId - b.languageId || a.nameId - b.nameId,
  );
  const encoded = sorted.map((r) => encodeName(r.value, r.platformId));
  const headerSize = 6 + sorted.length * 12;
  const storageSize = encoded.reduce((n, e) => n + e.length, 0);
  if (storageSize > 0xffff) throw new Error('name 表字符串区超过 64 KB');
  const out = new Uint8Array(headerSize + storageSize);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0);
  view.setUint16(2, sorted.length);
  view.setUint16(4, headerSize);
  let offset = 0;
  sorted.forEach((r, i) => {
    const at = 6 + i * 12;
    const bytes = encoded[i]!;
    view.setUint16(at, r.platformId);
    view.setUint16(at + 2, r.encodingId);
    view.setUint16(at + 4, r.languageId);
    view.setUint16(at + 6, r.nameId);
    view.setUint16(at + 8, bytes.length);
    view.setUint16(at + 10, offset);
    out.set(bytes, headerSize + offset);
    offset += bytes.length;
  });
  return out;
}

/** 用新的 `name` 表替换旧表，其余表原样保留，重算目录、校验和与 `head.checkSumAdjustment`。 */
function replaceNameTable(font: Uint8Array, nameTable: Uint8Array): Uint8Array {
  const { tables } = readTables(font);
  const datas = tables.map((t) => (t.tag === 'name' ? nameTable : font.subarray(t.offset, t.offset + t.length)));
  const dirSize = 12 + tables.length * 16;
  let total = dirSize;
  const offsets = datas.map((d) => {
    const at = total;
    total += (d.length + 3) & ~3;
    return at;
  });
  const out = new Uint8Array(total);
  // 目录头（版本、表数与二分查找字段）照抄：表的数目与顺序都没有变。
  out.set(font.subarray(0, 12));
  const outView = new DataView(out.buffer);
  let headOffset = -1;
  tables.forEach((t, i) => {
    const data = datas[i]!;
    const at = 12 + i * 16;
    out.set(data, offsets[i]!);
    if (t.tag === 'head') {
      headOffset = offsets[i]!;
      // head 的校验和按 checkSumAdjustment 为 0 计算。
      outView.setUint32(headOffset + 8, 0);
    }
    for (let k = 0; k < 4; k++) outView.setUint8(at + k, t.tag.charCodeAt(k));
    outView.setUint32(at + 4, tableChecksum(out.subarray(offsets[i]!, offsets[i]! + data.length)));
    outView.setUint32(at + 8, offsets[i]!);
    outView.setUint32(at + 12, data.length);
  });
  if (headOffset < 0) throw new Error('字体里没有 head 表');
  outView.setUint32(headOffset + 8, (0xb1b0afba - tableChecksum(out)) >>> 0);
  return out;
}

/**
 * 把字体对外的名字按 `replacements` 逐对替换（子串替换，按给出的顺序）。
 * 版权、商标与许可证等字段原样保留。替换后若任何对外名字里仍含 `forbidden` 中的子串，抛错：
 * 这说明替换表没覆盖到字体里的某种写法，生成的文件会违反许可证。
 */
export function renameFont(
  font: Uint8Array,
  replacements: ReadonlyArray<readonly [from: string, to: string]>,
  forbidden: readonly string[],
): Uint8Array {
  const records = readNames(font).map((r) => {
    if (PRESERVED_NAME_IDS.has(r.nameId)) return r;
    let value = r.value;
    for (const [from, to] of replacements) value = value.split(from).join(to);
    return { ...r, value };
  });
  for (const r of records) {
    if (PRESERVED_NAME_IDS.has(r.nameId)) continue;
    const hit = forbidden.find((f) => r.value.includes(f));
    if (hit) throw new Error(`改名后 nameID ${r.nameId} 仍含「${hit}」：${r.value}`);
  }
  return replaceNameTable(font, buildNameTable(records));
}
