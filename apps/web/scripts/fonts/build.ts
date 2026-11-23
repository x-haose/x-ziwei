import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Blob as HbBlob, Face as HbFace } from 'harfbuzzjs';
import subsetFont from 'subset-font';
import { renameFont } from './sfnt.ts';
import { type Slice, codepointsOf, parseSlicingStrategy, planSlices, unicodeRange } from './slices.ts';
import { FONT_SOURCES, type FontSource, REST_CHUNK, SC_SLICING } from './sources.ts';

/**
 * 构建产物的清单。
 * - `critical`：内联进每个页面 `<head>` 的 @font-face 规则（中文的关键子集与整份的西文字体），首屏只等它们。
 * - `rest`：其余切片的 @font-face 样式表地址，页面不阻塞地加载。两部分的 unicode-range 互不重叠。
 * - `preload`：需要预载的字体文件。
 * 地址均为站点根路径下的绝对路径。
 */
export interface FontManifest {
  critical: string;
  rest: string;
  preload: string[];
}

interface StoredManifest extends FontManifest {
  /** 输入的指纹：来源、切片策略、关键字集或本文件的处理逻辑任何一项变了，就整体重做。 */
  key: string;
}

/** 处理逻辑的版本：改了切片、命名或 CSS 的生成方式时加一，让已有产物失效。 */
const PIPELINE_VERSION = 4;

/** 名字表里除默认的 0–6 之外还要保留的 nameID：商标、厂商、设计师、描述、网址、许可证、排版族名。 */
const PRESERVE_NAME_IDS = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 21, 22, 25];

const sha256 = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');

/** 字体来源下载失败。`retryable` 为真时是网络或上游的暂时故障，重新构建可能成功。 */
export class FontDownloadError extends Error {
  readonly retryable: boolean;
  constructor(message: string, { retryable, cause }: { retryable: boolean; cause?: unknown }) {
    super(message, { cause });
    this.name = 'FontDownloadError';
    this.retryable = retryable;
  }
}

/** 单次下载（含读完响应体）的时限，毫秒。最大的来源约 25 MB。 */
const DOWNLOAD_TIMEOUT_MS = 120_000;
/** 暂时故障（超时、连接中断、5xx、429）时的总尝试次数，两次之间等 2 秒、4 秒。 */
const DOWNLOAD_ATTEMPTS = 3;

/** 下载一次。HTTP 错误码里只有 5xx 与 429 算暂时故障；连接与读响应体途中的失败都算暂时故障。 */
async function download(url: string): Promise<Uint8Array> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  } catch (err) {
    throw new FontDownloadError(`连接失败：${url}`, { retryable: true, cause: err });
  }
  if (!res.ok) {
    await res.body?.cancel();
    throw new FontDownloadError(`下载失败（HTTP ${res.status}）：${url}`, { retryable: res.status >= 500 || res.status === 429 });
  }
  try {
    return new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    throw new FontDownloadError(`响应体读取中断：${url}`, { retryable: true, cause: err });
  }
}

