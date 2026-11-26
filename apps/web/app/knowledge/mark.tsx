import { Link } from 'react-aria-components';
import { type GridOption, OptionGrid, Picker } from '../birth/picker';
import * as pickerCss from '../birth/picker.css';
import { PageIcon } from '../components/icons';
import { type Lang, localePath } from '../i18n/lang';
import { fmt, type Messages } from '../i18n/messages';
import { type Pack, type Use, sameActive } from './library';
import * as css from './mark.css';
import { activePacks, useLabel } from './parts';

/** 选择器里的一项：一种组合（从下到上的包标识）。 */
interface Option {
  label: string;
  kind: string;
  layers: string[];
}

/**
 * 提示词区与对话栏的「释义」标记（设计规范第 18.11 节）：当前组合名与「更换」。选择器列出常用组合：
 * 当前组合、每个包单独、默认包加每个本机包；同一种组合只列一次。自己排顺序到知识包页（底部链接）。
 * 本机包库不可用时 `packs` 为空，只有默认包可选。
 */
export function KnowledgeMark({
  t,
  lang,
  use,
  packs,
  defaultPack,
  trigger,
  onPick,
}: {
  t: Messages;
  lang: Lang;
  use: Use;
  packs: readonly Pack[];
  defaultPack: Pack;
  /** 只放选择器的触发钮（阅读页脚的「换一套释义」）：钮上的字与样式。不给时是「释义 组合名 更换」一行。 */
  trigger?: { text: string; className: string };
  /** 选了另一种组合：由库里此刻的组合算出新组合的函数，以及新组合名。 */
  onPick: (next: (use: Use) => Use, label: string) => void;
}) {
  const label = useLabel(activePacks(use, packs, defaultPack));
  const options: Option[] = [{ label, kind: t.chart.knowCurrent, layers: use.layers }];
  const add = (o: Option) => {
    if (!options.some((x) => sameActive({ layers: x.layers }, { layers: o.layers }))) options.push(o);
  };
  for (const p of [defaultPack, ...packs]) add({ label: p.name, kind: t.chart.knowAlone, layers: [p.id] });
  for (const p of packs) add({ label: `${defaultPack.name} + ${p.name}`, kind: t.chart.knowOnDefault, layers: [defaultPack.id, p.id] });
  const current = 0;
  const grid: GridOption<number>[] = options.map((o, i) => ({
    key: i,
    text: o.label,
    label: fmt(t.chart.knowOption, { label: o.label, kind: o.kind }),
    content: (
      <>
        <b className={pickerCss.optionMain}>{o.label}</b>
        <small className={css.kind}>{o.kind}</small>
      </>
    ),
  }));
  const picker = (
    <Picker
      label={`${t.chart.knowMark}：${label}`}
      title={t.chart.knowPickerTitle}
      value={trigger ? trigger.text : t.chart.knowChange}
      placeholder={t.chart.knowChange}
      width={340}
      triggerClass={trigger ? trigger.className : css.change}
      bare={!!trigger}
    >
      {(close) => (
        <>
          <OptionGrid
            label={t.chart.knowListLabel}
            columns={1}
            row
            autoFocus
            options={grid}
            selected={current}
            onSelect={(i) => {
              close();
              const o = options[i];
              if (!o) throw new Error(`选择器里没有第 ${i} 项`);
              if (i !== current) onPick(() => ({ layers: o.layers }), o.label);
            }}
          />
          <Link className={css.manage} href={localePath(lang, '/knowledge')}>
            {t.chart.knowManage}
            <PageIcon dir={1} />
          </Link>
        </>
      )}
    </Picker>
  );
  if (trigger) return picker;
  return (
    <div className={css.mark}>
      <span>{t.chart.knowMark}</span>
      <b className={css.name} title={label}>
        {label}
      </b>
      {picker}
    </div>
  );
}
