/**
 * JSON 语法错误的位置。浏览器的解析器报错各不相同（V8 多数情况只给出错处附近的片段，Safari 不给位置），
 * 这里按 RFC 8259 的语法自己走一遍，找到第一个不合语法的字符，换算成行列（从 1 起）。
 * 只在 `JSON.parse` 已经失败之后调用；文本合法时返回 null。
 */
export function jsonErrorPosition(text: string): { line: number; column: number } | null {
  let i = 0;
  const fail = (): never => {
    throw i;
  };
  const ws = () => {
    while (i < text.length && ' \t\n\r'.includes(text[i]!)) i++;
  };
  const lit = (word: string) => {
    for (const ch of word) {
      if (text[i] !== ch) fail();
      i++;
    }
  };
  const str = () => {
    i++;
    for (;;) {
      if (i >= text.length) fail();
      const c = text.charCodeAt(i);
      if (c === 0x22) {
        i++;
        return;
      }
      if (c < 0x20) fail();
      if (c === 0x5c) {
        i++;
        const e = text[i];
        if (e === 'u') {
          i++;
          for (let k = 0; k < 4; k++, i++) if (!/[0-9a-fA-F]/.test(text[i] ?? '')) fail();
          continue;
        }
        if (e === undefined || !'"\\/bfnrt'.includes(e)) fail();
      }
      i++;
    }
  };
  const num = () => {
    if (text[i] === '-') i++;
    if (text[i] === '0') i++;
    else if (/[1-9]/.test(text[i] ?? '')) while (/[0-9]/.test(text[i] ?? '')) i++;
    else fail();
    if (text[i] === '.') {
      i++;
      if (!/[0-9]/.test(text[i] ?? '')) fail();
      while (/[0-9]/.test(text[i] ?? '')) i++;
    }
    if (text[i] === 'e' || text[i] === 'E') {
      i++;
      if (text[i] === '+' || text[i] === '-') i++;
      if (!/[0-9]/.test(text[i] ?? '')) fail();
      while (/[0-9]/.test(text[i] ?? '')) i++;
    }
  };
  const value = (): void => {
    ws();
    const c = text[i];
    if (c === '{') {
      i++;
      ws();
      if (text[i] === '}') {
        i++;
        return;
      }
      for (;;) {
        ws();
        if (text[i] !== '"') fail();
        str();
        ws();
        if (text[i] !== ':') fail();
        i++;
        value();
        ws();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] === '}') {
          i++;
          return;
        }
        fail();
      }
    }
    if (c === '[') {
      i++;
      ws();
      if (text[i] === ']') {
        i++;
        return;
      }
      for (;;) {
        value();
        ws();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] === ']') {
          i++;
          return;
        }
        fail();
      }
    }
    if (c === '"') return str();
    if (c === 't') return lit('true');
    if (c === 'f') return lit('false');
    if (c === 'n') return lit('null');
    return num();
  };
  try {
    value();
    ws();
    if (i < text.length) fail();
    return null;
  } catch (at) {
    if (typeof at !== 'number') throw at;
    const before = text.slice(0, at).split('\n');
    return { line: before.length, column: (before.at(-1)?.length ?? 0) + 1 };
  }
}
