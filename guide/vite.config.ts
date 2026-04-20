import path from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : './',
  root: __dirname,
  publicDir: path.join(__dirname, 'public'),
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    port: 5177,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4177,
    strictPort: true,
  },
  build: {
    outDir: path.resolve(__dirname, '../dist/apps/guide'),
    emptyOutDir: true,
  },
}));
