import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PACK_ID,
  DEFAULT_USE,
  type Pack,
  addLayer,
  checkUse,
  describePack,
  diffAgainst,
  extendsAdvice,
  libraryProblems,
  migrateUse,
  moveLayer,
  removeLayer,
  repairUse,
  withoutPack,
} from './library';

const pack = (raw: Record<string, unknown>) => describePack({ schema: 1, version: '1', language: 'zh-CN', ...raw }, 1);
const notes = pack({ id: 'notes', extends: DEFAULT_PACK_ID, source: { name: '笔记' }, stars: { ziweiMaj: {}, newStar: {} } });
const more = pack({ id: 'more', extends: DEFAULT_PACK_ID, topics: { romance: {} } });
const school = pack({ id: 'school', stars: { ziweiMaj: {} } });
const onSchool = pack({ id: 'on-school', extends: 'school', stars: { ziweiMaj: {} } });
const onNotes = pack({ id: 'on-notes', extends: 'notes' });
const packs: Pack[] = [notes, more, school, onSchool, onNotes];

describe('本机包库的导入规则', () => {
  it('id 缺失、与默认包同名、与本机已有的重复；extends 不限制导入', () => {
    expect(libraryProblems({ schema: 1 }, packs)).toEqual([{ code: 'idMissing' }]);
    expect(libraryProblems({ schema: 1, id: DEFAULT_PACK_ID }, packs)).toEqual([{ code: 'idDefault' }]);
    expect(libraryProblems({ schema: 1, id: 'notes' }, packs)).toEqual([{ code: 'idTaken', id: 'notes' }]);
    for (const target of [DEFAULT_PACK_ID, 'school', 'notes', 'nowhere']) expect(libraryProblems({ id: 'a', extends: target }, packs)).toEqual([]);
  });
});

describe('生效组合：同级的有序叠放', () => {
  it('任意本机包与默认包、任意顺序都行；不能为空、不能重复、不能有本机没有的包', () => {
    for (const layers of [['school', 'notes'], ['on-notes'], ['notes', DEFAULT_PACK_ID], [DEFAULT_PACK_ID, 'on-school', 'more']]) {
      expect(() => checkUse({ layers }, packs), layers.join()).not.toThrow();
    }
    expect(() => checkUse({ layers: [] }, packs)).toThrow();
    expect(() => checkUse({ layers: ['notes', 'notes'] }, packs)).toThrow();
    expect(() => checkUse({ layers: ['gone'] }, packs)).toThrow();
  });

  it('上移下移交换相邻两层，越界报错；只剩一层时不能移出', () => {
    const use = { layers: [DEFAULT_PACK_ID, 'notes', 'more'] };
    expect(moveLayer(use, 'more', -1).layers).toEqual([DEFAULT_PACK_ID, 'more', 'notes']);
    expect(moveLayer(use, DEFAULT_PACK_ID, 1).layers).toEqual(['notes', DEFAULT_PACK_ID, 'more']);
    expect(() => moveLayer(use, DEFAULT_PACK_ID, -1)).toThrow();
    expect(() => moveLayer(use, 'school', 1)).toThrow();
    expect(removeLayer(use, DEFAULT_PACK_ID).layers).toEqual(['notes', 'more']);
    expect(() => removeLayer({ layers: ['notes'] }, 'notes')).toThrow();
  });

  it('加入时放在最上面（所声明的包已在组合里时自然在它下面）；已在组合里不动', () => {
    const use = { layers: [DEFAULT_PACK_ID, 'school', 'more'] };
    expect(addLayer(use, 'on-school').layers).toEqual([DEFAULT_PACK_ID, 'school', 'more', 'on-school']);
    expect(addLayer({ layers: ['school'] }, 'alone').layers).toEqual(['school', 'alone']);
    expect(addLayer(use, 'school')).toBe(use);
  });

  it('删包后从组合里去掉，空了退回默认包', () => {
    expect(withoutPack({ layers: ['notes', 'school'] }, 'notes')).toEqual({ layers: ['school'] });
    expect(withoutPack({ layers: ['school'] }, 'school')).toEqual(DEFAULT_USE);
  });

  it('extends 只作提醒：所声明的包不在本机，或在组合里但不在这一层下面', () => {
    expect(extendsAdvice(notes, { layers: [DEFAULT_PACK_ID, 'notes'] }, packs)).toBeNull();
    expect(extendsAdvice(notes, { layers: ['notes', DEFAULT_PACK_ID] }, packs)).toEqual({ kind: 'notBelow', target: DEFAULT_PACK_ID });
    expect(extendsAdvice(notes, { layers: ['notes'] }, packs)).toEqual({ kind: 'notBelow', target: DEFAULT_PACK_ID });
    expect(extendsAdvice(pack({ id: 'x', extends: 'nowhere' }), { layers: ['x'] }, packs)).toEqual({ kind: 'absent', target: 'nowhere' });
    expect(extendsAdvice(school, { layers: ['school'] }, packs)).toBeNull();
    expect(extendsAdvice(onSchool, DEFAULT_USE, packs)).toBeNull();
  });
});

describe('旧组合的迁移', () => {
  it('叠加模式 → 默认包加叠加；整包模式 → 整包加它的叠加；版本 1 没有 wholeStack', () => {
    expect(migrateUse({ mode: 'stack', stack: ['notes', 'more'], whole: 'school', wholeStack: ['on-school'] })).toEqual({ layers: [DEFAULT_PACK_ID, 'notes', 'more'] });
    expect(migrateUse({ mode: 'whole', stack: ['notes'], whole: 'school', wholeStack: ['on-school'] })).toEqual({ layers: ['school', 'on-school'] });
    expect(migrateUse({ mode: 'whole', stack: [], whole: DEFAULT_PACK_ID })).toEqual({ layers: [DEFAULT_PACK_ID] });
    expect(migrateUse({ mode: 'stack', stack: [] })).toEqual(DEFAULT_USE);
    expect(migrateUse({ mode: 'other' })).toBeNull();
    expect(migrateUse({ mode: 'stack', stack: [1] })).toBeNull();
    expect(migrateUse('x')).toBeNull();
  });
});

describe('一层相对下面各层的改动', () => {
  it('同键算改，下面各层都没有的算新增', () => {
    const base = pack({ id: 'base', stars: { tianjiMaj: {} } });
    const d = diffAgainst(notes, [base, school]);
    expect(d.changed.stars).toBe(1);
    expect(d.added.stars).toBe(1);
    expect(d.changed.topics + d.added.topics).toBe(0);
  });
});

describe('修复对不上的组合', () => {
  it('去掉不在本机与重复的层，空了退回默认包', () => {
    const r = repairUse({ layers: ['notes', 'gone', 'notes', DEFAULT_PACK_ID] }, packs);
    expect(r.use).toEqual({ layers: ['notes', DEFAULT_PACK_ID] });
    expect(r.dropped.sort()).toEqual(['gone', 'notes'].sort());
    expect(repairUse({ layers: ['gone'] }, packs)).toEqual({ use: DEFAULT_USE, dropped: ['gone'] });
  });

  it('组合对得上时原样返回', () => {
    const use = { layers: ['school', 'notes'] };
    expect(repairUse(use, packs)).toEqual({ use, dropped: [] });
  });
});
