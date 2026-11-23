import { type RefObject, useState } from 'react';
import { Button, DropZone, FileTrigger, Tab, TabList, TabPanel, Tabs, TextArea } from 'react-aria-components';
import { LoadingBar } from '../chart/centre';
import * as controls from '../components/controls.css';
import { CaretIcon, FileIcon, LockIcon } from '../components/icons';
import { fmt, type Messages } from '../i18n/messages';
import type { KernelState } from '../kernel/kernel';
import type { ImportState, Problem } from './import';
import { issuePath, issueText } from './issues';
import * as css from './knowledge.css';
import { type Pack, diffAgainst } from './library';
import { diffText, totalOf } from './parts';

/** 一条原因的位置与文字。 */
export function problemText(p: Problem, t: Messages): { where: string; text: string } {
  const w = t.knowledge.where;
  const m = t.knowledge.problems;
  switch (p.code) {
    case 'notJsonFile':
      return { where: w.file, text: m.notJsonFile };
    case 'tooLarge':
      return { where: w.file, text: fmt(m.tooLarge, { mb: (p.bytes / 1024 / 1024).toFixed(1) }) };
    case 'unreadable':
      return { where: w.file, text: m.unreadable };
    case 'empty':
      return { where: w.file, text: m.empty };
    case 'syntax':
      return {
        where: p.line === null || p.column === null ? w.json : fmt(w.jsonAt, { line: p.line, column: p.column }),
        text: fmt(m.syntax, { detail: p.detail }),
      };
    case 'issue':
      return { where: issuePath(p.issue.path, t), text: issueText(p.issue, t) };
    case 'idMissing':
      return { where: w.id, text: m.idMissing };
    case 'idDefault':
      return { where: w.id, text: m.idDefault };
    case 'idTaken':
      return { where: w.id, text: fmt(m.idTaken, { id: p.id }) };
    case 'extendsMissing':
      return { where: w.extends, text: fmt(m.extendsMissing, { target: p.target }) };
    case 'extendsOverlay':
      return { where: w.extends, text: fmt(m.extendsOverlay, { target: p.target }) };
    case 'extendsBroken':
      return { where: w.extends, text: fmt(m.extendsBroken, { target: p.target }) };
    case 'full':
      return { where: w.storage, text: m.full };
    case 'storage':
      return { where: w.storage, text: fmt(m.storage, { reason: p.reason }) };
    case 'unexpected':
      return { where: w.file, text: fmt(m.unexpected, { reason: p.reason }) };
  }
}

/** 一组原因：错误（赭红左线）或提醒（`--line-3` 左线）。 */
export function ProblemList({ problems, warn = false, t }: { problems: Problem[]; warn?: boolean; t: Messages }) {
  return (
    <ul className={css.problems}>
      {problems.map((p, i) => {
        const { where, text } = problemText(p, t);
        return (
          // 原因按出现顺序排列，同一次结果里不会变动。
          <li key={i} className={warn ? `${css.problem} ${css.problemWarn}` : css.problem}>
            <code className={css.problemWhere}>{where}</code>
            <p className={css.problemText}>{text}</p>
          </li>
        );
      })}
    </ul>
  );
}

function Result({
  state,
  t,
  inUse,
  base,
  onUse,
  onView,
  onReset,
}: {
  state: ImportState;
  t: Messages;
  inUse: (id: string) => boolean;
  base: (pack: Pack) => Pack | null;
  onUse: (pack: Pack) => void;
  onView: (pack: Pack) => void;
  onReset: () => void;
}) {
  const k = t.knowledge.imp;
  const [showWarnings, setShowWarnings] = useState(false);
  if (state.phase === 'idle') return null;
  if (state.phase === 'busy') {
    return (
      <>
        <h3 className={css.resultTitle}>{k.importing}</h3>
        <p className={css.resultFile}>{state.file}</p>
        <ol className={css.steps}>
          {k.steps.map((label, i) => (
            <li key={label} className={css.step} data-state={i < state.step ? 'done' : i === state.step ? 'now' : undefined}>
              <span>{label}</span>
              <span className={css.stepNote}>{i < state.step ? k.stepDone : ''}</span>
            </li>
          ))}
        </ol>
      </>
    );
  }
  if (state.phase === 'error') {
    return (
      <>
        <h3 className={css.resultTitle}>{k.failed}</h3>
        <p className={css.resultFile}>{state.file}</p>
        <p className={css.problemLabel}>{fmt(k.mustFix, { n: state.errors.length })}</p>
        <ProblemList problems={state.errors} t={t} />
        {state.warnings.length > 0 && (
          <>
            <p className={css.warnLabel}>{fmt(k.alsoWarnings, { n: state.warnings.length })}</p>
            <ProblemList problems={state.warnings} warn t={t} />
          </>
        )}
        <div className={css.resultActions}>
          <Button className={`${controls.ghost} ${css.resultButton}`} onPress={onReset}>
            {k.again}
          </Button>
        </div>
      </>
    );
  }
  const p = state.pack;
  const b = base(p);
  return (
    <div className={css.okBox}>
      <h3 className={css.resultTitle}>{fmt(k.done, { name: p.name })}</h3>
      <dl className={css.okList}>
        <dt className={css.okTerm}>{k.id}</dt>
        <dd className={css.okValue}>{p.id}</dd>
        <dt className={css.okTerm}>{t.knowledge.list.version}</dt>
        <dd className={css.okValue}>{p.version ?? '—'}</dd>
        <dt className={css.okTerm}>{t.knowledge.list.language}</dt>
        <dd className={css.okValue}>{p.language ?? '—'}</dd>
        <dt className={css.okTerm}>{t.knowledge.list.base}</dt>
        <dd className={css.okValue}>
          {b ? fmt(k.overlayOn, { base: b.name, diff: diffText(diffAgainst(p, b), t) }) : fmt(k.wholeTotal, { n: totalOf(p.counts) })}
        </dd>
      </dl>
      {state.warnings.length > 0 && (
        <>
          <button type="button" className={css.warnToggle} aria-expanded={showWarnings} onClick={() => setShowWarnings((v) => !v)}>
            {fmt(k.warnings, { n: state.warnings.length })}
            <span className={css.warnCaret}>
              <CaretIcon />
            </span>
          </button>
          {showWarnings && <ProblemList problems={state.warnings} warn t={t} />}
        </>
      )}
      <div className={css.resultActions}>
        {inUse(p.id) ? (
          <span className={`${css.tag} ${css.tagOn}`}>{k.inUse}</span>
        ) : (
          <Button className={`${controls.button} ${css.resultButton}`} onPress={() => onUse(p)}>
            {p.extends === null ? k.useIt : k.stackIt}
          </Button>
        )}
        <Button className={`${controls.ghost} ${css.resultButton}`} onPress={() => onView(p)}>
          {t.knowledge.list.view}
        </Button>
      </div>
    </div>
  );
}


