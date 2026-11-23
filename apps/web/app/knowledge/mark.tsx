import { Link } from 'react-aria-components';
import { type GridOption, OptionGrid, Picker } from '../birth/picker';
import * as pickerCss from '../birth/picker.css';
import { PageIcon } from '../components/icons';
import { type Lang, localePath } from '../i18n/lang';
import { fmt, type Messages } from '../i18n/messages';
import { DEFAULT_PACK_ID, type Pack, type Use, stackable, wholes } from './library';
import * as css from './mark.css';
import { activePacks, useLabel } from './parts';

/** 选择器里的一项：一种组合。`key` 写成 `def`、`stack:a,b`、`whole:id`。 */
function keyOf(use: Use): string {
  if (use.mode === 'whole') return use.whole === DEFAULT_PACK_ID ? 'def' : `whole:${use.whole}`;
  return use.stack.length ? `stack:${use.stack.join(',')}` : 'def';
}

function useOf(key: string, use: Use): Use {
  if (key === 'def') return { ...use, mode: 'stack', stack: [] };
  if (key.startsWith('stack:')) return { ...use, mode: 'stack', stack: key.slice(6).split(',') };
  if (key.startsWith('whole:')) return { ...use, mode: 'whole', whole: key.slice(6) };
  throw new Error(`不认识的组合：${key}`);
}

/**
 * 提示词区的「释义」标记（设计规范第 18.11 节）：当前组合名与「更换」。选择器的选项依次是默认包、
 * 默认包加每个覆盖包、默认包加全部覆盖包（多于一个时）、每个独立整包；当前组合不在其中时排在第二项。
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
  onPick: (next: Use) => void;
}) {
  const label = useLabel(activePacks(use, packs, defaultPack));
  const overlays = stackable(packs);
  const options: { key: string; label: string; kind: string }[] = [{ key: 'def', label: defaultPack.name, kind: t.chart.knowDefault }];
  for (const p of overlays) options.push({ key: `stack:${p.id}`, label: `${defaultPack.name} + ${p.name}`, kind: t.chart.knowStack });
  if (overlays.length > 1) {
    options.push({ key: `stack:${overlays.map((p) => p.id).join(',')}`, label: [defaultPack, ...overlays].map((p) => p.name).join(' + '), kind: t.chart.knowStack });
  }
  for (const p of wholes(packs)) options.push({ key: `whole:${p.id}`, label: p.name, kind: t.chart.knowWhole });
  const current = keyOf(use);
  if (!options.some((o) => o.key === current)) options.splice(1, 0, { key: current, label, kind: t.chart.knowStack });
  const grid: GridOption<string>[] = options.map((o) => ({
    key: o.key,
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
              onSelect={(key) => {
                close();
                if (key !== current) onPick(useOf(key, use));
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

