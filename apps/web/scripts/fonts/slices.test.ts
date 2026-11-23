import { describe, expect, it } from 'vitest';
import { parseSlicingStrategy, planSlices, unicodeRange } from './slices';

describe('parseSlicingStrategy', () => {
  it('读出每个 subsets 块的码位', () => {
    const text = '# 注释\nsubsets {\n  codepoints: 65\n  codepoints: 66\n}\nsubsets {\n  codepoints: 20013\n}\n';
    expect(parseSlicingStrategy(text)).toEqual([[65, 66], [20013]]);
  });

  it('没有块时报错', () => {
    expect(() => parseSlicingStrategy('# 空')).toThrow();
  });
});

describe('planSlices', () => {
  const cmap = new Set([65, 66, 67, 68, 0x4e00, 0x4e01, 0x4e02, 0x9fa5, 0x9fa6]);

  it('关键字先成一片并从其余各片去掉；不在字体里的码位丢弃；余字按码位顺序分片', () => {
    const slices = planSlices({
      cmap,
      strategy: [[65, 66, 0x4e00, 0x5000], [0x4e01]],
      critical: new Set([66, 0x4e01, 0x3000]),
      restChunk: 2,
    });
    expect(slices).toEqual([
      { name: 'critical', kind: 'critical', codepoints: [66, 0x4e01] },
      { name: 's000', kind: 'strategy', codepoints: [65, 0x4e00] },
      { name: 'r000', kind: 'rest', codepoints: [67, 68] },
      { name: 'r001', kind: 'rest', codepoints: [0x4e02, 0x9fa5] },
      { name: 'r002', kind: 'rest', codepoints: [0x9fa6] },
    ]);
    const all = slices.flatMap((s) => s.codepoints);
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(all)).toEqual(cmap);
  });

  it('各片的 unicode-range 只覆盖字体有的码位，且互不重叠', () => {
    const slices = planSlices({ cmap, strategy: [[65]], critical: new Set([66]), restChunk: 3 });
    const expand = (range: string) =>
      range.split(',').flatMap((part) => {
        const [a, b = a] = part.replace('U+', '').split('-').map((x) => Number.parseInt(x, 16)) as [number, number?];
        return Array.from({ length: b! - a + 1 }, (_, k) => a + k);
      });
    const all = slices.flatMap((sl) => expand(unicodeRange(sl.codepoints)));
    expect(new Set(all).size).toBe(all.length);
    for (const cp of all) expect(cmap.has(cp)).toBe(true);
  });
});

describe('unicodeRange', () => {
  it('连续码位合成区间', () => {
    expect(unicodeRange([0x20, 0x21, 0x22, 0x4e00, 0x4e02])).toBe('U+20-22,U+4E00,U+4E02');
  });

  it('未排序时报错', () => {
    expect(() => unicodeRange([2, 1])).toThrow();
  });
});
