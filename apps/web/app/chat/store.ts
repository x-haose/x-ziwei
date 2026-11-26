import type { DBSchema, IDBPDatabase, IDBPTransaction } from 'idb';
import { type OpenEvents, openLocalDb, writing } from '../lib/local-db';
import { type Conversation, settled } from './conversation';
import type { ChatSettings } from './providers';

/**
 * 本机对话库：浏览器的 IndexedDB（库 `xzw-chat`，与知识包库分开）。`state` 存服务设置（含 API Key）与上次选的页签，
 * `conversations` 存对话。都只在这台设备的浏览器里，不上传。
 *
 * Key 存在这里是明文：同一浏览器里能读本站存储的（本站页面里运行的脚本、能打开这台设备开发者工具的人）都能读到；
 * 别的网站读不到。清除本站的网站数据即删除。Key 只在请求厂商时放进请求头。
 *
 * 一段对话整段写入：同一段对话在两个标签页里同时生成时，后写完的那次为准。
 */

/** 排盘页右栏的页签。 */
export type SideTab = 'chat' | 'prompt';

interface Schema extends DBSchema {
  state: { key: 'settings' | 'tab'; value: ChatSettings | SideTab };
  conversations: { key: string; value: Conversation };
}

const DB_NAME = 'xzw-chat';
const DB_VERSION = 1;

/** 库里此刻的设置、页签与对话（按最后更新从新到旧）。 */
export interface ChatSnapshot {
  settings: ChatSettings | null;
  tab: SideTab | null;
  conversations: Conversation[];
}

type Tx = IDBPTransaction<Schema, ('state' | 'conversations')[], 'readwrite'>;

export class ChatDb {
  constructor(private readonly db: IDBPDatabase<Schema>) {}

  async load(): Promise<ChatSnapshot> {
    const tx = this.db.transaction(['state', 'conversations'], 'readonly');
    const [settings, tab, conversations] = await Promise.all([
      tx.objectStore('state').get('settings'),
      tx.objectStore('state').get('tab'),
      tx.objectStore('conversations').getAll(),
      tx.done,
    ]);
    return {
      settings: (settings as ChatSettings | undefined) ?? null,
      tab: (tab as SideTab | undefined) ?? null,
      conversations: conversations.map(settled).sort((a, b) => b.updatedAt - a.updatedAt),
    };
  }

  private async write(run: (tx: Tx) => Promise<unknown>): Promise<ChatSnapshot> {
    await writing(async () => {
      const tx = this.db.transaction(['state', 'conversations'], 'readwrite');
      // run 中途抛错时这里的失败与抛出的是同一件事，由 await run 处报告。
      const done = tx.done.catch((err: unknown) => err);
      await run(tx);
      const failed = await done;
      if (failed) throw failed;
    });
    return this.load();
  }

  /** 存服务设置；null 为删除 Key 与设置。 */
  saveSettings(settings: ChatSettings | null): Promise<ChatSnapshot> {
    return this.write((tx) => (settings ? tx.objectStore('state').put(settings, 'settings') : tx.objectStore('state').delete('settings')));
  }

  saveTab(tab: SideTab): Promise<ChatSnapshot> {
    return this.write((tx) => tx.objectStore('state').put(tab, 'tab'));
  }

  putConversation(c: Conversation): Promise<ChatSnapshot> {
    return this.write((tx) => tx.objectStore('conversations').put(c));
  }

  deleteConversation(id: string): Promise<ChatSnapshot> {
    return this.write((tx) => tx.objectStore('conversations').delete(id));
  }

  deleteAllConversations(): Promise<ChatSnapshot> {
    return this.write((tx) => tx.objectStore('conversations').clear());
  }
}

/** 打开本机对话库（错误分类与多标签页协调见 `openLocalDb`）。 */
export async function openChatDb(events: OpenEvents): Promise<ChatDb> {
  const db = await openLocalDb<Schema>(
    DB_NAME,
    DB_VERSION,
    (d, oldVersion) => {
      if (oldVersion < 1) {
        d.createObjectStore('state');
        d.createObjectStore('conversations', { keyPath: 'id' });
      }
    },
    events,
  );
  return new ChatDb(db);
}
