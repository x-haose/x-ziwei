/**
 * 帮助页内容目录（`site/content`）的一致性检查，供路由表在构建时调用。
 *
 * 页面以 `meta.json`（中文）与 `meta.en.json`（英文）的 `pages` 为准，分隔符行 `---…---` 不是页面。
 * 两份 meta 列的页面必须相同；目录里的每个 `.mdx` 都必须被列入，列入的每页都必须有中英文两个文件——
 * 否则会有页面静默缺失（没列入的文件不出路由，列入而缺文件的语言没有页面）。
 */
export function helpSlugs(files: readonly string[], metaZh: readonly string[], metaEn: readonly string[]): string[] {
  const pages = (meta: readonly string[]) => meta.filter((p) => !p.startsWith('---'));
  const zh = pages(metaZh);
  const en = pages(metaEn);
  if (zh.join() !== en.join()) throw new Error(`meta.json 与 meta.en.json 列的页面不同：${zh.join()} / ${en.join()}`);
  const mdx = files.filter((f) => f.endsWith('.mdx'));
  const listed = new Set(zh);
  const unlisted = mdx.filter((f) => !listed.has(f.replace(/(\.en)?\.mdx$/, '')));
  if (unlisted.length) throw new Error(`这些内容文件没有列进 meta.json：${unlisted.join('、')}`);
  const missing = zh.flatMap((slug) => [`${slug}.mdx`, `${slug}.en.mdx`]).filter((f) => !mdx.includes(f));
  if (missing.length) throw new Error(`meta.json 列了页面但缺内容文件：${missing.join('、')}`);
  return zh;
}
