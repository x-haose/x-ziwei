import { fileURLToPath } from 'node:url';
import { reactRouter } from '@react-router/dev/vite';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { defineConfig } from 'vite';
import { fontsPlugin } from './scripts/fonts/plugin.ts';

export default defineConfig({
  plugins: [fontsPlugin({ root: fileURLToPath(new URL('.', import.meta.url)) }), vanillaExtractPlugin(), reactRouter()],
});
