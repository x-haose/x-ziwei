import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay, Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import * as controls from '../components/controls.css';
import { CloseIcon } from '../components/icons';
import { useToast } from '../components/toast';
import type { Lang } from '../i18n/lang';
import { fmt, type Messages } from '../i18n/messages';
import type { KernelState } from '../kernel/kernel';
import { useMediaQuery } from '../lib/media';
import { type ChatChart, ChatColumn, useShownConversation } from './chat-panel';
import * as css from './chat.css';
import { saveTab, selectConversation, serviceName, setDrawer, setSheet, useChatDb, useChatSession } from './session';
import { SIDE_TABS, type SideTab } from './store';

/**
 * 右栏的页签（设计规范 21.2）：首次打开是「看盘」，之后记住上次选的（存在本机）。本机存不了数据时只记在这一页。
 */
export function useSideTab(t: Messages): { tab: SideTab; setTab: (tab: SideTab) => void } {
  const db = useChatDb();
  const toast = useToast();
  const [picked, setPicked] = useState<SideTab | null>(null);
  const stored = db.status === 'ready' ? (db.tab ?? 'read') : 'read';
  return {
    tab: picked ?? stored,
    setTab: (tab) => {
      setPicked(tab);
      if (db.status !== 'ready') return;
      saveTab(tab).catch((err: unknown) => {
        console.error(err);
        toast(fmt(t.chat.saveFailed, { reason: err instanceof Error ? err.message : String(err) }));
      });
    },
  };
}

/** 平板与手机上右栏对话页签里的入口：一句当前模型（未设 Key 时写怎么开始）与「打开对话 / 继续对话」。 */
function ChatEntry({ t, chartHash, onOpen }: { t: Messages; chartHash: string | null; onOpen: () => void }) {
  const db = useChatDb();
  const conv = useShownConversation(chartHash);
  const settings = db.status === 'ready' ? db.settings : null;
  return (
    <div className={css.cta}>
      <p className={css.ctaText}>{settings ? fmt(t.chat.sheet.current, { service: serviceName(settings, t), model: settings.model || t.chat.picker.noModel }) : t.chat.sheet.noKey}</p>
      <button type="button" className={`${controls.button} ${css.ctaButton}`} disabled={chartHash === null} onClick={onOpen}>
        {conv && conv.messages.length > 0 ? t.chat.sheet.continue : t.chat.sheet.open}
      </button>
    </div>
  );
}

/**
 * 排盘页右栏：「看盘 | 对话 | 提示词」三个页签（设计规范 21.1、21.2）。≥1024 时对话就在右栏；更窄时右栏排在盘下，
 * 对话页签只有入口，对话在全屏面板里，另有固定在屏幕底部的一条按钮。窗口跨过 1024 时对话在右栏与面板之间移动，
 * 草稿与内容不丢（存在会话状态里）。释义标记在左栏，对话的全屏面板会盖住它，所以面板里另放一个（`mark`）。
 */
export function SidePanel({
  t,
  lang,
  tab,
  onTab,
  chart,
  birthLabel,
  kernel,
  mark,
  panels,
  className,
  onOpenChart,
}: {
  t: Messages;
  lang: Lang;
  tab: SideTab;
  onTab: (tab: SideTab) => void;
  /** 对话用到的这张盘；未排盘、内核加载中为 null。 */
  chart: ChatChart | null;
  /** 面板头部的生辰；未排盘为 null。 */
  birthLabel: string | null;
  kernel: KernelState;
  mark: ReactNode;
  /** 对话以外各页签的内容（对话由这里自己放）。 */
  panels: Record<Exclude<SideTab, 'chat'>, ReactNode>;
  className: string;
  onOpenChart: (hash: string) => void;
}) {
  const wide = useMediaQuery('(min-width: 1024px)');
  const db = useChatDb();
  const sess = useChatSession();
  const { sheet, drawer } = sess;
  const section = useRef<HTMLElement>(null);
  const conv = useShownConversation(chart?.hash ?? null);
  const hasKey = db.status === 'ready' && db.settings !== null;
  const labels: Record<SideTab, string> = { read: t.chat.tabRead, chat: t.chat.tabChat, prompt: t.chat.tabPrompt };

  useEffect(() => {
    if (wide) setSheet(false);
  }, [wide]);

  const usePrompt = () => {
    setSheet(false);
    onTab('prompt');
  };
  const openSheet = () => {
    onTab('chat');
    setSheet(true);
  };
  const column = (inSheet: boolean) => (
    <ChatColumn
      t={t}
      lang={lang}
      chart={chart}
      kernel={kernel}
      mark={inSheet ? mark : null}
      inSheet={inSheet}
      drawer={drawer}
      onDrawer={setDrawer}
      onUsePrompt={usePrompt}
      onOpenChart={onOpenChart}
    />
  );
  const content = (id: SideTab) =>
    id === 'chat' ? wide ? column(false) : <ChatEntry t={t} chartHash={chart?.hash ?? null} onOpen={openSheet} /> : panels[id];

  return (
    <>
      <section ref={section} className={className} aria-label={t.chat.tabsLabel}>
        <Tabs selectedKey={tab} onSelectionChange={(k) => onTab(k as SideTab)} className={css.panel}>
          <TabList aria-label={t.chat.tabsLabel} className={css.tabs}>
            {SIDE_TABS.map((id) => (
              <Tab key={id} id={id} className={css.tab}>
                {labels[id]}
              </Tab>
            ))}
          </TabList>
          {SIDE_TABS.map((id) => (
            <TabPanel key={id} id={id} className={css.panel}>
              {content(id)}
            </TabPanel>
          ))}
        </Tabs>
      </section>
      {birthLabel !== null && (
        <div className={css.mobileBar}>
          {SIDE_TABS.map((id) => (
            <button
              key={id}
              type="button"
              className={`${controls.ghost} ${css.mobileBarButton}`}
              onClick={() => {
                if (id === 'chat') {
                  openSheet();
                  return;
                }
                onTab(id);
                section.current?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
              }}
            >
              {labels[id]}
            </button>
          ))}
        </div>
      )}
      {sheet && !wide && (
        <ModalOverlay isOpen isDismissable={false} isKeyboardDismissDisabled={false} onOpenChange={(o) => !o && setSheet(false)}>
          <Modal className={css.sheet}>
            <Dialog className={css.sheetDialog} aria-labelledby="chat-sheet-title">
              <div className={css.sheetHead}>
                <Button className={css.sheetClose} aria-label={t.chat.sheet.close} onPress={() => setSheet(false)}>
                  <CloseIcon />
                </Button>
                <div className={css.sheetTitle}>
                  <Heading slot="title" id="chat-sheet-title" className={css.sheetName}>
                    {t.chat.sheet.title}
                  </Heading>
                  {birthLabel && <small className={css.sheetBirth}>{birthLabel}</small>}
                </div>
                {hasKey && (
                  <>
                    <button type="button" className={css.textButton} onClick={() => setDrawer('history')}>
                      {t.chat.historyButton}
                    </button>
                    <button type="button" className={css.textButton} disabled={sess.live !== null} onClick={() => conv && selectConversation(null)}>
                      {t.chat.newChat}
                    </button>
                  </>
                )}
              </div>
              <div className={css.sheetBody}>{column(true)}</div>
            </Dialog>
          </Modal>
        </ModalOverlay>
      )}
    </>
  );
}
