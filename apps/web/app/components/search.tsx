import { useStaticSearch } from 'fumadocs-core/search/client';
import { useEffect, useState } from 'react';
import {
  Autocomplete,
  Button,
  Dialog,
  DialogTrigger,
  Input,
  ListBox,
  ListBoxItem,
  Modal,
  ModalOverlay,
  SearchField,
} from 'react-aria-components';
import { fmt } from '../i18n/messages';
import { useLang, useMessages } from '../i18n/use-lang';
import { visuallyHidden } from './controls.css';
import { CloseIcon, SearchIcon } from './icons';
import * as css from './search.css';

/** hast 节点下的纯文字：结果里的行内标记（加粗、代码）只取文字。 */
function plain(node: { type: string; value?: string; children?: unknown[] }): string {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map((c) => plain(c as Parameters<typeof plain>[0])).join('');
}

/**
 * 搜索面板的内容：输入即在浏览器里检索构建时生成的当前语言索引（`/{lang}/search.json`，第一次检索时下载）。
 * 结果按页面分组，页面下列出命中的标题与段落（表格按行命中）；方向键在结果间移动，回车打开。
 *
 * 状态行常驻（读屏只播报已挂载的 live region 里的变化）：载入、无结果、失败时显示，
 * 有结果时只给读屏念条数。
 */
function SearchPanel({ close }: { close: () => void }) {
  const t = useMessages();
  const lang = useLang();
  const { search, onSearchChange, isLoading, data, error } = useStaticSearch({ from: `/${lang}/search.json` });
  useEffect(() => {
    if (error) console.error(error);
  }, [error]);
  const items = (data?.items ?? []).flatMap((it) => (it.type === 'table' ? it.rows : [it]));
  let status = '';
  let shown = true;
  if (error) status = fmt(t.search.failed, { reason: error.message });
  else if (search && isLoading && !data) status = t.search.loading;
  else if (search && data && items.length === 0) status = t.search.none;
  else if (search && items.length > 0) {
    status = items.length === 1 ? t.search.foundOne : fmt(t.search.found, { n: items.length });
    shown = false;
  }
  return (
    <Dialog className={css.dialog} aria-label={t.search.title}>
      <Autocomplete inputValue={search} onInputChange={onSearchChange}>
        <SearchField className={css.field} aria-label={t.search.title} autoFocus>
          <Input className={css.input} placeholder={t.search.placeholder} />
          <Button className={css.close} aria-label={t.picker.close} onPress={close}>
            <CloseIcon />
          </Button>
        </SearchField>
        <p className={status && shown ? css.note : visuallyHidden} role="status">
          {status}
        </p>
        {items.length > 0 && (
          <ListBox className={css.list} aria-label={t.search.results} items={items} onAction={close}>
            {(item) => {
              const text = plain(item.hastContent);
              const kind = item.type === 'page' ? css.itemPage : item.type === 'heading' ? css.itemHeading : css.itemText;
              return (
                <ListBoxItem id={item.id} href={item.url} textValue={text} className={`${css.item} ${kind}`}>
                  {item.type === 'text' ? <span className={css.clamp}>{text}</span> : text}
                </ListBoxItem>
              );
            }}
          </ListBox>
        )}
      </Autocomplete>
    </Dialog>
  );
}

/** 顶栏的搜索入口：点按钮或按 `/` 打开面板。 */
export function SearchButton({ className }: { className?: string }) {
  const t = useMessages();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <DialogTrigger isOpen={open} onOpenChange={setOpen}>
      <Button className={className ? `${css.trigger} ${className}` : css.trigger} aria-label={t.search.open} aria-keyshortcuts="/">
        <SearchIcon />
      </Button>
      <ModalOverlay isDismissable className={css.overlay}>
        <Modal className={css.modal}>
          <SearchPanel close={() => setOpen(false)} />
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
