import { ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import * as css from './controls.css';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** 不可选时给出原因，作为该段的提示与无障碍描述。 */
  disabledReason?: string;
}

/**
 * 分段控件：几项里恰好选一项（读屏为单选组，方向键在各段间移动）。
 * `serif` 让段内文字用衬线（运限层等盘面术语）。
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  serif = false,
  className,
}: {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  serif?: boolean;
  className?: string;
}) {
  return (
    <ToggleButtonGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={value === null ? [] : [value]}
      onSelectionChange={(keys) => {
        const [next] = keys;
        if (next !== undefined) onChange(next as T);
      }}
      className={className ? `${css.segmented} ${className}` : css.segmented}
    >
      {options.map((o) => (
        <ToggleButton
          key={o.value}
          id={o.value}
          isDisabled={o.disabledReason !== undefined}
          aria-description={o.disabledReason}
          className={serif ? `${css.segment} ${css.segmentSerif}` : css.segment}
        >
          {o.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
