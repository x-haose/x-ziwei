import { useSyncExternalStore } from 'react';
import { useHydrated } from '../lib/media';
import { type Birth, type DecodedBirth, decodeBirth, encodeBirth } from './birth';
import type { LunarCalendar } from './calendar';

/**
 * 最近排过的生辰，只存在本机浏览器（`localStorage: xzw-recent`），最多 6 条，新的在前。
 * 每条存地址 `#` 之后的那串生辰（与分享链接同一格式）与记录时间（毫秒）。
 */
const KEY = 'xzw-recent';
const LIMIT = 6;
const CHANGE = 'xzw-recent-change';

/**
 * 一条记录。`hash` 原样保留；`decoded` 是它现在的解码结果：农历记录在排盘内核装好之前解不出来
 * （`unsupported`），旧格式或损坏的单条是 `invalid`。解不出来的条目照样保留，写入时不丢。
 */
export interface RecentItem {
  hash: string;
  ts: number;
  decoded: Exclude<DecodedBirth, { kind: 'none' }>;
}

export type RecentState =
  | { kind: 'ok'; items: RecentItem[] }
  /** 浏览器不让读写本机存储（隐私模式、被禁用）。 */
  | { kind: 'unavailable' }
  /** 存的内容不是本应用写的格式（不是由 hash 与时间组成的列表）。下次写入时覆盖。 */
  | { kind: 'corrupt' };

/** 只校验存储格式：每条是字符串 `hash` 加有限数 `ts`。条目能否解出生辰不影响格式是否完好。 */
export function parseRecent(raw: string | null, lunar: LunarCalendar | null): RecentState {
  if (raw === null) return { kind: 'ok', items: [] };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { kind: 'corrupt' };
  }
  if (!Array.isArray(data)) return { kind: 'corrupt' };
  const items: RecentItem[] = [];
  for (const entry of data) {
    if (!entry || typeof entry !== 'object') return { kind: 'corrupt' };
    const { hash, ts } = entry as { hash?: unknown; ts?: unknown };
    if (typeof hash !== 'string' || typeof ts !== 'number' || !Number.isFinite(ts)) return { kind: 'corrupt' };
    const decoded = decodeBirth(hash, lunar);
    if (decoded.kind === 'none') return { kind: 'corrupt' };
    items.push({ hash, ts, decoded });
  }
  return { kind: 'ok', items };
}

function write(items: readonly { hash: string; ts: number }[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.map(({ hash, ts }) => ({ hash, ts }))));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(CHANGE));
  return true;
}

/**
 * 记一条之后的列表：新的在前，同一生辰的旧记录去掉，其余条目（包括暂时解不出来的）原样保留，最多 6 条。
 * 存的内容格式已坏时从空列表开始。
 */
export function withEntry(current: RecentState, hash: string, now: number): { hash: string; ts: number }[] {
  const kept = current.kind === 'ok' ? current.items.filter((i) => i.hash !== hash) : [];
  return [{ hash, ts: now }, ...kept].slice(0, LIMIT);
}

/** 记一条。返回是否存成功。 */
export function pushRecent(birth: Birth, current: RecentState, now: number): boolean {
  return write(withEntry(current, encodeBirth(birth), now));
}

/** 删一条。返回是否存成功。 */
export function removeRecent(hash: string, current: RecentState): boolean {
  if (current.kind !== 'ok') throw new Error('记录读不出来时没有可删的条目');
  return write(current.items.filter((i) => i.hash !== hash));
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) onChange();
  };
  window.addEventListener(CHANGE, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/** 读本机存储的原文；读不了返回 undefined（与「没存过」的 null 区分）。 */
function snapshot(): string | null | undefined {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return undefined;
  }
}

/**
 * 最近排过的记录，随本页或其他标签页的写入更新。预渲染与水合时为 null（本机存储只在浏览器里有），
 * 水合后换成真实内容。
 */
export function useRecent(lunar: LunarCalendar | null): RecentState | null {
  const hydrated = useHydrated();
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  if (!hydrated) return null;
  if (raw === undefined) return { kind: 'unavailable' };
  return parseRecent(raw, lunar);
}
