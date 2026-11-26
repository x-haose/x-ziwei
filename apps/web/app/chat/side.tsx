import type { ReactNode } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { CloseIcon } from '../components/icons';
import type { Lang } from '../i18n/lang';
import type { Messages } from '../i18n/messages';
import { useMediaQuery } from '../lib/media';
import { type ChatChart, ChatColumn, useShownConversation } from './chat-panel';
import * as css from './chat.css';
import { selectConversation, setDrawer, setSheet, useChatDb, useChatSession } from './session';

/**
 * 排盘页的对话（设计规范 21.6、§19）：从阅读末尾「在这页问」打开。≥1024 在右栏里换下阅读（顶部「回到…」），
 * 更窄时是全屏面板。对话开着与否记在会话状态里（`sheet`），窗口跨过 1024 时在右栏与面板之间移动，草稿与内容不丢。
 * 释义标记在阅读页脚，全屏面板会盖住它，所以面板里另放一个（`mark`）。
 */
export function ChatHost({
  t,
  lang,
  chart,
  birthLabel,
  mark,
  back,
  reading,
  className,
  onUsePrompt,
  onOpenChart,
}: {
  t: Messages;
  lang: Lang;
  chart: ChatChart;
  /** 面板头部的生辰。 */
  birthLabel: string;
  mark: ReactNode;
  /** 右栏里对话顶部「回到…」的文字。 */
  back: string;
  /** 对话没开时右栏的内容（阅读）。 */
  reading: ReactNode;
  className: string;
  /** 对话里「复制给别的 AI」：关掉对话，回到问 AI。 */
  onUsePrompt: () => void;
  onOpenChart: (hash: string) => void;
}) {
  const wide = useMediaQuery('(min-width: 1024px)');
  const db = useChatDb();
  const sess = useChatSession();
  const { sheet, drawer } = sess;
  const conv = useShownConversation(chart.hash);
  const hasKey = db.status === 'ready' && db.settings !== null;
  const column = (inSheet: boolean) => (
    <ChatColumn
      t={t}
      lang={lang}
      chart={chart}
      mark={inSheet ? mark : null}
      inSheet={inSheet}
      drawer={drawer}
      onDrawer={setDrawer}
      onUsePrompt={onUsePrompt}
      onOpenChart={onOpenChart}
    />
  );
  const inColumn = sheet && wide;

  return (
    <>
      <section className={className} aria-label={t.chat.tabsLabel}>
        {inColumn ? (
          <div className={css.panel}>
            <button type="button" className={css.backButton} onClick={() => setSheet(false)}>
              {back}
            </button>
            {column(false)}
          </div>
        ) : (
          reading
        )}
      </section>
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
                  <small className={css.sheetBirth}>{birthLabel}</small>
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
