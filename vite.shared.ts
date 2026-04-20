import path from 'node:path';
import vue from '@vitejs/plugin-vue';
import tsconfigPaths from 'vite-tsconfig-paths';
import type { UserConfig } from 'vite';

const shouldIgnoreKnownRollupWarning = (warning: {
  id?: string;
  message: string;
}) =>
  warning.message.includes(
    'contains an annotation that Rollup cannot interpret due to the position of the comment'
  ) && warning.id?.includes('ant-design-vue/es/_util/hooks/_vueuse/');

export const createVueAppConfig = (options: {
  root: string;
  outDir: string;
  port: number;
  alias?: Record<string, string>;
  base?: string;
}): UserConfig => ({
  base: options.base,
  root: options.root,
  publicDir: path.join(options.root, 'public'),
  plugins: [vue(), tsconfigPaths()],
  resolve: {
    alias: options.alias,
  },
  server: {
    host: '127.0.0.1',
    port: options.port,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: options.port + 100,
    strictPort: true,
  },
  build: {
    outDir: options.outDir,
    emptyOutDir: true,
    rollupOptions: {
      onwarn(warning, warn) {
        if (shouldIgnoreKnownRollupWarning(warning)) {
          return;
        }

        warn(warning);
      },
    },
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
});
