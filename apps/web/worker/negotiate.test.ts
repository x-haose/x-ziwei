import { describe, expect, it } from 'vitest';
import { markdownPath, pickLang } from './negotiate';

describe('pickLang', () => {
  it.each([
    [null, 'zh'],
    ['', 'zh'],
    ['en-US,en;q=0.9', 'en'],
    ['zh-TW,zh;q=0.9,en;q=0.8', 'zh'],
    ['fr-FR,fr;q=0.9,en;q=0.5,zh;q=0.4', 'en'],
    ['zh;q=0.5,en;q=0.8', 'en'],
    ['en;q=0,zh;q=0.1', 'zh'],
    ['ja,ko', 'zh'],
  ])('%s → %s', (header, lang) => {
    expect(pickLang(header)).toBe(lang);
  });
});

describe('markdownPath', () => {
  const req = (accept?: string) => new Request('https://example.test/', accept ? { headers: { Accept: accept } } : {});

  it('.mdx 后缀一律取 .md', () => {
    expect(markdownPath('/zh/install.mdx', req())).toBe('/zh/install.md');
  });

  it('Accept 把 Markdown 排在 HTML 之前时页面地址取 .md', () => {
    expect(markdownPath('/zh/install', req('text/markdown'))).toBe('/zh/install.md');
    expect(markdownPath('/zh/install/', req('text/markdown, text/html;q=0.9'))).toBe('/zh/install.md');
  });

  it('浏览器的 Accept、文件地址不取', () => {
    expect(markdownPath('/zh/install', req('text/html,application/xhtml+xml,*/*;q=0.8'))).toBeNull();
    expect(markdownPath('/zh/install.md', req('text/markdown'))).toBeNull();
    expect(markdownPath('/zh/llms.txt', req('text/plain'))).toBeNull();
  });
});
