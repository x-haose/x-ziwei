/**
 * 中文字体的切片方案。
 *
 * 切法沿用 Google Fonts 线上给中文字体用的切片策略（googlefonts/nam-files 的
 * `slices/simplified-chinese_default.txt`，按字频排出 120 片，约 1.8 万个码位）。
 * 在它之上加两件事：
 * - 关键子集：首屏会出现的字单独成一片，由页面预载；这些字从其他各片里去掉，unicode-range 不重叠。
 * - 余下的码位：字体里有、而策略没覆盖的字（扩展区生僻字等）按码位顺序每 `restChunk` 个一片，
 *   保证字体能显示的字都由它显示，不落到系统字体。
 *
 * 每片的 unicode-range 只写它真有的码位（连续的合成区间），各片互不重叠，
 * 页面上出现字体没有的字（emoji、韩文等）时不会白下载任何一片。
 */

/** 一片：文件名里的标识、种类与它包含的码位（升序、无重复，均在字体的 cmap 里）。 */
export interface Slice {
  name: string;
  kind: 'critical' | 'strategy' | 'rest';
  codepoints: number[];
}

/** 解析 nam-files 的切片策略（text proto：若干 `subsets { codepoints: N … }`）。 */
export function parseSlicingStrategy(text: string): number[][] {
  const blocks = text.split(/^subsets\s*\{/m).slice(1);
  if (blocks.length === 0) throw new Error('切片策略里没有 subsets 块');
  return blocks.map((block, i) => {
    const cps = [...block.matchAll(/codepoints:\s*(\d+)/g)].map((m) => Number(m[1]));
    if (cps.length === 0) throw new Error(`切片策略第 ${i + 1} 块没有码位`);
    return cps;
  });
}

/** 文本里出现的全部码位（去重）。 */
export function codepointsOf(text: string): Set<number> {
  const out = new Set<number>();
  for (const ch of text) out.add(ch.codePointAt(0)!);
  return out;
}

/**
 * 排出全部切片。`cmap` 是字体实际有字形的码位；不在 `cmap` 里的码位一律丢弃（那片不会被请求，
 * 也不该在 unicode-range 里宣称）。空片不出现在结果里。
 */
export function planSlices({
  cmap,
  strategy,
  critical,
  restChunk,
}: {
  cmap: ReadonlySet<number>;
  strategy: readonly (readonly number[])[];
  critical: ReadonlySet<number>;
  restChunk: number;
}): Slice[] {
  if (restChunk < 1) throw new Error(`restChunk 必须为正：${restChunk}`);
  const taken = new Set<number>();
  const take = (cps: Iterable<number>): number[] => {
    const out: number[] = [];
    for (const c of cps) {
      if (!cmap.has(c) || taken.has(c)) continue;
      taken.add(c);
      out.push(c);
    }
    return out.sort((a, b) => a - b);
  };
  const slices: Slice[] = [];
  const first = take(critical);
  if (first.length) slices.push({ name: 'critical', kind: 'critical', codepoints: first });
  strategy.forEach((cps, i) => {
    const got = take(cps);
    if (got.length) slices.push({ name: `s${String(i).padStart(3, '0')}`, kind: 'strategy', codepoints: got });
  });
  const rest = take([...cmap].sort((a, b) => a - b));
  for (let i = 0; i < rest.length; i += restChunk) {
    slices.push({ name: `r${String(i / restChunk).padStart(3, '0')}`, kind: 'rest', codepoints: rest.slice(i, i + restChunk) });
  }
  return slices;
}

/** 升序码位写成 CSS `unicode-range`：连续的码位合成区间。 */
export function unicodeRange(codepoints: readonly number[]): string {
  if (codepoints.length === 0) throw new Error('空码位集合没有 unicode-range');
  const hex = (n: number) => n.toString(16).toUpperCase();
  const parts: string[] = [];
  let start = codepoints[0]!;
  let prev = start;
  const flush = () => parts.push(start === prev ? `U+${hex(start)}` : `U+${hex(start)}-${hex(prev)}`);
  for (const c of codepoints.slice(1)) {
    if (c <= prev) throw new Error(`码位未按升序排列：${hex(prev)} 之后是 ${hex(c)}`);
    if (c === prev + 1) {
      prev = c;
      continue;
    }
    flush();
    start = prev = c;
  }
  flush();
  return parts.join(',');
}
