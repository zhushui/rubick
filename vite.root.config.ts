import path from 'node:path';
import { defineConfig } from 'vite';
import { createVueAppConfig } from './vite.shared';

export default defineConfig(({ command }) =>
  createVueAppConfig({
    root: __dirname,
    outDir: path.resolve(__dirname, 'dist/renderer'),
    port: 5173,
    base: command === 'serve' ? '/' : './',
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  })
);
