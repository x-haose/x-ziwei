import { beforeAll, describe, expect, it } from 'vitest';
import * as k from 'x-iztro';
import type { Astrolabe, KnowledgePack } from 'x-iztro';
import { MESSAGES } from '../i18n/messages';
import type { Kernel } from '../kernel/kernel';
import { huaTexts, selectedLayer } from './model';
import { type Rich, type Step, orderedTopics, selectionText, topicOfPalace, topicPalaces, topicSteps } from './topic';

/** 术语写成 [术语]，亮度写成 <庙>，便于整句比对。 */
const plain = (r: Rich) => r.map((p) => (typeof p === 'string' ? p : 'term' in p ? `[${p.text}]` : `<${p.brightness}>`)).join('');

let pack: KnowledgePack;
let chart: Astrolabe;
const t = MESSAGES.zh;

beforeAll(async () => {
  await k.init();
  pack = k.KnowledgePack.builtin('zh-CN');
  chart = k.astro.bySolar('2000-8-16', 2, 'female');
});

function steps(slug: string, year: number | null): Step[] {
  const topic = orderedTopics(pack).find((x) => x.slug === slug)!;
  const layer = year === null ? null : selectedLayer(chart, { layer: 'yearly', decadal: 2, year, month: { month: 1, part: 'normal' } });
  return topicSteps({
    chart,
    topic,
    palaces: topicPalaces(chart, topic),
    layer: layer && year !== null ? { view: layer, patterns: chart.horoscopeOfYear(year).patterns('yearly'), head: { kind: 'yearly', year, age: year - 1999 } } : null,
    now: { year: 2026, age: 27, decadal: { ages: [23, 32], soul: chart.decadalList()[2]!.index }, yearlySoul: chart.horoscopeOfYear(2026).yearly.index },
    hua: huaTexts(k as unknown as Kernel),
    mutagenKeys: [k.Mutagen.LU, k.Mutagen.QUAN, k.Mutagen.KE, k.Mutagen.JI],
    natalPatterns: chart.patterns(),
    t,
  });
}

describe('主题的五步（2000-8-16 寅时 女）', () => {
  it('主题顺序按默认包的 13 个；点盘上的宫读以它为本宫的主题', () => {
    expect(orderedTopics(pack).map((x) => x.title)).toEqual(['总论', '性格', '事业', '财运', '婚恋', '健康', '父母', '子女', '兄弟', '交友', '田宅', '迁移', '精神']);
    expect(topicOfPalace(chart, orderedTopics(pack), chart.palace('soulPalace')!.index)).toBe('overall');
    expect(topicOfPalace(chart, orderedTopics(pack), chart.palace('careerPalace')!.index)).toBe('career');
  });

  it('总论、一生：五步的事实、焦点宫与高亮宫', () => {
    const topic = orderedTopics(pack)[0]!;
    expect(plain(selectionText(chart, topicPalaces(chart, topic), t))).toBe('看命宫连同它的[三方四正]，另看[身宫]、福德宫。');
    const s = steps('overall', null);
    expect(s.map((x) => x.facts.map(plain))).toEqual([
      ['你的命宫在午，主星是紫微（<庙>）；[同宫]的辅星有文曲（<陷>）。'],
      ['命宫的[对宫]是迁移宫（子，贪狼），[三合]是财帛宫（寅，武曲、天相）和官禄宫（戌，廉贞、天府）。', '这个主题另看[身宫]（在官禄宫）、福德宫（申，破军）。'],
      ['生年[四化]落在这几宫的有：武曲化权在财帛宫。', '落在别处的：太阳化禄在子女宫，太阴化科在仆役宫，天同化忌在疾厄宫。'],
      ['府相朝垣：以命宫为[本宫]，由官禄宫的天府、财帛宫的天相组成，本命成立。'],
      ['你 2026 年虚岁 27，在 23–32 岁这个[大限]里；这个大限的命宫在辰，就是本命的夫妻宫。', '2026 年的[流年]命宫在午，就是本命的命宫。'],
    ]);
    expect(s.map((x) => [x.focus, x.hl])).toEqual([
      [4, [4]],
      [4, [4, 10, 0, 8, 6]],
      [4, [0]],
      [4, [4, 8, 0]],
      [2, [2, 4]],
    ]);
    // 同一条释义在一个主题里只列一次：第 1 步列过紫微，第 2 步的主星里不再有。
    expect(s[0]!.notes.map((n) => n.kind === 'star' && n.label)).toEqual(['紫微']);
    expect(s[1]!.groups[0]!.title).toBe('这几宫主星的释义：贪狼、武曲、天相、廉贞、天府、破军');
    expect(s[4]!.when).toEqual({ decade: true, year: true });
  });

  it('本宫是空宫：借对宫主星，高亮本宫与对宫，释义列对宫主星', () => {
    const s = steps('property', null)[0]!;
    expect(s.facts.map(plain)).toEqual(['你的田宅宫在酉，没有主星（[空宫]）；[同宫]的辅星有地空和擎羊（<陷>）。[对宫]子女宫的主星是太阳（<庙>）和天梁（<庙>）。']);
    expect(s.hl).toEqual([7, 1]);
    expect(s.notes.map((n) => (n.kind === 'combo' ? `${n.a.name}+${n.b.name}` : n.label))).toEqual(['太阳（子女宫）', '天梁（子女宫）', '太阳+天梁']);
  });

  it('只取本宫的主题：第 1 步逐宫一句，第 2 步写只看这几宫本身', () => {
    const s = steps('personality', null);
    expect(s[0]!.facts.map(plain)[3]).toBe('你的[身宫]在官禄宫（戌），主星是廉贞（<利>）和天府（<庙>）；[同宫]的辅星有左辅。');
    expect(s[1]!.facts.map(plain)).toEqual(['「性格」只看命宫、迁移宫、福德宫和[身宫]（在官禄宫）这几宫本身，不看各自的[三方四正]。']);
  });

  it('选了流年：四化加该层，格局标出成立的各层，第 5 步以这一层的主题宫为焦点', () => {
    const s = steps('wealth', 2026);
    expect(plain(s[2]!.facts[2]!)).toBe('流年（丙午）的四化：天同化禄在疾厄宫，天机化权在兄弟宫，文昌化科在福德宫，廉贞化忌在官禄宫。落在这几宫的是文昌化科和廉贞化忌。');
    expect(s[3]!.facts.map(plain)).toEqual([
      '府相朝垣：以命宫为[本宫]，由官禄宫的天府、财帛宫的天相组成，本命、流年成立。',
      '禄马交驰：以福德宫为[本宫]，由福德宫的禄存、福德宫的流马组成，流年成立。',
    ]);
    expect(s[4]!.facts.map(plain)).toEqual([
      '2026 年（丙午）你虚岁 27，[流年]命宫在午，就是本命的命宫。',
      '这一层的财帛宫在寅，就是本命的财帛宫（武曲（<得>）、天相（<庙>））。读这段时间的财运，以它为本宫再看前四步。',
    ]);
    expect([s[4]!.focus, s[4]!.hl]).toEqual([0, [4, 0]]);
  });
});
