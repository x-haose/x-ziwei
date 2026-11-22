import { describe, expect, it } from 'vitest';
import { readNames, renameFont, tableChecksum } from './sfnt';

/** 拼一个只有 head 与 name 两张表的最小 SFNT，name 表含 Windows（UTF-16）与 Mac（ASCII）两种记录。 */
function makeFont(names: { platformId: number; encodingId: number; nameId: number; value: string }[]): Uint8Array {
  const enc = (r: (typeof names)[number]) =>
    r.platformId === 3 ? new Uint8Array([...r.value].flatMap((c) => [c.charCodeAt(0) >> 8, c.charCodeAt(0) & 0xff])) : new TextEncoder().encode(r.value);
  const strings = names.map(enc);
  const nameLen = 6 + names.length * 12 + strings.reduce((n, s) => n + s.length, 0);
  const name = new Uint8Array(nameLen);
  const nv = new DataView(name.buffer);
  nv.setUint16(2, names.length);
  nv.setUint16(4, 6 + names.length * 12);
  let off = 0;
  names.forEach((r, i) => {
    const at = 6 + i * 12;
    nv.setUint16(at, r.platformId);
    nv.setUint16(at + 2, r.encodingId);
    nv.setUint16(at + 4, r.platformId === 3 ? 0x409 : 0);
    nv.setUint16(at + 6, r.nameId);
    nv.setUint16(at + 8, strings[i]!.length);
    nv.setUint16(at + 10, off);
    name.set(strings[i]!, 6 + names.length * 12 + off);
    off += strings[i]!.length;
  });
  const head = new Uint8Array(54);
  new DataView(head.buffer).setUint32(12, 0x5f0f3cf5);
  const tables = [
    ['head', head],
    ['name', name],
  ] as const;
  const pad = (n: number) => (n + 3) & ~3;
  const font = new Uint8Array(12 + 32 + pad(head.length) + pad(name.length));
  const fv = new DataView(font.buffer);
  fv.setUint32(0, 0x00010000);
  fv.setUint16(4, 2);
  let at = 44;
  tables.forEach(([tag, data], i) => {
    for (let k = 0; k < 4; k++) fv.setUint8(12 + i * 16 + k, tag.charCodeAt(k));
    fv.setUint32(12 + i * 16 + 4, tableChecksum(data));
    fv.setUint32(12 + i * 16 + 8, at);
    fv.setUint32(12 + i * 16 + 12, data.length);
    font.set(data, at);
    at += pad(data.length);
  });
  return font;
}

describe('renameFont', () => {
  const font = makeFont([
    { platformId: 3, encodingId: 1, nameId: 0, value: "Copyright, with Reserved Font Name 'Source'." },
    { platformId: 3, encodingId: 1, nameId: 1, value: 'Noto Sans SC Thin' },
    { platformId: 3, encodingId: 1, nameId: 6, value: 'NotoSansSC-Thin' },
    { platformId: 3, encodingId: 1, nameId: 13, value: 'This Font Software is licensed under the SIL Open Font License' },
    { platformId: 1, encodingId: 0, nameId: 4, value: 'Noto Sans SC Thin' },
  ]);
  const replacements = [
    ['Noto Sans SC', 'XZW Sans SC'],
    ['NotoSansSC', 'XZWSansSC'],
  ] as const;

  it('改对外名字，版权与许可证原样保留', () => {
    const names = readNames(renameFont(font, replacements, ['Noto Sans']));
    const by = (platformId: number, nameId: number) => names.find((n) => n.platformId === platformId && n.nameId === nameId)?.value;
    expect(by(3, 1)).toBe('XZW Sans SC Thin');
    expect(by(3, 6)).toBe('XZWSansSC-Thin');
    expect(by(1, 4)).toBe('XZW Sans SC Thin');
    expect(by(3, 0)).toBe("Copyright, with Reserved Font Name 'Source'.");
    expect(by(3, 13)).toMatch(/^This Font Software is licensed/);
  });

  it('重算表校验和与整字体校验', () => {
    const out = renameFont(font, replacements, []);
    const view = new DataView(out.buffer);
    for (let i = 0; i < view.getUint16(4); i++) {
      const rec = 12 + i * 16;
      const offset = view.getUint32(rec + 8);
      const data = out.slice(offset, offset + view.getUint32(rec + 12));
      const tag = String.fromCharCode(...out.subarray(rec, rec + 4));
      // head 表的校验和按 checkSumAdjustment 为 0 计算。
      if (tag === 'head') new DataView(data.buffer).setUint32(8, 0);
      expect(tableChecksum(data)).toBe(view.getUint32(rec + 4));
    }
    expect(tableChecksum(out)).toBe(0xb1b0afba);
  });

  it('替换表没覆盖到保留名时报错', () => {
    expect(() => renameFont(font, [['Noto Sans SC', 'XZW Sans SC']], ['NotoSans'])).toThrow(/nameID 6/);
  });
});
