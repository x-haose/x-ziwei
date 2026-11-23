import type { KnowledgeIssue } from 'x-iztro';
import { fmt, type Messages } from '../i18n/messages';

/** 引用参数里的长文本（如被空串覆盖的底包正文）最多显示的字数。 */
const PARAM_CHARS = 40;

/** 字段路径：对象键用「.」连接，数组下标写成「[n]」；空路径指整个包。 */
export function issuePath(path: readonly (string | number)[], t: Messages): string {
  if (path.length === 0) return t.knowledge.issues.root;
  return path.map((p, i) => (typeof p === 'number' ? `[${p}]` : i === 0 ? p : `.${p}`)).join('');
}

function paramText(v: unknown, t: Messages): string {
  if (Array.isArray(v)) return v.map((x) => paramText(x, t)).join(t.knowledge.diff.sep);
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > PARAM_CHARS ? `${s.slice(0, PARAM_CHARS)}…` : s;
}

/**
 * 内核校验出的一条问题的原因与改法：按 `code` 取文案、用 `params` 填值，有 `suggestion` 时补一句最接近的写法。
 * 文案表里没有的 `code`（内核新增的种类），或文案要的参数内核没给时，如实显示内核的英文说明。
 */
export function issueText(issue: KnowledgeIssue, t: Messages): string {
  const table = t.knowledge.issues as Readonly<Record<string, string>>;
  const template = Object.hasOwn(table, issue.code) ? table[issue.code] : undefined;
  if (template === undefined) return issue.message;
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(issue.params)) values[k] = paramText(v, t);
  const needed = [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
  if (needed.some((k) => values[k] === undefined)) return issue.message;
  const suggestion = values.suggestion ? fmt(t.knowledge.issues.suggest, { suggestion: values.suggestion }) : '';
  return fmt(template, values) + suggestion;
}
