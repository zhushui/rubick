import { BrowserView, BrowserWindow, session, Session } from 'electron';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import commonConst from '../../common/utils/commonConst';
import { PLUGIN_INSTALL_DIR as baseDir } from '@/common/constans/main';
import localConfig from '@/main/common/initLocalConfig';
import {
  WINDOW_HEIGHT,
  WINDOW_PLUGIN_HEIGHT,
  WINDOW_WIDTH,
} from '@/common/constans/common';
import { getPreloadPath, getSubAppEntry } from '@/main/common/runtimePaths';
import executeJavaScriptSafely from '@/main/common/executeJavaScriptSafely';
import {
  attachManagedView,
  detachManagedView,
  enableManagedViewAutoResize,
  ManagedView,
  setManagedViewBounds,
} from '@/main/common/managedView';

const toFileSystemPath = (targetPath) => {
  if (!targetPath || typeof targetPath !== 'string') {
    return targetPath;
  }

  if (/^file:/i.test(targetPath)) {
    return fileURLToPath(targetPath);
  }

  return targetPath;
};

const isSecureInternalPlugin = (plugin) =>
  plugin.name === 'rubick-system-feature' || !plugin.main;

const canStayOnInternalEntry = (entryUrl: string, nextUrl: string) => {
  if (!entryUrl || !nextUrl) {
    return false;
  }

  try {
    const current = new URL(entryUrl);
    const target = new URL(nextUrl);

    if (current.protocol !== target.protocol) {
      return false;
    }

    if (current.protocol === 'http:' || current.protocol === 'https:') {
      return current.origin === target.origin;
    }

    if (current.protocol === 'file:') {
      return current.href.split('#')[0] === target.href.split('#')[0];
    }
  } catch {
    return entryUrl === nextUrl;
  }

  return false;
};

const getExternalPreloadPath = (plugin, pluginIndexPath) => {
  const { name, preload, tplPath, indexPath } = plugin;
  if (!preload) return undefined;
  if (commonConst.dev()) {
    if (tplPath) {
      return path.resolve(toFileSystemPath(indexPath), './', preload);
    }
    return path.resolve(toFileSystemPath(pluginIndexPath), '../', preload);
  }
  if (tplPath) {
    return path.resolve(toFileSystemPath(indexPath), './', preload);
  }
  return path.resolve(toFileSystemPath(pluginIndexPath), '../', preload);
};

const configuredSessions = new WeakSet<Session>();

const configurePluginSession = (ses: Session) => {
  if (configuredSessions.has(ses)) {
    return;
  }

  configuredSessions.add(ses);

  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({
      requestHeaders: {
        ...details.requestHeaders,
        referer: '*',
      },
    });
  });

  ses.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...(details.responseHeaders || {}),
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Headers': ['*'],
        'Access-Control-Allow-Methods': ['GET, POST, PUT, PATCH, DELETE, OPTIONS'],
      },
    });
  });
};

