import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    main: 'src/preload/main.ts',
    feature: 'src/preload/feature.ts',
    tpl: 'src/preload/tpl.ts',
    detach: 'src/preload/detach.ts',
    guide: 'src/preload/guide.ts',
    compat: 'src/preload/compat.ts',
  },
  outDir: 'dist/preload',
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
