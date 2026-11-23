import { describe, expect, it } from 'vitest';
import { helpSlugs } from './content-files';

const meta = ['---使用---', 'install', 'tools'];
const metaEn = ['---Use---', 'install', 'tools'];
const files = ['install.mdx', 'install.en.mdx', 'tools.mdx', 'tools.en.mdx', 'meta.json', 'meta.en.json'];

describe('helpSlugs', () => {
  it('按 meta 的顺序给出页面', () => {
    expect(helpSlugs(files, meta, metaEn)).toEqual(['install', 'tools']);
  });

  it('目录里有没列进 meta 的内容文件时报错', () => {
    expect(() => helpSlugs([...files, 'faq.mdx'], meta, metaEn)).toThrow(/faq\.mdx/);
  });

  it('列了页面却缺某种语言的文件时报错', () => {
    expect(() => helpSlugs(files.filter((f) => f !== 'tools.en.mdx'), meta, metaEn)).toThrow(/tools\.en\.mdx/);
  });

  it('中英文 meta 列的页面不同时报错', () => {
    expect(() => helpSlugs(files, meta, ['---Use---', 'install'])).toThrow(/meta\.json/);
  });
});
