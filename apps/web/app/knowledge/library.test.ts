import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PACK_ID,
  DEFAULT_USE,
  type Pack,
  addToStack,
  checkUse,
  describePack,
  diffAgainst,
  libraryProblems,
  moveInStack,
  pickWhole,
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
  it('两处叠加各自只收基于自己底包的覆盖包；整包模式选默认包时不叠加', () => {
    expect(() => checkUse({ mode: 'stack', stack: ['notes', 'more'], whole: 'school', wholeStack: ['on-school'] }, packs)).not.toThrow();
    expect(() => checkUse({ ...DEFAULT_USE, stack: ['school'] }, packs)).toThrow();
    expect(() => checkUse({ ...DEFAULT_USE, stack: ['on-school'] }, packs)).toThrow();
    expect(() => checkUse({ ...DEFAULT_USE, stack: ['notes', 'notes'] }, packs)).toThrow();
    expect(() => checkUse({ ...DEFAULT_USE, whole: 'notes' }, packs)).toThrow();
    expect(() => checkUse({ ...DEFAULT_USE, stack: ['gone'] }, packs)).toThrow();
    expect(() => checkUse({ ...DEFAULT_USE, whole: 'school', wholeStack: ['notes'] }, packs)).toThrow();
    expect(() => checkUse({ ...DEFAULT_USE, wholeStack: ['notes'] }, packs)).toThrow();
  });

  it('前移后移交换当前模式叠加里相邻两项，越界报错', () => {
    const use = { ...DEFAULT_USE, stack: ['notes', 'more'] };
    expect(moveInStack(use, 1, -1).stack).toEqual(['more', 'notes']);
    expect(() => moveInStack(use, 0, -1)).toThrow();
    const whole = { ...DEFAULT_USE, mode: 'whole' as const, whole: 'school', wholeStack: ['on-school'] };
    expect(addToStack(whole, 'on-school')).toBe(whole);
    expect(() => moveInStack(whole, 0, 1)).toThrow();
  });

  it('删包后从两处叠加里去掉；它是所选整包时改回默认包并清空整包的叠加；另一模式的选择保留', () => {
    const use = { mode: 'whole' as const, stack: ['notes', 'more'], whole: 'school', wholeStack: ['on-school'] };
    expect(withoutPack(use, 'notes')).toEqual({ ...use, stack: ['more'] });
    expect(withoutPack(use, 'on-school')).toEqual({ ...use, wholeStack: [] });
    expect(withoutPack(use, 'school')).toEqual({ mode: 'whole', stack: ['notes', 'more'], whole: DEFAULT_PACK_ID, wholeStack: [] });
  });

  it('换整包清空原来整包上的叠加', () => {
    const use = { ...DEFAULT_USE, mode: 'whole' as const, whole: 'school', wholeStack: ['on-school'] };
    expect(pickWhole(use, DEFAULT_PACK_ID)).toEqual({ ...use, whole: DEFAULT_PACK_ID, wholeStack: [] });
    expect(pickWhole(use, 'school')).toBe(use);
  });

  it('改用一个包：覆盖包排到所在底包的叠加末尾并切到对应模式，整包切到整包模式', () => {
    expect(usePack({ ...DEFAULT_USE, mode: 'whole', stack: ['more'] }, notes)).toEqual({ ...DEFAULT_USE, mode: 'stack', stack: ['more', 'notes'] });
    expect(usePack(DEFAULT_USE, school)).toEqual({ ...DEFAULT_USE, mode: 'whole', whole: 'school' });
    expect(usePack(DEFAULT_USE, onSchool)).toEqual({ ...DEFAULT_USE, mode: 'whole', whole: 'school', wholeStack: ['on-school'] });
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
