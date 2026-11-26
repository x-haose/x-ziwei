import type { ChatError } from './conversation';
import { vendorMessage } from './providers';

/**
 * 把请求厂商时的失败分成错误块的几种（设计规范 19.8）。只看错误对象的字段（AI SDK 的 `APICallError` 带
 * `statusCode`、`responseBody`、`data`；流中途的厂商错误带 `statusCode` 或只有说明），不依赖 AI SDK 的类。
 */

/** 状态码 → 种类。400 / 404 / 422 且说明里讲的是不支持工具调用时为 `tools`。 */
export function kindOf(status: number | null, detail: string | null): ChatError['kind'] {
  if (status === null) return 'network';
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate';
  if ((status === 400 || status === 404 || status === 422) && detail !== null && toolsUnsupported(detail)) return 'tools';
  return 'other';
}

/**
 * 厂商说明里是不是「这个模型不支持工具调用」。各家措辞不一，按常见写法判断：
 * 「does not support tools / function calling」「tools are not supported」「function calling is not enabled」等。
 */
export function toolsUnsupported(detail: string): boolean {
  return /(tool|function)[\w\s-]*(not|n't|un)\s*(support|enabled|available|allowed)|(not|n't)\s*support[\w\s-]*(tool|function)/i.test(detail);
}

function field<T>(err: unknown, key: string, guard: (v: unknown) => v is T): T | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const v = (err as Record<string, unknown>)[key];
  return guard(v) ? v : undefined;
}

const isNumber = (v: unknown): v is number => typeof v === 'number';
const isString = (v: unknown): v is string => typeof v === 'string';

/** 错误里的厂商说明：错误体里的 `error.message`，没有时用错误自己的说明。 */
function detailOf(err: unknown): string | null {
  const data = field(err, 'data', (v): v is unknown => v !== undefined);
  const fromData = data === undefined ? null : vendorMessage(data);
  if (fromData) return fromData;
  const body = field(err, 'responseBody', isString);
  if (body) {
    try {
      const parsed = vendorMessage(JSON.parse(body));
      if (parsed) return parsed;
    } catch {
      return body.slice(0, 300);
    }
  }
  return err instanceof Error ? err.message : String(err);
}

/**
 * 请求失败 → 错误块。有状态码按状态码分；没有状态码且是网络层失败（`fetch` 抛的 TypeError，AI SDK 包成
 * 「Cannot connect to API」，原错误在 `cause`）为 `network`；其余（流中途厂商发来的错误事件等）为 `other`。
 */
export function classify(err: unknown): ChatError {
  const status = field(err, 'statusCode', isNumber) ?? null;
  const detail = detailOf(err);
  if (status !== null) return { kind: kindOf(status, detail), status, detail };
  const cause = field(err, 'cause', (v): v is unknown => v !== undefined);
  if (err instanceof TypeError || cause instanceof TypeError || (err instanceof Error && /Cannot connect to API/.test(err.message))) {
    return { kind: 'network', status: null, detail };
  }
  return { kind: 'other', status: null, detail };
}
