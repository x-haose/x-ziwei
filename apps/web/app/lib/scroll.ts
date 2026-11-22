/**
 * 平滑滚到页内某个元素（标题锚点），不改地址；减少动态效果时直接跳。
 * 焦点随之移到目标上，键盘与读屏用户从那里接着读。
 */
export function scrollToAnchor(id: string): void {
  const target = document.getElementById(id);
  if (!target) throw new Error(`页内没有这个锚点：${id}`);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}
