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
import { CloseIcon } from './icons';
import * as css from './search.css';

/** hast 节点下的纯文字：结果里的行内标记（加粗、代码）只取文字。 */
function plain(node: { type: string; value?: string; children?: unknown[] }): string {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map((c) => plain(c as Parameters<typeof plain>[0])).join('');
}

/** 搜索图标：一圈加一道斜柄，线宽 1px。 */
function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="currentColor" />
      <path d="M11.5 11.5 16 16" stroke="currentColor" />
    </svg>
  );
}

/**
 * 搜索面板的内容：输入即在浏览器里检索构建时生成的索引（`/search.json`，第一次检索时下载），
 * 只搜当前语言。结果按页面分组，页面下列出命中的标题与段落；方向键在结果间移动，回车打开。
 */
function SearchPanel({ close }: { close: () => void }) {
  const t = useMessages();
  const lang = useLang();
  const { search, onSearchChange, isLoading, data, error } = useStaticSearch({ from: '/search.json', locale: lang });
  useEffect(() => {
    if (error) console.error(error);
  }, [error]);
  const items = (data?.items ?? []).flatMap((it) => (it.type === 'table' ? it.rows : [it]));
  let status: string | null = null;
  if (error) status = fmt(t.search.failed, { reason: error.message });
  else if (search && isLoading && !data) status = t.search.loading;
  else if (search && data && items.length === 0) status = t.search.none;
  return (
    <Dialog className={css.dialog} aria-label={t.search.title}>
      <Autocomplete inputValue={search} onInputChange={onSearchChange}>
        <SearchField className={css.field} aria-label={t.search.title} autoFocus>
          <Input className={css.input} placeholder={t.search.placeholder} />
          <Button className={css.close} aria-label={t.picker.close} onPress={close}>
            <CloseIcon />
          </Button>
        </SearchField>
        {status && (
          <p className={css.note} role="status">
            {status}
          </p>
        )}
        {items.length > 0 && (
          <ListBox className={css.list} aria-label={t.search.results} items={items} onAction={close}>
            {(item) => (
              <ListBoxItem
                id={item.id}
                href={item.url}
                textValue={plain(item.hastContent)}
                className={[css.item, item.type === 'page' ? css.itemPage : item.type === 'heading' ? css.itemHeading : css.itemText].join(' ')}
              >
                {plain(item.hastContent)}
              </ListBoxItem>
            )}
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
