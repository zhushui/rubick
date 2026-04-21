import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { app } from 'electron';
import { PLUGIN_INSTALL_DIR } from '@/common/constans/main';
import { getPreloadPath } from './runtimePaths';

const isUrlLike = (value: string) =>
  typeof value === 'string' && /^[a-zA-Z][\w+.-]*:/.test(value);

const normalizePluginFileUrl = (pluginRoot: string, targetUrl = '') => {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return targetUrl;
  }

  if (isUrlLike(targetUrl) && !/^file:/i.test(targetUrl)) {
    return targetUrl;
  }

  try {
    if (/^file:/i.test(targetUrl)) {
      return pathToFileURL(fileURLToPath(targetUrl)).toString();
    }
  } catch {
    // fall back to path resolution below for malformed legacy file URLs
  }

  const normalizedPath = /^file:/i.test(targetUrl)
    ? targetUrl.replace(/^file:\/*/i, '')
    : targetUrl;

  return pathToFileURL(path.resolve(pluginRoot, normalizedPath)).toString();
};

const resolvePluginPreload = (pluginRoot: string, preloadValue?: string) => {
  if (!preloadValue || typeof preloadValue !== 'string') {
    return undefined;
  }

  try {
    const resolvedPath = /^file:/i.test(preloadValue)
      ? fileURLToPath(preloadValue)
      : path.isAbsolute(preloadValue)
        ? preloadValue
        : path.resolve(pluginRoot, preloadValue);

    return fs.existsSync(resolvedPath) ? resolvedPath : undefined;
  } catch {
    return undefined;
  }
};

const buildSystemPluginCompatPreloadSource = (
  pluginName: string,
  originalPreload?: string
) => {
  const requireBaseCompatPreload = `require(${JSON.stringify(
    getPreloadPath('compat')
  )});\n`;
  const requireOriginalPreload = originalPreload
    ? `require(${JSON.stringify(originalPreload)});\n`
    : '';

  if (pluginName !== 'rubick-superx') {
    return `${requireBaseCompatPreload}${requireOriginalPreload}`;
  }

  return `${requireBaseCompatPreload}const electron = require('electron');
const originalSendSync = electron.ipcRenderer.sendSync.bind(electron.ipcRenderer);

const normalizeSuperPanelUserPlugins = (result, payload) => {
  if (
    payload?.type !== 'dbGet' ||
    payload?.data?.id !== 'super-panel-user-plugins'
  ) {
    return result;
  }

  if (!result || typeof result !== 'object' || Array.isArray(result.data)) {
    return result;
  }

  const normalizedList =
    [result.value, result.plugins, result.items, result.list].find(Array.isArray) || [];

  return {
    ...result,
    data: normalizedList,
  };
};

electron.ipcRenderer.sendSync = (channel, ...args) => {
  const result = originalSendSync(channel, ...args);
  if (channel === 'msg-trigger') {
    return normalizeSuperPanelUserPlugins(result, args[0]);
  }
  return result;
};

${requireOriginalPreload}`;
};

const ensureSystemPluginCompatPreload = (
  pluginName: string,
  originalPreload?: string
) => {
  const compatDir = path.join(
    app.getPath('userData'),
    'system-plugin-compat-preloads'
  );
  const compatPath = path.join(compatDir, `${pluginName}.cjs`);
  const compatSource = buildSystemPluginCompatPreloadSource(
    pluginName,
    originalPreload
  );

  try {
    fs.mkdirSync(compatDir, { recursive: true });
    const previousSource = fs.existsSync(compatPath)
      ? fs.readFileSync(compatPath, 'utf8')
      : '';
    if (previousSource !== compatSource) {
      fs.writeFileSync(compatPath, compatSource, 'utf8');
    }
    return compatPath;
  } catch {
    return originalPreload;
  }
};

const createCompatBrowserWindow = (
  BrowserWindowCtor,
  pluginRoot: string,
  pluginName: string
) =>
  class CompatBrowserWindow extends BrowserWindowCtor {
    constructor(options: any = {}) {
      const incomingWebPreferences = options.webPreferences || {};
      const resolvedPreload = resolvePluginPreload(
        pluginRoot,
        incomingWebPreferences.preload
      );
      const compatPreload = ensureSystemPluginCompatPreload(
        pluginName,
        resolvedPreload
      );

      super({
        ...options,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
          sandbox: false,
          webviewTag: true,
          webSecurity: false,
          backgroundThrottling: false,
          navigateOnDragDrop: false,
          spellcheck: false,
          ...incomingWebPreferences,
          preload: compatPreload,
        },
      });

      this.webContents.on(
        'did-fail-load',
        (_event, errorCode, errorDescription, validatedURL) => {
          console.error(
            `[system-plugin:${pluginName}:load-fail] ${errorCode} ${errorDescription} ${validatedURL}`
          );
        }
      );
      this.webContents.on('render-process-gone', (_event, details) => {
        console.error(`[system-plugin:${pluginName}:gone]`, details);
      });
    }

    loadURL(targetUrl: string, options?: any) {
      return super.loadURL(
        normalizePluginFileUrl(pluginRoot, targetUrl),
        options
      );
    }

    loadFile(filePath: string, options?: any) {
      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(pluginRoot, filePath);
      return super.loadFile(resolvedPath, options);
    }
  };

export default () => {
  const totalPlugins = global.LOCAL_PLUGINS.getLocalPlugins();
  let systemPlugins = totalPlugins.filter(
    (plugin) => plugin.pluginType === 'system'
  );
  systemPlugins = systemPlugins
    .map((plugin) => {
      try {
        const pluginPath = path.resolve(
          PLUGIN_INSTALL_DIR,
          'node_modules',
          plugin.name
        );
        return {
          ...plugin,
          indexPath: path.join(pluginPath, './', plugin.entry),
        };
      } catch {
        return false;
      }
    })
    .filter(Boolean);

  const hooks = {
    onReady: [],
  };

  systemPlugins.forEach((plugin) => {
    if (fs.existsSync(plugin.indexPath)) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pluginModule = require(plugin.indexPath)();
      hooks.onReady.push({
        hook: pluginModule.onReady,
        pluginName: plugin.name,
        pluginRoot: path.dirname(plugin.indexPath),
      });
    }
  });

  const triggerReadyHooks = (ctx) => {
    hooks.onReady.forEach((entry: any) => {
      try {
        entry?.hook &&
          entry.hook({
            ...ctx,
            BrowserWindow: createCompatBrowserWindow(
              ctx.BrowserWindow,
              entry.pluginRoot,
              entry.pluginName
            ),
          });
      } catch (error) {
        console.log(error);
      }
    });
  };

  return {
    triggerReadyHooks,
  };
};
