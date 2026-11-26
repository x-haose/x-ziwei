import { useState } from 'react';
import { Button, Dialog, Heading, Label, Modal, ModalOverlay, Radio, RadioGroup } from 'react-aria-components';
import * as controls from '../components/controls.css';
import { fmt, type Messages } from '../i18n/messages';
import * as kcss from '../knowledge/knowledge.css';
import { DEFAULT_PACK_ID, type Draft, type Pack } from '../knowledge/library';
import * as css from './editor.css';
import { blankRaw, idFree, today } from './model';

/**
 * 新建对话框（设计规范 20.2）：从空白或基于某个包；名称与标识。「开始编辑」时校验：都要写，标识不能是 iztro-docs，
 * 不与本机的包或另一份新包草稿重复。版本取今天，语言 zh-CN，都在「包信息」里改。
 */
export function NewPackDialog({
  t,
  packs,
  defaultPack,
  drafts,
  base: initialBase,
  onCancel,
  onStart,
}: {
  t: Messages;
  packs: readonly Pack[];
  defaultPack: Pack;
  drafts: readonly Draft[];
  /** 预选「基于某个包新建」与这个包；null 为「新建知识包」。 */
  base: string | null;
  onCancel: () => void;
  onStart: (raw: Record<string, unknown>) => void;
}) {
  const e = t.editor;
  const [mode, setMode] = useState<'blank' | 'based'>(initialBase === null ? 'blank' : 'based');
  const [base, setBase] = useState(initialBase ?? DEFAULT_PACK_ID);
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [errors, setErrors] = useState<{ name?: string; id?: string }>({});
  const all = [defaultPack, ...packs];

  const start = () => {
    const next: { name?: string; id?: string } = {};
    if (!name.trim()) next.name = e.newNameMissing;
    if (!id.trim()) next.id = e.newIdMissing;
    else if (id.trim() === DEFAULT_PACK_ID) next.id = e.newIdDefault;
    else if (!idFree(id.trim(), packs, drafts, null)) next.id = e.newIdTaken;
    setErrors(next);
    if (next.name || next.id) {
      document.getElementById(next.name ? 'new-pack-name' : 'new-pack-id')?.focus();
      return;
    }
    onStart(blankRaw({ id: id.trim(), name: name.trim(), base: mode === 'based' ? base : null, version: today(new Date()) }));
  };

  return (
    <ModalOverlay isOpen isDismissable onOpenChange={(o) => !o && onCancel()} className={kcss.scrim}>
      <Modal className={kcss.dialog} style={{ width: 'min(560px, calc(100vw - 32px))' }}>
        <Dialog aria-labelledby="new-pack-title">
          <Heading slot="title" id="new-pack-title" className={kcss.dialogTitle}>
            {e.newDialogTitle}
          </Heading>
          <RadioGroup value={mode} onChange={(v) => setMode(v as 'blank' | 'based')} className={css.radioGroup}>
            <Label className={css.infoLabel}>{e.startFrom}</Label>
            <Radio value="blank" className={css.radio}>
              <span className={css.radioMark} />
              <span>
                <span className={css.radioName}>{e.startBlank}</span>
                <span className={css.radioNote}>{e.startBlankNote}</span>
              </span>
            </Radio>
            <Radio value="based" className={css.radio}>
              <span className={css.radioMark} />
              <span>
                <span className={css.radioName}>{e.startBased}</span>
                <span className={css.radioNote}>{e.startBasedNote}</span>
              </span>
            </Radio>
          </RadioGroup>
          {mode === 'based' && (
            <RadioGroup value={base} onChange={setBase} className={css.radioGroup}>
              <Label className={css.infoLabel}>{e.basePick}</Label>
              {all.map((p) => (
                <Radio key={p.id} value={p.id} className={css.radio}>
                  <span className={css.radioMark} />
                  <span>
                    <span className={css.radioName}>{p.name}</span>
                    <span className={css.radioNote}>{p.extends ? fmt(e.baseDeclared, { id: p.extends }) : p.id}</span>
                  </span>
                </Radio>
              ))}
            </RadioGroup>
          )}
          <label className={css.formField}>
            <span className={css.infoLabel}>{e.newName}</span>
            <input id="new-pack-name" className={css.input} value={name} aria-invalid={errors.name ? true : undefined} onChange={(ev) => setName(ev.target.value)} />
            {errors.name && <span className={css.formError}>{errors.name}</span>}
          </label>
          <label className={css.formField}>
            <span className={css.infoLabel}>{e.newId}</span>
            <input id="new-pack-id" className={`${css.input} ${css.mono}`} value={id} aria-invalid={errors.id ? true : undefined} onChange={(ev) => setId(ev.target.value)} />
            <span className={css.infoNote}>{e.newIdNote}</span>
            {errors.id && <span className={css.formError}>{errors.id}</span>}
          </label>
          <div className={kcss.dialogActions}>
            <Button className={controls.ghost} onPress={onCancel}>
              {e.cancel}
            </Button>
            <Button className={controls.button} onPress={start}>
              {e.startEdit}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
