import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/main/index.ts',
  },
  outDir: 'dist/main',
  format: ['cjs'],
  outExtension() {
    return {
      js: '.cjs',
    };
  },
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  clean: true,
  dts: false,
  splitting: false,
  external: ['electron'],
});
