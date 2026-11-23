import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PACK_ID,
  DEFAULT_USE,
  type Pack,
  checkUse,
  describePack,
  diffAgainst,
  libraryProblems,
  moveInStack,
  usePack,
  withoutPack,
} from './library';

const pack = (raw: Record<string, unknown>) => describePack({ schema: 1, version: '1', language: 'zh-CN', ...raw }, 1);
const notes = pack({ id: 'notes', extends: DEFAULT_PACK_ID, source: { name: '笔记' }, stars: { ziweiMaj: {}, newStar: {} } });
const more = pack({ id: 'more', extends: DEFAULT_PACK_ID, topics: { romance: {} } });
const school = pack({ id: 'school', stars: { ziweiMaj: {} } });
const onSchool = pack({ id: 'on-school', extends: 'school', stars: { ziweiMaj: {} } });
const packs: Pack[] = [notes, more, school, onSchool];

describe('本机包库的导入规则', () => {
  it('id 缺失、与默认包同名、与本机已有的重复', () => {
    expect(libraryProblems({ schema: 1 }, packs)).toEqual([{ code: 'idMissing' }]);
    expect(libraryProblems({ schema: 1, id: DEFAULT_PACK_ID }, packs)).toEqual([{ code: 'idDefault' }]);
    expect(libraryProblems({ schema: 1, id: 'notes' }, packs)).toEqual([{ code: 'idTaken', id: 'notes' }]);
  });

  it('覆盖包只能基于默认包或本机的独立整包', () => {
    expect(libraryProblems({ id: 'a', extends: DEFAULT_PACK_ID }, packs)).toEqual([]);
    expect(libraryProblems({ id: 'a', extends: 'school' }, packs)).toEqual([]);
    expect(libraryProblems({ id: 'a', extends: 'nowhere' }, packs)).toEqual([{ code: 'extendsMissing', target: 'nowhere' }]);
    expect(libraryProblems({ id: 'a', extends: 'notes' }, packs)).toEqual([{ code: 'extendsOverlay', target: 'notes' }]);
  });
});

describe('生效组合', () => {
  it('叠加只收基于默认包的覆盖包，整包只收默认包或本机独立整包', () => {
    expect(() => checkUse({ mode: 'stack', stack: ['notes', 'more'], whole: 'school' }, packs)).not.toThrow();
    expect(() => checkUse({ ...DEFAULT_USE, stack: ['school'] }, packs)).toThrow();
    expect(() => checkUse({ ...DEFAULT_USE, stack: ['on-school'] }, packs)).toThrow();
    expect(() => checkUse({ ...DEFAULT_USE, stack: ['notes', 'notes'] }, packs)).toThrow();
    expect(() => checkUse({ ...DEFAULT_USE, whole: 'notes' }, packs)).toThrow();
    expect(() => checkUse({ ...DEFAULT_USE, stack: ['gone'] }, packs)).toThrow();
  });

  it('前移后移交换相邻两项，越界报错', () => {
    const use = { ...DEFAULT_USE, stack: ['notes', 'more'] };
    expect(moveInStack(use, 1, -1).stack).toEqual(['more', 'notes']);
    expect(() => moveInStack(use, 0, -1)).toThrow();
  });

  it('删包后从叠加里去掉；它是所选整包时改回默认包；另一模式的选择保留', () => {
    const use = { mode: 'whole' as const, stack: ['notes', 'more'], whole: 'school' };
    expect(withoutPack(use, 'notes')).toEqual({ mode: 'whole', stack: ['more'], whole: 'school' });
    expect(withoutPack(use, 'school')).toEqual({ mode: 'whole', stack: ['notes', 'more'], whole: DEFAULT_PACK_ID });
  });

  it('改用一个包：覆盖包排到末尾并切到叠加，整包切到整包模式', () => {
    expect(usePack({ ...DEFAULT_USE, mode: 'whole', stack: ['more'] }, notes)).toEqual({ mode: 'stack', stack: ['more', 'notes'], whole: DEFAULT_PACK_ID });
    expect(usePack(DEFAULT_USE, school)).toEqual({ mode: 'whole', stack: [], whole: 'school' });
    expect(() => usePack(DEFAULT_USE, onSchool)).toThrow();
  });
});

describe('覆盖包相对底包的改动', () => {
  it('同键算改，底包没有的算新增', () => {
    const base = pack({ id: 'base', stars: { ziweiMaj: {}, tianjiMaj: {} } });
    const d = diffAgainst(notes, base);
    expect(d.changed.stars).toBe(1);
    expect(d.added.stars).toBe(1);
    expect(d.changed.topics + d.added.topics).toBe(0);
  });
});
