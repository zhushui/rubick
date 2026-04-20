import path from 'node:path';
import { pathToFileURL } from 'node:url';
import commonConst from '@/common/utils/commonConst';

// In both the main bundle and preload bundles, `__dirname` points at
// `<appRoot>/dist/main` or `<appRoot>/dist/preload` after build/package.
// Walking up two levels gives us the real runtime app root for:
// - local dev builds: `<repoRoot>`
// - packaged apps: `<resources>/app.asar`
const APP_ROOT = path.resolve(__dirname, '..', '..');
const PROJECT_ROOT = APP_ROOT;
const DIST_ROOT = path.resolve(APP_ROOT, 'dist');
const PRELOAD_ROOT = path.join(DIST_ROOT, 'preload');
const APPS_ROOT = path.join(DIST_ROOT, 'apps');
const STATIC_ROOT = commonConst.dev()
  ? path.join(PROJECT_ROOT, 'public')
  : path.join(DIST_ROOT, 'renderer');

const DEV_SERVER_URLS = {
  renderer: 'http://127.0.0.1:5173',
  feature: 'http://127.0.0.1:5174/#/',
  tpl: 'http://127.0.0.1:5175/#/',
  detach: 'http://127.0.0.1:5176',
  guide: 'http://127.0.0.1:5177',
};

const toFileUrl = (targetPath: string) => pathToFileURL(targetPath).toString();

const getRendererEntry = () =>
  commonConst.dev()
    ? DEV_SERVER_URLS.renderer
    : toFileUrl(path.join(DIST_ROOT, 'renderer', 'index.html'));

const getSubAppEntry = (name: 'feature' | 'tpl' | 'detach' | 'guide') => {
  if (commonConst.dev()) {
    return DEV_SERVER_URLS[name];
  }
  return toFileUrl(path.join(APPS_ROOT, name, 'index.html'));
};

const getBuiltinPluginManifestPath = () =>
  commonConst.dev()
    ? path.join(PROJECT_ROOT, 'feature', 'public', 'package.json')
    : path.join(APPS_ROOT, 'feature', 'package.json');

const getStaticAssetPath = (...segments: string[]) =>
  path.join(STATIC_ROOT, ...segments);

const getPreloadPath = (
  name: 'main' | 'feature' | 'tpl' | 'detach' | 'guide' | 'compat'
) => path.join(PRELOAD_ROOT, `${name}.cjs`);

export {
  getRendererEntry,
  getSubAppEntry,
  getBuiltinPluginManifestPath,
  getStaticAssetPath,
  getPreloadPath,
};