/**
 * 导入区（设计规范第 18.6 节）：选文件或拖放、粘贴 JSON 两种方式，下方是「只存在本机」的说明与结果区。
 * 存储不可用、内核未装好时不能导入；导入进行中时两种方式都不可用。
 */
export function ImportPanel({
  t,
  blocked,
  libraryReady,
  kstate,
  state,
  onFile,
  onPaste,
  onReset,
  inUse,
  base,
  onUse,
  onView,
  firstControl,
}: {
  t: Messages;
  /** 存储不可用或读库失败：导入关闭。 */
  blocked: boolean;
  /** 本机包库已读出（读取中时不能导入）。 */
  libraryReady: boolean;
  kstate: KernelState;
  state: ImportState;
  onFile: (file: File) => void;
  onPaste: (text: string) => void;
  onReset: () => void;
  inUse: (id: string) => boolean;
  base: (pack: Pack) => Pack | null;
  onUse: (pack: Pack) => void;
  onView: (pack: Pack) => void;
  /** 页头「导入知识包」聚焦的控件。 */
  firstControl: RefObject<HTMLButtonElement | null>;
}) {
  const k = t.knowledge.imp;
  const [text, setText] = useState('');
  const kernelReady = kstate.status === 'ready';
  const busy = state.phase === 'busy';
  const off = blocked || !libraryReady || !kernelReady || busy;
  const dropMessage = blocked ? k.blocked : kstate.status === 'error' ? k.kernelFailed : !kernelReady ? k.kernel : busy ? k.busy : k.drop;
  const progress = kstate.status === 'loading' ? kstate.loaded / kstate.total : 0;
  return (
    <>
      <Tabs className={css.importMode} keyboardActivation="manual">
        <TabList aria-label={k.modeLabel} className={controls.segmented}>
          <Tab id="file" className={`${controls.segment} ${css.modeTab}`}>
            {k.file}
          </Tab>
          <Tab id="paste" className={`${controls.segment} ${css.modeTab}`}>
            {k.paste}
          </Tab>
        </TabList>
        <TabPanel id="file">
          <DropZone
            className={off ? `${css.drop} ${css.dropOff}` : css.drop}
            aria-label={k.dropLabel}
            isDisabled={off}
            getDropOperation={() => 'copy'}
            onDrop={async (e) => {
              const item = e.items.find((i) => i.kind === 'file');
              if (item && item.kind === 'file') onFile(await item.getFile());
            }}
          >
            <span className={css.dropIcon}>
              <FileIcon />
            </span>
            <p className={css.dropText}>{dropMessage}</p>
            {kstate.status === 'loading' && !blocked ? (
              <div className={css.dropBar}>
                <LoadingBar progress={progress} loaded={kstate.loaded} total={kstate.total} t={t} />
              </div>
            ) : (
              <>
                <FileTrigger acceptedFileTypes={['.json', 'application/json']} onSelect={(files) => files?.[0] && onFile(files[0])}>
                  <Button ref={firstControl} className={controls.ghost} isDisabled={off}>
                    {k.pick}
                  </Button>
                </FileTrigger>
                <small className={css.dropSmall}>{k.limit}</small>
              </>
            )}
          </DropZone>
        </TabPanel>
        <TabPanel id="paste">
          <TextArea
            className={css.pasteArea}
            aria-label={k.pasteLabel}
            spellCheck={false}
            placeholder='{ "schema": 1, "id": "my-school", … }'
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={blocked || !kernelReady}
          />
          <Button className={`${controls.button} ${css.pasteButton}`} isDisabled={off} onPress={() => onPaste(text)}>
            {kstate.status === 'loading' && !blocked ? fmt(k.checkKernel, { p: Math.round(progress * 100) }) : k.check}
          </Button>
        </TabPanel>
      </Tabs>
      <p className={css.local} id="knowledge-local">
        <span className={css.localIcon}>
          <LockIcon />
        </span>
        <span>
          <b className={css.localStrong}>{k.local}</b>
          {k.localNote}
        </span>
      </p>
      <div className={css.result} aria-live="polite">
        <Result state={state} t={t} inUse={inUse} base={base} onUse={onUse} onView={onView} onReset={onReset} />
      </div>
    </>
  );
}

