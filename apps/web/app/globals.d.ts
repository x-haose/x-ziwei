/** 内核 wasm 文件解压后的字节数，由 `vite.config.ts` 在构建时写入，用于装载进度。 */
declare const __XIZTRO_WASM_BYTES__: number;

/** 本次构建所部署的站点，由 `vite.config.ts` 写入；构建没设 `XZW_SITE` 时为 null。经 `app/lib/site.ts` 的 `site()` 读取。 */
declare const __XZW_SITE__: import('./lib/deploy').Site | null;
