import path from 'node:path';
import { createRequire } from 'node:module';
import { defineConfig } from 'vite';
import { createVueAppConfig } from '../vite.shared';

const require = createRequire(import.meta.url);

const createFeatureCsp = (isDev: boolean) => {
  const devOrigins = [
    'http://127.0.0.1:5174',
    'http://localhost:5174',
  ].join(' ');
  const wsOrigins = ['ws://127.0.0.1:5174', 'ws://localhost:5174'].join(' ');

  return [
    `default-src 'self' data: blob: file: https:${isDev ? ` ${devOrigins}` : ''}`,
    `img-src 'self' data: blob: file: https:${isDev ? ` ${devOrigins}` : ''}`,
    `font-src 'self' data: file: https:${isDev ? ` ${devOrigins}` : ''}`,
    `style-src 'self' 'unsafe-inline' https:${isDev ? ` ${devOrigins}` : ''}`,
    `script-src 'self' https:${isDev ? ` ${devOrigins}` : ''}`,
    `connect-src 'self' file: https:${isDev ? ` ${devOrigins} ${wsOrigins}` : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ');
};

const createFeatureManualChunk = (id: string) => {
  if (!id.includes('node_modules')) {
    return undefined;
  }

  if (id.includes('ant-design-vue') || id.includes('@ant-design/')) {
    return 'vendor-antd';
  }

  if (id.includes('vue3-lottie') || id.includes('lottie-web')) {
    return 'vendor-lottie';
  }

  if (id.includes('vue-i18n')) {
    return 'vendor-i18n';
  }

  if (
    id.includes('/vue/') ||
    id.includes('\\vue\\') ||
    id.includes('@vue/') ||
    id.includes('vue-router') ||
    id.includes('pinia')
  ) {
    return 'vendor-vue';
  }

  if (
    id.includes('axios') ||
    id.includes('markdown-it') ||
    id.includes('lodash.')
  ) {
    return 'vendor-utils';
  }

  return undefined;
};

export default defineConfig(({ command }) => {
  const isDev = command === 'serve';
  const baseConfig = createVueAppConfig({
    root: __dirname,
    outDir: path.resolve(__dirname, '../dist/apps/feature'),
    port: 5174,
    base: isDev ? '/' : './',
    alias: {
      '@': path.resolve(__dirname, 'src'),
      vuex: path.resolve(__dirname, 'src/store/compat.ts'),
    },
  });

  return {
    ...baseConfig,
    resolve: {
      ...(baseConfig.resolve || {}),
      alias: {
        ...((baseConfig.resolve && baseConfig.resolve.alias) || {}),
        // Keep vue-i18n on the runtime build so the packaged feature app
        // does not require `unsafe-eval` under its production CSP.
        'vue-i18n': require.resolve(
          'vue-i18n/dist/vue-i18n.runtime.esm-bundler.js'
        ),
        // vue3-lottie only needs the light player for our empty-state animations.
        // The default bundle ships expression support that pulls in `eval`.
        'lottie-web': require.resolve(
          'lottie-web/build/player/esm/lottie_light.min.js'
        ),
      },
    },
    build: {
      ...(baseConfig.build || {}),
      chunkSizeWarningLimit: 650,
      rollupOptions: {
        ...((baseConfig.build && baseConfig.build.rollupOptions) || {}),
        output: {
          ...(((baseConfig.build &&
            baseConfig.build.rollupOptions &&
            baseConfig.build.rollupOptions.output) as Record<string, unknown>) ||
            {}),
          manualChunks: createFeatureManualChunk,
        },
      },
    },
    define: {
      __INTLIFY_JIT_COMPILATION__: 'true',
      __INTLIFY_PROD_DEVTOOLS__: 'false',
      __VUE_I18N_FULL_INSTALL__: 'true',
      __VUE_I18N_LEGACY_API__: 'false',
    },
    plugins: [
      ...(baseConfig.plugins || []),
      {
        name: 'rubick-feature-csp',
        transformIndexHtml(html) {
          return html.replace(
            '__RUBICK_FEATURE_CSP__',
            createFeatureCsp(isDev)
          );
        },
      },
    ],
  };
});
