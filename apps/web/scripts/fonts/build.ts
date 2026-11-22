import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Blob as HbBlob, Face as HbFace } from 'harfbuzzjs';
import subsetFont from 'subset-font';
import { renameFont } from './sfnt.ts';
import { type Slice, codepointsOf, cssOrder, parseSlicingStrategy, planSlices, sliceRange, unicodeRange } from './slices.ts';
import { FONT_SOURCES, type FontSource, REST_CHUNK, SC_SLICING } from './sources.ts';

/**
 * 构建产物的清单：页面引用的 CSS 与需要预载的字体文件，均为站点根路径下的绝对路径。
 */
export interface FontManifest {
  css: string;
  preload: string[];
}

interface StoredManifest extends FontManifest {
  /** 输入的指纹：来源、切片策略、关键字集或本文件的处理逻辑任何一项变了，就整体重做。 */
  key: string;
}

/** 处理逻辑的版本：改了切片、命名或 CSS 的生成方式时加一，让已有产物失效。 */
const PIPELINE_VERSION = 2;

/** 名字表里除默认的 0–6 之外还要保留的 nameID：商标、厂商、设计师、描述、网址、许可证、排版族名。 */
const PRESERVE_NAME_IDS = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 21, 22, 25];

const sha256 = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');

/** 下载到缓存目录并校验 SHA-256。缓存里已有且校验通过就直接用；校验不过视为损坏，重新下载。 */
async function fetchVerified(url: string, expected: string, cacheDir: string): Promise<Uint8Array> {
  const file = path.join(cacheDir, expected);
  try {
    const cached = new Uint8Array(await readFile(file));
    if (sha256(cached) === expected) return cached;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载失败（HTTP ${res.status}，可重试）：${url}`);
  const data = new Uint8Array(await res.arrayBuffer());
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
    `src:url("./${file}") format("woff2");`,
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
    if (stored.key === key) return { css: stored.css, preload: stored.preload };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  const strategy = parseSlicingStrategy(
    new TextDecoder().decode(await fetchVerified(SC_SLICING.url, SC_SLICING.sha256, cacheDir)),
  );
  const criticalSet = codepointsOf(critical);

  await rm(outDir, { recursive: true, force: true });
  await mkdir(path.join(outDir, 'licenses'), { recursive: true });

  const css: string[] = [];
  const preload: string[] = [];
  for (const src of FONT_SOURCES) {
    const original = await fetchVerified(src.url, src.sha256, cacheDir);
    const font = src.rename ? renameFont(original, src.rename.replacements, src.rename.forbidden) : original;
    const cmap = cmapOf(font);
    if (src.slicing === 'whole') {
      const woff2 = await toWoff2(font, null);
      const file = `${src.id}-${sha256(woff2).slice(0, 10)}.woff2`;
      await writeFile(path.join(outDir, file), woff2);
      css.push(fontFace(src, file, unicodeRange([...cmap].sort((a, b) => a - b))));
      if (src.preload) preload.push(`/fonts/${file}`);
    } else {
      const slices = planSlices({ cmap, strategy, critical: criticalSet, restChunk: REST_CHUNK });
      for (const slice of cssOrder(slices)) {
        const woff2 = await toWoff2(font, slice);
        const file = `${src.id}-${slice.name}-${sha256(woff2).slice(0, 10)}.woff2`;
        await writeFile(path.join(outDir, file), woff2);
        css.push(fontFace(src, file, sliceRange(slice)));
        if (src.preload && slice.kind === 'critical') preload.push(`/fonts/${file}`);
      }
    }
    await copyFile(path.join(root, 'fonts', 'licenses', src.license), path.join(outDir, 'licenses', src.license));
  }

  const cssText = `${css.join('\n')}\n`;
  const cssFile = `fonts-${sha256(cssText).slice(0, 10)}.css`;
  await writeFile(path.join(outDir, cssFile), cssText);
  const manifest: StoredManifest = { key, css: `/fonts/${cssFile}`, preload };
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  return { css: manifest.css, preload };
}
