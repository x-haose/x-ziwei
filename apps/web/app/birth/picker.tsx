import { assignInlineVars } from '@vanilla-extract/dynamic';
import { type CSSProperties, type KeyboardEvent, type ReactNode, type Ref, useId } from 'react';
import { Button, Dialog, DialogTrigger, ListBox, ListBoxItem, Modal, ModalOverlay, Popover } from 'react-aria-components';
import * as controls from '../components/controls.css';
import { CaretIcon, CloseIcon, PageIcon } from '../components/icons';
import { useMessages } from '../i18n/use-lang';
import { useMediaQuery } from '../lib/media';
import { media } from '../styles/media';
import * as css from './picker.css';

/** 弹层里的翻页：‹ › 两个按钮与 PageUp、PageDown 两个键。 */
export interface Paging {
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * 自绘选择器（设计规范第 11 节「选择器」）：触发钮加弹层，桌面弹层贴在触发钮下方 4px，
 * 手机改为底部面板（背后铺半透明遮罩）。
 *
 * 尺寸：桌面弹层的最大高度由 React Aria 按触发钮上下的可用空间算出并写进行内样式（下方放不下且上方更宽裕时翻到上方），
 * 底部面板最高 78% 视口；两者都是标题行固定、下面的内容区在弹层内滚动，任何窗口高度下都不越出视口和弹层边框。
 *
 * 读屏与键盘：触发钮带 `aria-haspopup="dialog"` 与 `aria-expanded`；弹层是带标题的对话框；
 * Enter 或空格打开，Esc、点弹层外或选中后关闭，关闭后焦点回到触发钮。
 * 翻页键（PageUp、PageDown）在有分页的弹层里换页。
 */
export function Picker({
  label,
  title,
  value,
  placeholder,
  isDisabled = false,
  errorId,
  width,
  header,
  paging,
  onKeyDownCapture,
  onOpenChange,
  triggerClass,
  children,
}: {
  /** 字段名（「出生年份」）；触发钮的无障碍名称是字段名加当前值。 */
  label: string;
  /** 弹层标题，也是对话框的无障碍名称。 */
  title: string;
  /** 当前值；null 时显示占位文字。 */
  value: ReactNode | null;
  placeholder: string;
  isDisabled?: boolean;
  /** 字段出错时错误信息元素的 id：触发钮据此加 `aria-invalid` 与 `aria-describedby`。 */
  errorId?: string | undefined;
  /** 弹层最小宽度（px）。 */
  width: number;
  /** 标题行中间的内容，缺省显示 `title`。 */
  header?: ReactNode;
  paging?: Paging;
  /** 弹层内按键的捕获处理（年份弹层的直接键入），先于选项网格的键盘处理执行。 */
  onKeyDownCapture?: (e: KeyboardEvent) => void;
  /** 弹层开合时调用；选择器据此在每次打开时回到初始视图。 */
  onOpenChange?: (open: boolean) => void;
  /** 触发钮的附加样式（流年选择条里的居中触发钮）。 */
  triggerClass?: string;
  children: (close: () => void) => ReactNode;
}) {
  const t = useMessages();
  const narrow = useMediaQuery(media.s);
  const labelId = useId();
  const valueId = useId();
  const onKeys = (e: KeyboardEvent) => {
    if (paging && (e.key === 'PageUp' || e.key === 'PageDown')) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'PageUp' && paging.canPrev) paging.onPrev();
      if (e.key === 'PageDown' && paging.canNext) paging.onNext();
      return;
    }
    onKeyDownCapture?.(e);
  };
  const dialog = (
    <Dialog className={css.dialog} aria-label={title}>
      {({ close }) => (
        <div className={css.frame} onKeyDownCapture={onKeys}>
          <div className={css.head}>
            {paging && (
              <Button className={css.headButton} aria-label={t.picker.prev} isDisabled={!paging.canPrev} onPress={paging.onPrev}>
                <PageIcon dir={-1} />
              </Button>
            )}
            <div className={css.headTitle}>{header ?? title}</div>
            {paging && (
              <Button className={css.headButton} aria-label={t.picker.next} isDisabled={!paging.canNext} onPress={paging.onNext}>
                <PageIcon dir={1} />
              </Button>
            )}
            <Button className={css.headButton} aria-label={t.picker.close} onPress={close}>
              <CloseIcon />
            </Button>
          </div>
          <div className={css.body}>{children(close)}</div>
        </div>
      )}
    </Dialog>
  );
  return (
    <DialogTrigger onOpenChange={onOpenChange}>
      <Button
        className={triggerClass ? `${css.trigger} ${triggerClass}` : css.trigger}
        aria-labelledby={value === null ? labelId : `${labelId} ${valueId}`}
        isDisabled={isDisabled}
        aria-describedby={errorId}
        render={(props) => <button {...props} aria-haspopup="dialog" aria-invalid={errorId ? true : undefined} />}
      >
        <span id={labelId} className={controls.visuallyHidden}>
          {label}
        </span>
        <span id={valueId} className={value === null ? css.placeholder : css.triggerValue}>
          {value ?? placeholder}
        </span>
        <span className={css.caret}>
          <CaretIcon />
        </span>
      </Button>
      {narrow ? (
        <ModalOverlay isDismissable className={css.overlay}>
          <Modal className={css.sheet}>{dialog}</Modal>
        </ModalOverlay>
      ) : (
        <Popover
          placement="bottom start"
          offset={4}
          className={css.popover}
          style={assignInlineVars({ [css.popoverWidth]: `${width}px` })}
        >
          {dialog}
        </Popover>
      )}
    </DialogTrigger>
  );
}

