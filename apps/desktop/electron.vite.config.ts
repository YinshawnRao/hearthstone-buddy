import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { resolve } from 'node:path';

const parserEntry = resolve(__dirname, '../../packages/parser/src/index.ts');

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@hs-coach/parser'] })],
    resolve: {
      alias: { '@hs-coach/parser': parserEntry }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: { '@hs-coach/parser': parserEntry }
    }
  }
});
