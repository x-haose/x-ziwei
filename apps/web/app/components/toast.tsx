import { type ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as css from './toast.css';

/** 提示条停留时长（设计规范第 8 节）。 */
const TOAST_MS = 2000;

const ToastContext = createContext<((message: string) => void) | null>(null);

/**
 * 页面底部居中的一行提示，2 秒后淡出。区域常驻在页面里并标为 `role="status"`，
 * 换文字即被读屏朗读；同一时刻只显示最新的一条。
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((text: string) => {
    clearTimeout(timer.current);
    setMessage(text);
    setOn(true);
    timer.current = setTimeout(() => setOn(false), TOAST_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastContext value={show}>
      {children}
      <div className={css.toast} role="status" data-on={on ? '' : undefined}>
        {message}
      </div>
    </ToastContext>
  );
}

/** 取得显示提示条的函数；只能在 `ToastProvider` 之内调用。 */
export function useToast(): (message: string) => void {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast 只能在 ToastProvider 之内调用');
  return show;
}
