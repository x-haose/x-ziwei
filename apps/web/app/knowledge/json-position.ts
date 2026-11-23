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
  /** 对象里的「"键":」，停在冒号之后。 */
  const key = () => {
    ws();
    if (text[i] !== '"') fail();
    str();
    ws();
    if (text[i] !== ':') fail();
    i++;
  };
  /**
   * 整个文本：用显式的栈记住所在的对象或数组，不递归，任意深的嵌套也不会爆栈。
   * `want` 为 value 时下一个应是值，为 next 时刚读完一个值、应是逗号或闭合括号。
   */
  const document = () => {
    const stack: ('{' | '[')[] = [];
    let want: 'value' | 'next' = 'value';
    for (;;) {
      ws();
      if (want === 'value') {
        const c = text[i];
        if (c === '{' || c === '[') {
          i++;
          ws();
          if (text[i] === (c === '{' ? '}' : ']')) {
            i++;
            want = 'next';
            continue;
          }
          stack.push(c);
          if (c === '{') key();
          continue;
        }
        if (c === '"') str();
        else if (c === 't') lit('true');
        else if (c === 'f') lit('false');
        else if (c === 'n') lit('null');
        else num();
        want = 'next';
        continue;
      }
      const top = stack.at(-1);
      if (top === undefined) {
        if (i < text.length) fail();
        return;
      }
      if (text[i] === ',') {
        i++;
        if (top === '{') key();
        want = 'value';
        continue;
      }
      if (text[i] === (top === '{' ? '}' : ']')) {
        i++;
        stack.pop();
        continue;
      }
      fail();
    }
  };
  try {
    document();
    return null;
  } catch (at) {
    if (typeof at !== 'number') throw at;
    const before = text.slice(0, at).split('\n');
    return { line: before.length, column: (before.at(-1)?.length ?? 0) + 1 };
  }
}
