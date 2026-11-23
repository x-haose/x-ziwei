import { statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { reactRouter } from '@react-router/dev/vite';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { defineConfig } from 'vite';
import { fontsPlugin } from './scripts/fonts/plugin.ts';

const wasm = createRequire(import.meta.url).resolve('x-iztro/x_iztro.wasm');

export default defineConfig({
  define: { __XIZTRO_WASM_BYTES__: JSON.stringify(statSync(wasm).size) },
  plugins: [fontsPlugin({ root: fileURLToPath(new URL('.', import.meta.url)) }), vanillaExtractPlugin(), reactRouter()],
});
