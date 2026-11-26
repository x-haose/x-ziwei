import { useEffect, useRef, useState } from 'react';

/** 复制成功后按钮变色与说明的停留时长（毫秒）。 */
export const COPIED_MS = 2400;

export type CopyState = { kind: 'idle' } | { kind: 'ok'; which: 'prompt' | 'link' } | { kind: 'failed' };

/** 复制提示词或链接，成功后 2.4 秒复原（设计规范第 9 节「复制按钮」）。 */
export function useCopy() {
  const [copy, setCopy] = useState<CopyState>({ kind: 'idle' });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const run = async (which: 'prompt' | 'link', value: string) => {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(value);
      setCopy({ kind: 'ok', which });
      timer.current = setTimeout(() => setCopy({ kind: 'idle' }), COPIED_MS);
    } catch (err) {
      console.error(err);
      setCopy({ kind: 'failed' });
    }
  };
  return { copy, run };
}