/** 下载到缓存目录并校验 SHA-256。缓存里已有且校验通过就直接用；校验不过视为损坏，重新下载。 */
async function fetchVerified(url: string, expected: string, cacheDir: string): Promise<Uint8Array> {
  const file = path.join(cacheDir, expected);
  try {
    const cached = new Uint8Array(await readFile(file));
    if (sha256(cached) === expected) return cached;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  let data: Uint8Array | null = null;
  for (let attempt = 1; data === null; attempt++) {
    try {
      data = await download(url);
    } catch (err) {
      if (!(err instanceof FontDownloadError) || !err.retryable) throw err;
      if (attempt === DOWNLOAD_ATTEMPTS) {
        throw new FontDownloadError(`${err.message}（已试 ${DOWNLOAD_ATTEMPTS} 次，可重试）`, { retryable: true, cause: err });
      }
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  const actual = sha256(data);
  if (actual !== expected) throw new Error(`校验不符：${url}\n  期望 ${expected}\n  实得 ${actual}`);
  await mkdir(cacheDir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, data);
  await rename(tmp, file);
  return data;
}

function cmapOf(font: Uint8Array): Set<number> {
  const face = new HbFace(new HbBlob(font));
  return new Set(face.collectUnicodes());
}

async function toWoff2(font: Uint8Array, slice: Slice | null): Promise<Uint8Array> {
  const buffer = Buffer.from(font.buffer, font.byteOffset, font.byteLength);
  const out = slice
    ? await subsetFont(buffer, String.fromCodePoint(...slice.codepoints), {
        targetFormat: 'woff2',
        preserveNameIds: PRESERVE_NAME_IDS,
      })
    : await subsetFont(buffer, undefined, { targetFormat: 'woff2', preserveNameIds: PRESERVE_NAME_IDS, keepAllGlyphs: true });
  return new Uint8Array(out);
}

function fontFace(src: FontSource, file: string, range: string): string {
  return [
    '@font-face{',
    `font-family:"${src.family}";`,
    `src:url("/fonts/${file}") format("woff2");`,
    `font-weight:${src.weight[0]} ${src.weight[1]};`,
    'font-style:normal;',
    'font-display:swap;',
    `unicode-range:${range};`,
    '}',
  ].join('');
}

/**
 * 生成全部字体切片、@font-face 样式表与许可证副本，写进 `<root>/public/fonts/`。
 *
 * 输入（来源、切片策略、关键字集、处理逻辑版本）没变时直接返回上次的清单，不重做。
 * 输出目录每次重做前清空，目录里只有这一次的产物；文件名带内容哈希，可长期缓存。
 */
export async function buildFonts({ root, critical }: { root: string; critical: string }): Promise<FontManifest> {
  const outDir = path.join(root, 'public', 'fonts');
  const cacheDir = path.join(root, 'node_modules', '.cache', 'xzw-fonts');
  const manifestFile = path.join(outDir, 'manifest.json');
  const key = sha256(JSON.stringify({ PIPELINE_VERSION, FONT_SOURCES, SC_SLICING, REST_CHUNK, critical }));

  try {
    const stored = JSON.parse(await readFile(manifestFile, 'utf8')) as StoredManifest;
    if (stored.key === key) return { critical: stored.critical, rest: stored.rest, preload: stored.preload };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  const strategy = parseSlicingStrategy(
    new TextDecoder().decode(await fetchVerified(SC_SLICING.url, SC_SLICING.sha256, cacheDir)),
  );
  const criticalSet = codepointsOf(critical);

  await rm(outDir, { recursive: true, force: true });
  await mkdir(path.join(outDir, 'licenses'), { recursive: true });

  const criticalFaces: string[] = [];
  const restFaces: string[] = [];
  const preload: string[] = [];
  for (const src of FONT_SOURCES) {
    const original = await fetchVerified(src.url, src.sha256, cacheDir);
    const font = src.rename ? renameFont(original, src.rename.replacements, src.rename.forbidden) : original;
    const cmap = cmapOf(font);
    if (src.slicing === 'whole') {
      const woff2 = await toWoff2(font, null);
      const file = `${src.id}-${sha256(woff2).slice(0, 10)}.woff2`;
      await writeFile(path.join(outDir, file), woff2);
      criticalFaces.push(fontFace(src, file, unicodeRange([...cmap].sort((a, b) => a - b))));
      if (src.preload) preload.push(`/fonts/${file}`);
    } else {
      const slices = planSlices({ cmap, strategy, critical: criticalSet, restChunk: REST_CHUNK });
      for (const slice of slices) {
        const woff2 = await toWoff2(font, slice);
        const file = `${src.id}-${slice.name}-${sha256(woff2).slice(0, 10)}.woff2`;
        await writeFile(path.join(outDir, file), woff2);
        (slice.kind === 'critical' ? criticalFaces : restFaces).push(fontFace(src, file, unicodeRange(slice.codepoints)));
        if (src.preload && slice.kind === 'critical') preload.push(`/fonts/${file}`);
      }
    }
    await copyFile(path.join(root, 'fonts', 'licenses', src.license), path.join(outDir, 'licenses', src.license));
  }

  const restText = `${restFaces.join('\n')}\n`;
  const restFile = `fonts-${sha256(restText).slice(0, 10)}.css`;
  await writeFile(path.join(outDir, restFile), restText);
  const manifest: StoredManifest = { key, critical: criticalFaces.join(''), rest: `/fonts/${restFile}`, preload };
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  return { critical: manifest.critical, rest: manifest.rest, preload };
}