/** 网格里的一项。`key` 在同一网格里唯一。 */
export interface GridOption<K extends string | number> {
  key: K;
  /** 读屏与键入查找用的纯文字。 */
  text: string;
  content: ReactNode;
  /** 不可选时给出原因（「这个月没有三十」），读屏随选项读出。 */
  disabledReason?: string;
  /** 今天所在的一项，右上标一个小圆点。 */
  now?: boolean;
  /** 选项的无障碍名称；缺省用内容文字。 */
  label?: string;
}

/**
 * 选项网格：`role="listbox"` 加 `role="option"`，方向键按网格移动并跳过不可选项，
 * Home/End 到首尾，Enter 或空格选中。打开时焦点落在当前值（没有则第一项）。
 * 再次选中当前值也算选择（弹层照样关闭）。
 */
export function OptionGrid<K extends string | number>({
  label,
  columns,
  options,
  selected,
  onSelect,
  autoFocus = false,
  firstColumn = 1,
  listRef,
  row = false,
}: {
  label: string;
  columns: number;
  options: readonly GridOption<K>[];
  selected: K | null;
  onSelect: (key: K) => void;
  autoFocus?: boolean;
  /** 第一项从第几列开始（月历首日前留空格）。 */
  firstColumn?: number;
  listRef?: Ref<HTMLDivElement>;
  /** 列表式选项：一行里左名右注。 */
  row?: boolean;
}) {
  const byKey = new Map(options.map((o) => [String(o.key), o.key]));
  return (
    <ListBox
      ref={listRef}
      aria-label={label}
      layout="grid"
      selectionMode="single"
      escapeKeyBehavior="none"
      selectedKeys={selected === null ? [] : [selected]}
      onSelectionChange={(keys) => {
        if (keys === 'all') throw new Error('单选网格不会选中全部');
        const [first] = keys;
        if (first === undefined) {
          if (selected === null) throw new Error('没有当前值时不会出现取消选择');
          onSelect(selected);
          return;
        }
        const key = byKey.get(String(first));
        if (key === undefined) throw new Error(`选中的项不在网格里：${String(first)}`);
        onSelect(key);
      }}
      disabledKeys={options.filter((o) => o.disabledReason !== undefined).map((o) => o.key)}
      autoFocus={autoFocus ? 'first' : false}
      className={css.options}
      style={assignInlineVars({ [css.columns]: String(columns) })}
    >
      {options.map((o, i) => (
        <ListBoxItem
          key={o.key}
          id={o.key}
          textValue={o.text}
          aria-label={o.label}
          className={[css.option, row ? css.optionRow : '', o.now ? css.optionNow : ''].filter(Boolean).join(' ')}
          style={i === 0 && firstColumn > 1 ? ({ gridColumnStart: firstColumn } satisfies CSSProperties) : undefined}
        >
          {o.content}
          {o.disabledReason && <span className={controls.visuallyHidden}>{`，${o.disabledReason}`}</span>}
        </ListBoxItem>
      ))}
    </ListBox>
  );
}
