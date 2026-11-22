import { describe, expect, it } from 'vitest';
import { slugify, tocOf } from './toc';

describe('tocOf', () => {
  it('取二、三级标题，跳过代码块里的 # 行，标题只取文字', () => {
    const src = ['# 标题', '## 装插件', '```sh', '## 不是标题', '```', '### 只接 `MCP` 地址', '## 没有 [Skill](#x) 时'].join('\n');
    expect(tocOf(src)).toEqual([
      { level: 2, text: '装插件', id: '装插件' },
      { level: 3, text: '只接 MCP 地址', id: '只接-mcp-地址' },
      { level: 2, text: '没有 Skill 时', id: '没有-skill-时' },
    ]);
  });

  it('锚点去掉标点', () => {
    expect(slugify('盘面与材料（附）')).toBe('盘面与材料附');
  });
});
