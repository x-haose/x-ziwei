import { Link } from 'react-aria-components';
import { type GridOption, OptionGrid, Picker } from '../birth/picker';
import * as pickerCss from '../birth/picker.css';
import { PageIcon } from '../components/icons';
import { type Lang, localePath } from '../i18n/lang';
import { fmt, type Messages } from '../i18n/messages';
import { type Pack, type Use, overlaysOf, sameActive, wholes } from './library';
import * as css from './mark.css';
import { activePacks, useLabel } from './parts';

/** 选择器里的一项：一种组合。`part` 是这个组合在它那种模式下的选择，套在库里此刻的组合上（另一种模式的选择不动）。 */
interface Option {
  label: string;
  kind: string;
  part: Partial<Use>;
}

/**
 * 提示词区的「释义」标记（设计规范第 18.11 节）：当前组合名与「更换」。选择器的选项依次是默认包、
 * 默认包加每个覆盖包、默认包加全部覆盖包（多于一个时），然后每个独立整包及它上面的同样几种叠加；
 * 当前组合不在其中时排在第二项。
 * 底部链到知识包页。本机包库不可用时 `packs` 为空，只有默认包可选。
 */
export function KnowledgeMark({
  t,
  lang,
  use,
  packs,
  defaultPack,
  onPick,
}: {
  t: Messages;
  lang: Lang;
  use: Use;
  packs: readonly Pack[];
  defaultPack: Pack;
  /** 选了另一种组合：由库里此刻的组合算出新组合的函数，以及新组合名。 */
  onPick: (next: (use: Use) => Use, label: string) => void;
}) {
  const label = useLabel(activePacks(use, packs, defaultPack));
  const options: Option[] = [{ label: defaultPack.name, kind: t.chart.knowDefault, part: { mode: 'stack', stack: [] } }];
  /** 一个底包上的各种叠加：每个覆盖包各一项，多于一个时再加全部叠上的一项。 */
  const layered = (base: Pack, part: (ids: string[]) => Partial<Use>) => {
    const overlays = overlaysOf(packs, base.id);
    for (const p of overlays) options.push({ label: `${base.name} + ${p.name}`, kind: t.chart.knowStack, part: part([p.id]) });
    if (overlays.length > 1) {
      options.push({ label: [base, ...overlays].map((p) => p.name).join(' + '), kind: t.chart.knowStack, part: part(overlays.map((p) => p.id)) });
    }
  };
  layered(defaultPack, (ids) => ({ mode: 'stack', stack: ids }));
  for (const w of wholes(packs)) {
    options.push({ label: w.name, kind: t.chart.knowWhole, part: { mode: 'whole', whole: w.id, wholeStack: [] } });
    layered(w, (ids) => ({ mode: 'whole', whole: w.id, wholeStack: ids }));
  }
  let current = options.findIndex((o) => sameActive({ ...use, ...o.part }, use));
  if (current < 0) {
    const part: Partial<Use> = use.mode === 'stack' ? { mode: 'stack', stack: use.stack } : { mode: 'whole', whole: use.whole, wholeStack: use.wholeStack };
    options.splice(1, 0, { label, kind: t.chart.knowStack, part });
    current = 1;
  }
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
  return (
    <div className={css.mark}>
      <span>{t.chart.knowMark}</span>
      <b className={css.name} title={label}>
        {label}
      </b>
      <Picker
        label={`${t.chart.knowMark}：${label}`}
        title={t.chart.knowPickerTitle}
        value={t.chart.knowChange}
        placeholder={t.chart.knowChange}
        width={340}
        triggerClass={css.change}
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
                if (i !== current) onPick((u) => ({ ...u, ...o.part }), o.label);
              }}
            />
            <Link className={css.manage} href={localePath(lang, '/knowledge')}>
              {t.chart.knowManage}
              <PageIcon dir={1} />
            </Link>
          </>
        )}
      </Picker>
    </div>
  );
}

