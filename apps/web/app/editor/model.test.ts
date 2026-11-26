import { beforeAll, describe, expect, it } from 'vitest';
import * as kernel from 'x-iztro';
import type { Kernel } from '../kernel/kernel';
import { defaultPackInfo } from '../knowledge/kernel-pack';
import { type Draft, type Pack, type PackRaw, describePack } from '../knowledge/library';
import { blankRaw, chartEntries, compareOf, entryStatus, freshId, problemAt, setField, setSubField, writeTarget } from './model';

const k = kernel as unknown as Kernel;
const pack = (raw: PackRaw, savedAt: number | null = null): Pack => describePack({ schema: 1, version: '1', language: 'zh-CN', ...raw }, 1, savedAt);
const draft = (id: string, raw: PackRaw, editing: string | null = null): Draft => ({ id, raw, editing, snapshot: null, createdAt: 1, updatedAt: 1 });

beforeAll(async () => {
  await kernel.init();
});

describe('写进哪个包（从看盘直达）', () => {
  it('最上面是自己保存过的包：改它，有草稿接着草稿', () => {
    const mine = pack({ id: 'mine' }, 5);
    expect(writeTarget('mine', [mine], [])).toEqual({ kind: 'edit', pack: mine });
    const d = draft('d', { id: 'mine' }, 'mine');
    expect(writeTarget('mine', [mine], [d])).toEqual({ kind: 'draft', draft: d });
  });

  it('最上面是默认包或导入的包：叠在它上面的新包，已有这样的新包草稿时接着用', () => {
    const theirs = pack({ id: 'theirs' });
    expect(writeTarget('theirs', [theirs], [])).toEqual({ kind: 'new', base: 'theirs' });
    expect(writeTarget('iztro-docs', [], [])).toEqual({ kind: 'new', base: 'iztro-docs' });
    const d = draft('d', blankRaw({ id: 'my-pack', name: '我的释义', base: 'iztro-docs', version: '2026-11-26' }));
    expect(writeTarget('iztro-docs', [], [d])).toEqual({ kind: 'draft', draft: d });
  });

  it('新包标识重了依次加序号，不与本机的包和其他新包草稿重复', () => {
    expect(freshId('my-pack', [], [])).toBe('my-pack');
    expect(freshId('my-pack', [pack({ id: 'my-pack' })], [draft('d', { id: 'my-pack-2' })])).toBe('my-pack-3');
  });
});

describe('字段与对照', () => {
  it('删掉字段回到沿用，空了的条目与段一并去掉，不存空值', () => {
    let raw: PackRaw = { schema: 1, id: 'x' };
    raw = setField(raw, { section: 'stars', key: 'ziweiMaj' }, 'intro', '改');
    raw = setSubField(raw, { section: 'stars', key: 'ziweiMaj' }, 'combinations', 'tanlangMaj', '组合');
    expect(raw.stars).toEqual({ ziweiMaj: { intro: '改', combinations: { tanlangMaj: '组合' } } });
    raw = setSubField(raw, { section: 'stars', key: 'ziweiMaj' }, 'combinations', 'tanlangMaj', undefined);
    raw = setField(raw, { section: 'stars', key: 'ziweiMaj' }, 'intro', undefined);
    expect(raw).toEqual({ schema: 1, id: 'x' });
  });

  it('对照沿 extends 链合并；条目状态分沿用、改写、新增，没有对照时分已写、未写', () => {
    const def = defaultPackInfo(k);
    const notes = pack({ id: 'notes', extends: 'iztro-docs', source: { name: '笔记' }, stars: { ziweiMaj: { intro: '笔记说紫微。' } } });
    const raw = { ...blankRaw({ id: 'mine', name: '我的', base: 'notes', version: '1' }), concepts: { 'my-term': { title: '我的术语', intro: '说明' } }, stars: { tianjiMaj: { intro: '改' } } };
    const c = compareOf(k, raw, [notes], def)!;
    expect(c.label).toBe('iztro-docs + 笔记');
    expect((c.pack.star('ziweiMaj')?.intro ?? '').startsWith('笔记说紫微')).toBe(true);
    expect(entryStatus(raw, c, { section: 'stars', key: 'ziweiMaj' })).toBe('inherit');
    expect(entryStatus(raw, c, { section: 'stars', key: 'tianjiMaj' })).toBe('changed');
    expect(entryStatus(raw, c, { section: 'concepts', key: 'my-term' })).toBe('added');
    expect(compareOf(k, blankRaw({ id: 'm', name: 'm', base: null, version: '1' }), [], def)).toBeNull();
    expect(compareOf(k, blankRaw({ id: 'm', name: 'm', base: 'gone', version: '1' }), [], def)).toBeNull();
    expect(entryStatus(raw, null, { section: 'stars', key: 'tianjiMaj' })).toBe('written');
    expect(entryStatus(raw, null, { section: 'stars', key: 'ziweiMaj' })).toBe('unwritten');
  });

  it('问题落到条目与字段：组合落到对方主星，包级字段落到包信息', () => {
    expect(problemAt(['stars', 'ziweiMaj', 'combinations', 'tanlangMaj'])).toEqual({ entry: { section: 'stars', key: 'ziweiMaj' }, field: 'combinations.tanlangMaj' });
    expect(problemAt(['stars', 'ziweiMaj', 'summary'])).toEqual({ entry: { section: 'stars', key: 'ziweiMaj' }, field: 'summary' });
    expect(problemAt(['version'])).toEqual({ entry: null, field: 'version' });
  });
});

describe('一张盘用到的条目（2000-8-16 寅时 女）', () => {
  it('主星按命宫起的宫序、同一颗只列一次；含四化、命中的格局与十二宫', () => {
    const chart = kernel.astro.bySolar('2000-8-16', 2, 'female');
    const groups = chartEntries(k, chart);
    const majors = groups.find((g) => g.kind === 'majors')!.entries;
    expect(majors.slice(0, 4).map((e) => `${e.name}@${e.where}`)).toEqual(['紫微@命宫', '天机@兄弟', '七杀@夫妻', '太阳@子女']);
    expect(groups.find((g) => g.kind === 'mutagens')!.entries.map((e) => e.name)).toEqual(['禄', '权', '科', '忌']);
    expect(groups.find((g) => g.kind === 'patterns')!.entries.map((e) => e.name)).toContain('府相朝垣');
    expect(groups.find((g) => g.kind === 'palaces')!.entries).toHaveLength(12);
  });
});
