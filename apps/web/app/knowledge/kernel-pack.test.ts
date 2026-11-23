import { beforeAll, describe, expect, it } from 'vitest';
import * as kernel from 'x-iztro';
import { type ImportState, runImport } from './import';
import { jsonErrorPosition } from './json-position';
import { activePack, builtinPack, checkImport, defaultPackInfo } from './kernel-pack';
import { DEFAULT_PACK_ID, DEFAULT_USE, describePack } from './library';

beforeAll(async () => {
  await kernel.init();
});

const overlay = (id: string, intro: string) => ({ schema: 1, id, version: '1', language: 'zh-CN', extends: DEFAULT_PACK_ID, stars: { ziweiMaj: { intro } } });

describe('导入校验', () => {
  it('JSON 语法错误给出行列', () => {
    const r = checkImport(kernel, '{\n  "schema": 1,\n  "id": \n}', []);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ code: 'syntax', line: 4, column: 1 });
  });

  it('包格式交给内核：不是对象、没有 schema、条目类型不对', () => {
    for (const text of ['[1]', '{"id":"a"}', JSON.stringify({ schema: 1, id: 'a', extends: DEFAULT_PACK_ID, stars: { ziweiMaj: 3 } })]) {
      const r = checkImport(kernel, text, []);
      expect(r.ok, text).toBe(false);
      if (!r.ok) expect(r.errors.map((p) => p.code)).toContain('kernel');
    }
  });

  it('本机包库的规则与内核的合并检查一起列出', () => {
    const notes = describePack(overlay('notes', 'x'), 1);
    const r = checkImport(kernel, JSON.stringify({ schema: 1, id: 'notes', extends: 'notes', stars: { ziweiMaj: 3 } }), [notes]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((p) => p.code)).toEqual(['idTaken', 'extendsOverlay']);
  });

  it('合格的覆盖包与整包通过', () => {
    expect(checkImport(kernel, JSON.stringify(overlay('notes', '笔记')), []).ok).toBe(true);
    const whole = { schema: 1, id: 'school', version: '1', language: 'zh-CN', stars: { ziweiMaj: { intro: '本门' } } };
    expect(checkImport(kernel, JSON.stringify(whole), []).ok).toBe(true);
    const onWhole = { ...overlay('on-school', '再改'), extends: 'school' };
    expect(checkImport(kernel, JSON.stringify(onWhole), [describePack(whole, 1)]).ok).toBe(true);
  });

  it('语法错误的行列：第一个不合语法的字符；截断的文本指到末尾', () => {
    expect(jsonErrorPosition('{"a": 1,}')).toEqual({ line: 1, column: 9 });
    expect(jsonErrorPosition('{\n  "a": tru\n}')).toEqual({ line: 2, column: 11 });
    expect(jsonErrorPosition('{\n"a"')).toEqual({ line: 2, column: 4 });
    expect(jsonErrorPosition(String.raw`{"a": "x\u00zz"}`)).toEqual({ line: 1, column: 13 });
    expect(jsonErrorPosition('{"a": [1, 2], "b": {"c": -0.5e+3}}')).toBeNull();
  });
});

describe('按生效组合合并', () => {
  const a = describePack(overlay('a', '甲说'), 1);
  const b = describePack(overlay('b', '乙说'), 2);

  it('叠加按顺序合并，排在后面的覆盖前面的', () => {
    expect(activePack(kernel, { ...DEFAULT_USE, stack: ['a', 'b'] }, [a, b]).star('ziweiMaj')?.intro).toBe('乙说');
    expect(activePack(kernel, { ...DEFAULT_USE, stack: ['b', 'a'] }, [a, b]).star('ziweiMaj')?.intro).toBe('甲说');
  });

  it('没有覆盖包时就是默认包；整包以所选的包为底，只叠加基于它的覆盖包', () => {
    expect(activePack(kernel, DEFAULT_USE, [])).toBe(builtinPack(kernel));
    const school = describePack({ schema: 1, id: 'school', version: '1', language: 'zh-CN', stars: { ziweiMaj: { intro: '本门' } } }, 3);
    const p = activePack(kernel, { mode: 'whole', stack: ['a'], whole: 'school', wholeStack: [] }, [a, school]);
    expect(p.star('ziweiMaj')?.intro).toBe('本门');
    expect(p.star('tianjiMaj')).toBeUndefined();
    const onSchool = describePack({ ...overlay('on-school', '门内又说'), extends: 'school' }, 4);
    const layered = activePack(kernel, { mode: 'whole', stack: [], whole: 'school', wholeStack: ['on-school'] }, [a, school, onSchool]);
    expect(layered.star('ziweiMaj')?.intro).toBe('门内又说');
    expect(layered.star('tianjiMaj')).toBeUndefined();
  });

  it('默认包信息：六段条目数取自内核', () => {
    const d = defaultPackInfo(kernel);
    expect(d.id).toBe(DEFAULT_PACK_ID);
    expect(d.counts).toEqual({ stars: 162, patterns: 64, palaces: 12, mutagens: 4, concepts: 50, topics: 13 });
    expect(d.raw).toBeNull();
  });
});

describe('深层嵌套', () => {
  it('语法错误定位不递归，极深的嵌套也给出行列', () => {
    expect(jsonErrorPosition('['.repeat(200000))).toEqual({ line: 1, column: 200001 });
    expect(jsonErrorPosition(`${'['.repeat(5000)}1${']'.repeat(5000)}`)).toBeNull();
    expect(jsonErrorPosition('{"a": {"b": [1, {"c": }]}}')).toEqual({ line: 1, column: 23 });
  });

  it('嵌套极深使校验本身跑不完时，导入以一条「没能完成校验」结束，不停在校验中', async () => {
    const states: ImportState[] = [];
    for (const text of ['['.repeat(200000), `{"schema":1,"id":"deep","extends":"iztro-docs","stars":{"ziweiMaj":{"intro":"x","attributes":${'['.repeat(5000)}${']'.repeat(5000)}}}}`]) {
      await runImport({ file: 'deep.json', read: async () => text, kernel, packs: [], save: async () => { throw new Error('不该走到存入'); }, onState: (s) => states.push(s) });
      const last = states.at(-1);
      expect(last?.phase, text.slice(0, 20)).toBe('error');
    }
  });

  it('粘贴的文本超过 2 MB 按字节拒绝', async () => {
    const states: ImportState[] = [];
    await runImport({ file: 'p', read: async () => '中'.repeat(700_000), kernel, packs: [], save: async () => { throw new Error('不该走到存入'); }, onState: (s) => states.push(s) });
    expect(states.at(-1)).toMatchObject({ phase: 'error', errors: [{ code: 'tooLarge' }] });
  });
});
