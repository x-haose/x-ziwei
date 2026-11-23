import { useMemo, useState } from 'react';
import { Button, Dialog, Heading, Input, Modal, ModalOverlay, SearchField, Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import * as controls from '../components/controls.css';
import { CloseIcon, SearchIcon } from '../components/icons';
import { fmt, type Messages } from '../i18n/messages';
import { Markdown } from '../markdown/markdown';
import * as css from './knowledge.css';
import { DEFAULT_PACK_ID, type Pack, type PackRaw, SECTIONS, type Section } from './library';

/** 每次多显示的条目数。 */
const PAGE = 40;
/** 列表里摘要或正文的截取长度（字）。 */
const BRIEF = 70;

type Entry = Record<string, unknown>;

const text = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

function entriesOf(raw: PackRaw, s: Section): [string, Entry][] {
  const v = raw[s];
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return [];
  return Object.entries(v as Record<string, unknown>).map(([k, e]) => [k, typeof e === 'object' && e !== null ? (e as Entry) : {}]);
}

/** 条目的一句话：摘要，没有就正文；主题写选宫。 */
function briefOf(e: Entry, t: Messages): string {
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').join('、') : '') || '—';
  const s = text(e.summary) ?? text(e.intro) ?? (e.surround || e.palaces ? fmt(t.knowledge.view.topicBrief, { s: list(e.surround), p: list(e.palaces) }) : '');
  return s.length > BRIEF ? `${s.slice(0, BRIEF)}…` : s;
}

/**
 * 查看一个包（设计规范第 18.7 节）：右侧抽屉，六段页签（没有条目的段不可选）、搜索（名称、标识、正文）、
 * 条目列表（点开看全文，再点收起），每次显示 40 条。覆盖包的条目标「覆盖」（底包有同键）或「新增」。
 * Esc 或点遮罩关闭，焦点回到打开它的按钮。
 */
export function ViewDrawer({
  pack,
  raw,
  base,
  defaultPack,
  t,
  onClose,
}: {
  pack: Pack;
  raw: PackRaw;
  /** 覆盖包的底包；独立整包与默认包为 null。 */
  base: Pack | null;
  defaultPack: Pack;
  t: Messages;
  onClose: () => void;
}) {
  const v = t.knowledge.view;
  const first = SECTIONS.find((s) => pack.counts[s] > 0) ?? 'stars';
  const [section, setSection] = useState<Section>(first);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const entries = useMemo(() => entriesOf(raw, section), [raw, section]);
  const q = query.trim().toLowerCase();
  const list = q
    ? entries.filter(([k, e]) => k.toLowerCase().includes(q) || [e.name, e.title, e.summary, e.intro].some((x) => typeof x === 'string' && x.toLowerCase().includes(q)))
    : entries;
  const shown = list.slice(0, limit);
  const baseKeys = base ? new Set(base.keys[section]) : null;
  const label = (k: string, e: Entry) => text(e.name) ?? text(e.title) ?? k;
  const meta = [
    pack.id,
    pack.version ?? '—',
    pack.language ?? '—',
    base ? fmt(v.based, { name: base.name }) : pack.id === DEFAULT_PACK_ID ? t.knowledge.use.defaultKind : t.knowledge.use.wholeKind,
  ];
  let hint = q ? fmt(v.found, { n: list.length }) : fmt(v.count, { n: entries.length });
  if (pack.id !== DEFAULT_PACK_ID && defaultPack.counts[section]) {
    hint += fmt(v.share, { p: Math.round((entries.length / defaultPack.counts[section]) * 100) });
  }
  if (base) hint += v.overlayHint;
  const select = (s: Section) => {
    setSection(s);
    setQuery('');
    setOpen(null);
    setLimit(PAGE);
  };

  return (
    <ModalOverlay isOpen isDismissable onOpenChange={(o) => !o && onClose()} className={css.scrim}>
      <Modal className={css.drawer}>
        <Dialog className={css.drawerDialog} aria-labelledby="knowledge-view-title">
          <div className={css.drawerHead}>
            <div className={css.drawerHeadText}>
              <Heading slot="title" id="knowledge-view-title" className={css.drawerTitle}>
                {pack.name}
              </Heading>
              <p className={css.drawerMeta}>
                {meta.map((m, i) => (
                  // 元信息的四项位置固定（标识、版本、语言、基于），按位置作 key。
                  <span key={i} className={css.nowrap}>
                    {m}
                  </span>
                ))}
              </p>
            </div>
            <Button className={css.drawerClose} aria-label={v.close} onPress={onClose} autoFocus>
              <CloseIcon />
            </Button>
          </div>
          <Tabs
            selectedKey={section}
            onSelectionChange={(k) => select(k as Section)}
            disabledKeys={SECTIONS.filter((s) => pack.counts[s] === 0)}
            className={css.drawerTabs}
          >
            <div className={css.drawerTools}>
              <TabList aria-label={v.sectionsLabel} className={css.tabs}>
                {SECTIONS.map((s) => (
                  <Tab key={s} id={s} className={css.tab}>
                    <span>
                      {t.knowledge.sections[s]}
                      <small className={css.tabCount}>{pack.counts[s]}</small>
                    </span>
                  </Tab>
                ))}
              </TabList>
              <SearchField
                className={css.search}
                aria-label={fmt(v.searchLabel, { section: t.knowledge.sections[section] })}
                value={query}
                onChange={(x) => {
                  setQuery(x);
                  setOpen(null);
                  setLimit(PAGE);
                }}
              >
                <span className={css.searchIcon}>
                  <SearchIcon />
                </span>
                <Input className={css.searchInput} placeholder={v.searchPh} />
              </SearchField>
            </div>
            <TabPanel id={section} className={css.drawerBody}>
              <p className={css.hint}>{hint}</p>
              {shown.length === 0 && <p className={css.hint}>{v.none}</p>}
              {shown.map(([k, e]) => {
                const isOpen = open === k;
                const full = text(e.intro) ?? text(e.summary) ?? briefOf(e, t);
                return (
                  <div key={k} className={css.entry}>
                    <button type="button" className={css.entryButton} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : k)}>
                      <b className={css.entryName}>
                        {label(k, e)}
                        {baseKeys && <span className={css.entryTag}>{baseKeys.has(k) ? v.overrides : v.adds}</span>}
                      </b>
                      <span className={css.entryKey}>{k}</span>
                      {!isOpen && <span className={css.entryBrief}>{briefOf(e, t)}</span>}
                    </button>
                    {isOpen && (
                      <div className={css.entryFull}>
                        <Markdown source={full} variant="preview" />
                      </div>
                    )}
                  </div>
                );
              })}
              {list.length > shown.length && (
                <Button className={`${controls.ghost} ${css.more}`} onPress={() => setLimit((n) => n + PAGE)}>
                  {fmt(v.more, { n: Math.min(PAGE, list.length - shown.length), total: list.length })}
                </Button>
              )}
            </TabPanel>
          </Tabs>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