const attachViewDebugLogs = (plugin, view: ManagedView) => {
  if (!commonConst.dev()) {
    return;
  }

  const prefix = isSecureInternalPlugin(plugin)
    ? `internal-view:${plugin.name}`
    : `plugin-view:${plugin.name}`;

  view.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL) => {
      console.error(
        `[${prefix}:load-fail] ${errorCode} ${errorDescription} ${validatedURL}`
      );
    }
  );

  view.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[${prefix}:gone]`, details);
  });
};

const viewPoolManager = () => {
  const viewPool: any = {
    views: [],
  };
  const maxLen = 4;
  return {
    getView(pluginName) {
      return viewPool.views.find((view) => view.pluginName === pluginName);
    },
    addView(pluginName, view) {
      if (this.getView(pluginName)) return;
      if (viewPool.views.length > maxLen) {
        viewPool.views.shift();
      }
      viewPool.views.push({
        pluginName,
        view,
      });
    },
  };
};

export default () => {
  let view: ManagedView | undefined;
  const viewInstance = viewPoolManager();

  const syncViewBounds = (window: BrowserWindow, targetView = view) => {
    if (!targetView || targetView.inDetach) {
      return;
    }

    setManagedViewBounds(window, targetView, WINDOW_HEIGHT);
  };

  const bindWindowResize = (window: BrowserWindow) => {
    if ((window as BrowserWindow & { __rubickViewResizeBound?: boolean }).__rubickViewResizeBound) {
      return;
    }

    (window as BrowserWindow & { __rubickViewResizeBound?: boolean }).__rubickViewResizeBound = true;
    window.on('resize', () => {
      syncViewBounds(window);
    });
  };

  const executeHooks = (hook, data) => {
    if (!view) return;
    const evalJs = `window.rubick?.__dispatchHook?.('${hook}'${
      data ? `, ${JSON.stringify(data)}` : ''
    })`;
    executeJavaScriptSafely(view.webContents, evalJs);
  };

  const viewReadyFn = async (window, { pluginSetting, ext }) => {
    if (!view) return;
    const height = pluginSetting && pluginSetting.height;
    window.setSize(WINDOW_WIDTH, height || WINDOW_PLUGIN_HEIGHT);
    syncViewBounds(window, view);
    enableManagedViewAutoResize(view);
    view.webContents.focus();
    executeHooks('PluginEnter', ext);
    executeHooks('PluginReady', ext);
    const config = await localConfig.getConfig();
    const darkMode = config.perf.common.darkMode;
    if (darkMode) {
      executeJavaScriptSafely(
        view.webContents,
        `window.setRubickThemeMode ? window.setRubickThemeMode('dark') : document.body.classList.add('dark')`
      );
    }
    executeJavaScriptSafely(window.webContents, `window.pluginLoaded()`);
  };

  const init = (plugin, window: BrowserWindow) => {
    if (view === null || view === undefined || view.inDetach) {
      createView(plugin, window);
      if (!isSecureInternalPlugin(plugin)) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('@electron/remote/main').enable(view.webContents);
      }
    }
  };

  const createView = (plugin, window: BrowserWindow) => {
    const {
      tplPath,
      indexPath,
      development,
      name,
      main = 'index.html',
      pluginSetting,
      ext,
    } = plugin;

    const secureInternalPlugin = isSecureInternalPlugin(plugin);
    let pluginIndexPath = tplPath || indexPath;
    let preloadPath;

    if (commonConst.dev() && development && !secureInternalPlugin) {
      pluginIndexPath = development;
      const pluginPath = path.resolve(baseDir, 'node_modules', name);
      preloadPath = path.resolve(pluginPath, plugin.preload || '');
    }

    if (plugin.name === 'rubick-system-feature' && !pluginIndexPath) {
      pluginIndexPath = getSubAppEntry('feature');
    }

    if (!plugin.main && !pluginIndexPath) {
      pluginIndexPath = getSubAppEntry('tpl');
    }

    if (!pluginIndexPath) {
      const pluginPath = path.resolve(baseDir, 'node_modules', name);
      pluginIndexPath = pathToFileURL(
        path.join(pluginPath, './', main)
      ).toString();
    }

    const partition = secureInternalPlugin ? `<internal:${name}>` : `<${name}>`;
    const ses = session.fromPartition(partition);
    configurePluginSession(ses);
    if (!secureInternalPlugin) {
      ses.setPreloads([getPreloadPath('compat')]);
      preloadPath = preloadPath || getExternalPreloadPath(plugin, pluginIndexPath);
    }

    const webPreferences = secureInternalPlugin
      ? {
          webSecurity: true,
          backgroundThrottling: false,
          sandbox: false,
          contextIsolation: true,
          nodeIntegration: false,
          navigateOnDragDrop: false,
          preload:
            plugin.name === 'rubick-system-feature'
              ? getPreloadPath('feature')
              : getPreloadPath('tpl'),
          session: ses,
          defaultFontSize: 14,
          defaultFontFamily: {
            standard: 'system-ui',
            serif: 'system-ui',
          },
          spellcheck: false,
        }
      : {
          webSecurity: false,
          nodeIntegration: true,
          contextIsolation: false,
          devTools: true,
          webviewTag: true,
          preload: preloadPath,
          session: ses,
          defaultFontSize: 14,
          defaultFontFamily: {
            standard: 'system-ui',
            serif: 'system-ui',
          },
          spellcheck: false,
        };

    view = new BrowserView({
      webPreferences,
    });

    attachViewDebugLogs(plugin, view);
    if (secureInternalPlugin) {
      const internalEntry = pluginIndexPath;
      view.webContents.on('will-navigate', (event, url) => {
        if (!canStayOnInternalEntry(internalEntry, url)) {
          event.preventDefault();
          if (/^file:/i.test(url)) {
            try {
              const droppedPath = fileURLToPath(url);
              if (process.env.NODE_ENV !== 'production') {
                console.log(
                  `[internal-view:${plugin.name}:drop-nav] ${droppedPath}`
                );
              }
              executeHooks('HostDrop', { files: [droppedPath] });
            } catch (error) {
              if (process.env.NODE_ENV !== 'production') {
                console.error(
                  `[internal-view:${plugin.name}:drop-nav:error]`,
                  error
                );
              }
            }
          }
        }
      });
    }
    bindWindowResize(window);
    attachManagedView(window, view);
    syncViewBounds(window, view);
    view.webContents.once('did-finish-load', () => viewReadyFn(window, plugin));
    view.webContents.loadURL(pluginIndexPath);
    view.webContents.focus();
  };

  const removeView = (window: BrowserWindow) => {
    if (!view) return;
    executeHooks('PluginOut', null);
    const snapshotView = view;
    detachManagedView(window, snapshotView);
    executeJavaScriptSafely(window.webContents, `window.initRubick()`);

    if (view === snapshotView) {
      view = undefined;
    }

    setTimeout(() => {
      if (!snapshotView.inDetach) {
        snapshotView.webContents?.destroy();
      }
    }, 0);
  };

  const getView = () => view;

  const takeView = (window: BrowserWindow) => {
    if (!view) {
      return undefined;
    }

    const snapshotView = view;
    detachManagedView(window, snapshotView);
    view = undefined;
    return snapshotView;
  };

  return {
    init,
    getView,
    takeView,
    removeView,
    executeHooks,
  };
};
