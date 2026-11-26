import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { StorageNewerError } from '../lib/local-db';
import type { Conversation } from './conversation';
import { openChatDb } from './store';

const NO_EVENTS = { onBlocked: () => undefined, onSuperseded: () => undefined };

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

const conv = (id: string, updatedAt: number): Conversation => ({
  id,
  title: id,
  chart: 'cal=solar&d=2000-8-16&t=2&g=f',
  birth: '2000-8-16 寅时 女',
  createdAt: 0,
  updatedAt,
  noTools: false,
  messages: [{ id: 'u', role: 'user', text: '问', context: '上下文', at: 0 }],
});

describe('本机对话库', () => {
  it('设置、页签与对话的读写；对话按最后更新从新到旧', async () => {
    const db = await openChatDb(NO_EVENTS);
    expect(await db.load()).toEqual({ settings: null, tab: null, conversations: [] });
    const settings = { provider: 'deepseek' as const, key: 'sk-x', baseURL: null, model: 'deepseek-flash', models: [] };
    await db.saveSettings(settings);
    await db.saveTab('chat');
    await db.putConversation(conv('a', 1));
    const snap = await db.putConversation(conv('b', 2));
    expect(snap.settings).toEqual(settings);
    expect(snap.tab).toBe('chat');
    expect(snap.conversations.map((c) => c.id)).toEqual(['b', 'a']);
    expect((await db.saveSettings(null)).settings).toBeNull();
    expect((await db.deleteConversation('b')).conversations.map((c) => c.id)).toEqual(['a']);
    expect((await db.deleteAllConversations()).conversations).toEqual([]);
  });

  it('删除 Key 不动对话', async () => {
    const db = await openChatDb(NO_EVENTS);
    await db.saveSettings({ provider: 'openai', key: 'sk-y', baseURL: null, model: 'gpt-x', models: [] });
    await db.putConversation(conv('a', 1));
    const snap = await db.saveSettings(null);
    expect(snap.conversations).toHaveLength(1);
  });

  it('本机的库比本页代码新时报 StorageNewerError', async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('xzw-chat', 50);
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
    await expect(openChatDb(NO_EVENTS)).rejects.toBeInstanceOf(StorageNewerError);
  });
});
