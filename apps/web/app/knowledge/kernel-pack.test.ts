import { beforeAll, describe, expect, it } from 'vitest';
import * as kernel from 'x-iztro';
import { type ImportState, runImport } from './import';
import { jsonErrorPosition } from './json-position';
import type { KnowledgeIssue } from 'x-iztro';
import { MESSAGES } from '../i18n/messages';
import { issuePath, issueText } from './issues';
import { activePack, brokenPacks, builtinPack, checkImport, coverage, defaultPackInfo } from './kernel-pack';
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

  it('包格式交给内核的 check：逐条给出级别、路径与代码', () => {
    const issueCodes = (text: string) => {
      const r = checkImport(kernel, text, []);
      if (r.ok) return { errors: [], warnings: r.warnings.map((p) => (p.code === 'issue' ? `${p.issue.code}@${p.issue.path.join('.')}` : p.code)) };
      const f = (p: (typeof r.errors)[number]) => (p.code === 'issue' ? `${p.issue.code}@${p.issue.path.join('.')}` : p.code);
      return { errors: r.errors.map(f), warnings: r.warnings.map(f) };
    };
    expect(issueCodes('[1]').errors).toEqual(['not_object@']);
    expect(issueCodes('{"id":"a","version":"1","language":"zh-CN"}').errors).toEqual(['schema_missing@schema']);
    const pack = { schema: 1, id: 'a', version: '1', language: 'zh-CN', extends: DEFAULT_PACK_ID, stars: { ziweiMjj: { intro: 'x' }, tianjiMaj: { intor: 'y' } } };
    const r = issueCodes(JSON.stringify(pack));
    expect(r.errors).toEqual(['unknown_key@stars.ziweiMjj']);
    expect(r.warnings).toContain('unknown_field@stars.tianjiMaj.intor');
  });

  it('本机包库的规则与内核的问题一起列出；缺 id 只由内核报一次', () => {
    const notes = describePack(overlay('notes', 'x'), 1);
    const r = checkImport(kernel, JSON.stringify({ ...overlay('notes', 'y'), extends: 'notes' }), [notes]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((p) => p.code)[0]).toBe('idTaken');
    for (const id of [undefined, 5]) {
      const r = checkImport(kernel, JSON.stringify({ schema: 1, id, version: '1', language: 'zh-CN' }), []);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.map((p) => (p.code === 'issue' ? p.issue.code : p.code))).toEqual([id === undefined ? 'required_missing' : 'wrong_type']);
    }
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
  const school = describePack({ schema: 1, id: 'school', version: '1', language: 'zh-CN', stars: { ziweiMaj: { intro: '本门' } } }, 3);

  it('按列表顺序合并，排在后面的覆盖前面的；任意包都能放在任意位置', () => {
    expect(activePack(kernel, { layers: [DEFAULT_PACK_ID, 'a', 'b'] }, [a, b]).star('ziweiMaj')?.intro).toBe('乙说');
    expect(activePack(kernel, { layers: [DEFAULT_PACK_ID, 'b', 'a'] }, [a, b]).star('ziweiMaj')?.intro).toBe('甲说');
    expect(activePack(kernel, { layers: ['a', DEFAULT_PACK_ID] }, [a]).star('ziweiMaj')?.intro).toBe(builtinPack(kernel).star('ziweiMaj')?.intro);
  });

  it('只有默认包时就是默认包；独立包单独生效时没有默认包的条目，叠上别的包照常', () => {
    expect(activePack(kernel, DEFAULT_USE, [])).toBe(builtinPack(kernel));
    const alone = activePack(kernel, { layers: ['school'] }, [school]);
    expect(alone.star('ziweiMaj')?.intro).toBe('本门');
    expect(alone.star('tianjiMaj')).toBeUndefined();
    const onTop = activePack(kernel, { layers: ['school', 'a'] }, [a, school]);
    expect(onTop.star('ziweiMaj')?.intro).toBe('甲说');
    expect(onTop.star('tianjiMaj')).toBeUndefined();
  });

  it('覆盖度：内核认识的星曜、格局、宫位、四化里有释义的条数与缺的标识', () => {
    const full = coverage(kernel, builtinPack(kernel));
    expect(full.palaces).toEqual({ have: 12, total: 12, missing: [] });
    expect(full.mutagens.missing).toEqual([]);
    const alone = coverage(kernel, activePack(kernel, { layers: ['school'] }, [school]));
    expect(alone.stars.have).toBe(1);
    expect(alone.stars.missing).toContain('tianjiMaj');
    expect(alone.palaces).toMatchObject({ have: 0, total: 12 });
    expect(alone.topics).toEqual({ have: 0, total: null, missing: [] });
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

describe('旧版本导入、现在需要改的包', () => {
  it('error 级问题按包列出；合格的包不在其中', () => {
    const ok = describePack(overlay('ok', '好'), 1);
    const bad = describePack({ ...overlay('bad', '坏'), stars: { ziweiMjj: { intro: 'x' } } }, 2);
    for (const use of [DEFAULT_USE, { layers: [DEFAULT_PACK_ID, 'bad', 'ok'] }]) {
      const broken = brokenPacks(kernel, [ok, bad], use);
      expect([...broken.keys()]).toEqual(['bad']);
      expect(broken.get('bad')?.map((i) => i.code)).toEqual(['unknown_key']);
    }
  });
});

describe('extends 只是声明', () => {
  it('所声明的包不在本机：照常导入，另给一条提醒', () => {
    const r = checkImport(kernel, JSON.stringify({ ...overlay('on-school', 'x'), extends: 'school' }), []);
    expect(r.ok).toBe(true);
    expect(r.warnings.map((p) => p.code)).toContain('extendsAbsent');
  });

  it('全新的独立包（没有 extends）可以导入、单独生效', () => {
    const r = checkImport(kernel, JSON.stringify({ schema: 1, id: 'mine', version: '1', language: 'zh-CN', stars: { ziweiMaj: { intro: '我说' } } }), []);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const mine = describePack(r.raw, 1);
    expect(activePack(kernel, { layers: ['mine'] }, [mine]).star('ziweiMaj')?.intro).toBe('我说');
  });

  it('在组合里的包以它下面各层合并的结果为底来查：下面已有的条目的摘要规则按合并后判断', () => {
    const below = describePack({ schema: 1, id: 'below', version: '1', language: 'zh-CN', stars: { ziweiMaj: { intro: '短' } } }, 1);
    const top = describePack({ schema: 1, id: 'top', version: '1', language: 'zh-CN', stars: { ziweiMaj: { summary: '摘要' } } }, 2);
    // top 单独时「有摘要却没有正文」；叠在 below 上时正文来自 below。
    expect(brokenPacks(kernel, [below, top], { layers: ['top'] }).has('top')).toBe(false);
    const issuesAlone = kernel.KnowledgePack.check(top.raw!).map((i) => i.code);
    expect(issuesAlone).toContain('summary_without_body');
  });
});

describe('问题的原因与改法', () => {
  it('内核的每种 code 中英文都有文案；参数填进去，有 suggestion 时补一句', () => {
    for (const code of Object.values(kernel.KnowledgeIssueCode)) {
      for (const lang of ['zh', 'en'] as const) expect(Object.hasOwn(MESSAGES[lang].knowledge.issues, code), `${lang} ${code}`).toBe(true);
    }
    const issue = kernel.KnowledgePack.check({ schema: 1, id: 'a', version: '1', language: 'zh-CN', stars: { ziweiMjj: {} } })[0]!;
    expect(issuePath(issue.path, MESSAGES.zh)).toBe('stars.ziweiMjj');
    expect(issueText(issue, MESSAGES.zh)).toBe('「ziweiMjj」不是内核认识的标识，这一条不会生效。最接近的写法是「ziweiMaj」。');
  });

  it('不认识的 code 如实显示内核的说明', () => {
    const issue = { level: 'error', path: [], code: 'brand_new', params: {}, message: 'something new' } as unknown as KnowledgeIssue;
    expect(issueText(issue, MESSAGES.en)).toBe('something new');
    expect(issuePath([], MESSAGES.zh)).toBe('（整个包）');
  });
});
