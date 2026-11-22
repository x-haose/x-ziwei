import { describe, expect, it } from 'vitest';
import { buildPrompt } from './build';

describe('buildPrompt', () => {
  it('方法、盘面各段、问题依次排列，三部分之间用分隔线', () => {
    const out = buildPrompt({ lang: 'zh', method: '方法\n', sections: ['# 本命盘\n…', '  ', '# 运限'], question: ' 今年怎样 ' });
    expect(out).toBe('方法\n\n---\n\n# 本命盘\n…\n\n# 运限\n\n---\n\n# 我的问题\n\n今年怎样');
  });

  it('没写问题时用默认问题；没有盘面段时只有一道分隔线', () => {
    const out = buildPrompt({ lang: 'en', method: 'M', sections: [], question: '' });
    expect(out.split('---')).toHaveLength(2);
    expect(out).toMatch(/^M\n\n---\n\n# My question\n\nPlease give me an overall reading/);
  });
});
