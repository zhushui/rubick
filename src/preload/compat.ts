const electron = require('electron');
const { ipcRenderer, shell, screen, webUtils } = electron;
const remote = require('@electron/remote');
const { BrowserWindow, nativeTheme, app } = remote;
const os = require('os');
const path = require('path');
const fs = require('fs');
const { fileURLToPath, pathToFileURL } = require('url');

if (!electron.remote) {
  electron.remote = remote;
}

const appPath = app.getPath('userData');
const baseDir = path.join(appPath, './rubick-plugins-new');
const bridgeStoragePath = path.join(appPath, 'rubick-bridge-storage.json');

const ipcSendSync = (type, data) => {
  const returnValue = ipcRenderer.sendSync('msg-trigger', {
    type,
    data,
  });
  if (returnValue?.__rubickIpcError) {
    const error = new Error(returnValue.message);
    error.name = returnValue.name || 'Error';
    throw error;
  }
  if (returnValue instanceof Error) throw returnValue;
  return returnValue;
};

const ipcSend = (type, data) => {
  ipcRenderer.send('msg-trigger', {
    type,
    data,
  });
};

const ipcSendAsync = (type, data) =>
  ipcRenderer
    .invoke('msg-trigger-async', {
      type,
      data,
    })
    .then((returnValue) => {
      if (returnValue?.__rubickIpcError) {
        const error = new Error(returnValue.message);
        error.name = returnValue.name || 'Error';
        throw error;
      }
      if (returnValue instanceof Error) throw returnValue;
      return returnValue;
    });

const hooks = {};
const pendingStickyHooks = {};

const readBridgeStorage = () => {
  try {
    if (!fs.existsSync(bridgeStoragePath)) {
      return {};
    }

    const content = fs.readFileSync(bridgeStoragePath, 'utf8');
    return content ? JSON.parse(content) : {};
  } catch {
    return {};
  }
};

const writeBridgeStorage = (data) => {
  fs.writeFileSync(bridgeStoragePath, JSON.stringify(data));
  return data;
};

const getBridgeStorageItem = (key) => {
  const storage = readBridgeStorage();
  return Object.prototype.hasOwnProperty.call(storage, String(key))
    ? storage[String(key)]
    : null;
};

const setBridgeStorageItem = (key, value) => {
  const storage = readBridgeStorage();
  storage[String(key)] = value;
  writeBridgeStorage(storage);
  return value;
};

const removeBridgeStorageItem = (key) => {
  const storage = readBridgeStorage();
  delete storage[String(key)];
  writeBridgeStorage(storage);
};

const registerHook = (name, cb) => {
  if (typeof cb !== 'function') {
    delete hooks[name];
    return;
  }

  hooks[name] = cb;

  if (
    (name === 'onPluginEnter' || name === 'onPluginReady') &&
    Object.prototype.hasOwnProperty.call(pendingStickyHooks, name)
  ) {
    const payload = pendingStickyHooks[name];
    delete pendingStickyHooks[name];
    cb(payload);
  }
};

const dispatchHook = (name, payload) => {
  const hookName = `on${name}`;
  const target = hooks[hookName];

  if (typeof target === 'function') {
    target(payload);
    return;
  }

  if (hookName === 'onPluginEnter' || hookName === 'onPluginReady') {
    pendingStickyHooks[hookName] = payload;
  }
};

const getPathForFile = (file) => {
  if (!file || !webUtils || typeof webUtils.getPathForFile !== 'function') {
    return '';
  }

  try {
    return webUtils.getPathForFile(file) || '';
  } catch {
    return '';
  }
};

const getPathsForFiles = (files) => {
  if (!files || typeof files.length !== 'number') {
    return [];
  }

  return Array.from(files)
    .map((file) => getPathForFile(file))
    .filter(Boolean);
};

const patchFilePathCompatibility = () => {
  try {
    const filePrototype = globalThis?.File?.prototype;
    if (!filePrototype) return;

    const descriptor = Object.getOwnPropertyDescriptor(filePrototype, 'path');
    if (descriptor && typeof descriptor.get === 'function') {
      return;
    }

    Object.defineProperty(filePrototype, 'path', {
      configurable: true,
      enumerable: false,
      get() {
        return getPathForFile(this);
      },
    });
  } catch {
    // ignore compatibility patch failures for environments without DOM File
  }
};

const FILE_PATH_COMPAT_SCRIPT = `(() => {
  try {
    const electronModule = window.require ? window.require('electron') : null;
    const webUtils = electronModule && electronModule.webUtils;
    const FileCtor = window.File;
    if (!webUtils || !FileCtor || !FileCtor.prototype) return;
    const descriptor = Object.getOwnPropertyDescriptor(FileCtor.prototype, 'path');
    if (descriptor && typeof descriptor.get === 'function') return;
    Object.defineProperty(FileCtor.prototype, 'path', {
      configurable: true,
      enumerable: false,
      get() {
        try {
          return webUtils.getPathForFile(this) || '';
        } catch {
          return '';
        }
      },
    });
  } catch {}
})();`;

const isUrlLike = (value) =>
  typeof value === 'string' && /^[a-zA-Z][\w+.-]*:/.test(value);

const resolveWindowUrl = (pluginRoot, targetUrl = '') => {
  if (isUrlLike(targetUrl)) {
    return targetUrl;
  }

  return pathToFileURL(path.resolve(pluginRoot, targetUrl)).toString();
};

const resolvePreloadPath = (pluginRoot, preloadValue) => {
  if (!preloadValue || typeof preloadValue !== 'string') {
    return undefined;
  }

  if (/^file:/i.test(preloadValue)) {
    return fileURLToPath(preloadValue);
  }

  return path.isAbsolute(preloadValue)
    ? preloadValue
    : path.resolve(pluginRoot, preloadValue);
};

patchFilePathCompatibility();

const createLegacyUBrowserWaitScript = (selector, timeout) => `new Promise((resolve, reject) => {
  const selectorValue = ${JSON.stringify(selector)};
  const timeoutValue = ${Number(timeout) || 30000};
  const startedAt = Date.now();
  const tick = () => {
    try {
      if (document.querySelector(selectorValue)) {
        resolve(true);
        return;
      }
      if (Date.now() - startedAt >= timeoutValue) {
        reject(new Error('ubrowser wait timeout'));
        return;
      }
      setTimeout(tick, 100);
    } catch (error) {
      reject(error);
    }
  };
  tick();
})`;

const runLegacyUBrowser = async ({
  url,
  steps = [],
  clearStorage = false,
  show = false,
  options = {},
}) => {
  if (!url || typeof url !== 'string') {
    return [];
  }

  const ubrowserWindow = new BrowserWindow({
    width:
      typeof options.width === 'number' && options.width > 0
        ? options.width
        : 1024,
    height:
      typeof options.height === 'number' && options.height > 0
        ? options.height
        : 768,
    show: Boolean(options.show ?? show),
    useContentSize: true,
    autoHideMenuBar: true,
    webPreferences: {
      webSecurity: false,
      backgroundThrottling: false,
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: false,
      partition: `rubick-ubrowser-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`,
    },
  });

  try {
    await ubrowserWindow.loadURL(url);
    const results = [];

    for (const step of steps) {
      if (!step || typeof step !== 'object') {
        continue;
      }

      if (step.type === 'wait' && step.selector) {
        await ubrowserWindow.webContents.executeJavaScript(
          createLegacyUBrowserWaitScript(step.selector, step.timeout),
          true
        );
        continue;
      }

      if (step.type === 'evaluate' && step.source) {
        const value = await ubrowserWindow.webContents.executeJavaScript(
          `Promise.resolve(${step.source})`,
          true
        );
        results.push(value);
      }
    }

    return results;
  } finally {
    try {
      if (!ubrowserWindow.isDestroyed()) {
        if (clearStorage) {
          await ubrowserWindow.webContents.session.clearCache().catch(() => undefined);
          await ubrowserWindow.webContents.session
            .clearStorageData()
            .catch(() => undefined);
        }
        ubrowserWindow.destroy();
      }
    } catch {
      // ignore cleanup failures for best-effort legacy compatibility
    }
  }
};

const createLegacyUBrowserTask = (initialUrl = '') => {
  const state = {
    url: initialUrl,
    steps: [],
    clearStorage: false,
    show: false,
  };

  const task = {
    goto(url) {
      state.url = url;
      return task;
    },
    wait(selector, timeout = 30000) {
      state.steps.push({
        type: 'wait',
        selector,
        timeout,
      });
      return task;
    },
    evaluate(fn) {
      state.steps.push({
        type: 'evaluate',
        source:
          typeof fn === 'function'
            ? `(${fn.toString()})()`
            : String(fn || 'undefined'),
      });
      return task;
    },
    clearCookies() {
      state.clearStorage = true;
      return task;
    },
    hide() {
      state.show = false;
      return task;
    },
    run(options = {}) {
      return runLegacyUBrowser({
        url: state.url,
        steps: state.steps,
        clearStorage: state.clearStorage,
        show: state.show,
        options,
      });
    },
  };

  return task;
};

window.rubick = {
  hooks,
  __dispatchHook(name, payload) {
    dispatchHook(name, payload);
  },
  onPluginEnter(cb) {
    registerHook('onPluginEnter', cb);
  },
  onPluginReady(cb) {
    registerHook('onPluginReady', cb);
  },
  onPluginOut(cb) {
    typeof cb === 'function' && (hooks.onPluginOut = cb);
  },
  openPlugin(plugin) {
    ipcSendSync('loadPlugin', plugin);
  },
  onShow(cb) {
    typeof cb === 'function' && (hooks.onShow = cb);
  },
  onHide(cb) {
    typeof cb === 'function' && (hooks.onHide = cb);
  },
  onHostDrop(cb) {
    if (typeof cb === 'function') {
      hooks.onHostDrop = cb;
      return;
    }

    delete hooks.onHostDrop;
  },
  onHostDropState(cb) {
    if (typeof cb === 'function') {
      hooks.onHostDropState = cb;
      return;
    }

    delete hooks.onHostDropState;
  },
  onHostDropTargetState(cb) {
    if (typeof cb === 'function') {
      hooks.onHostDropState = cb;
      return;
    }

    delete hooks.onHostDropState;
  },
  hideMainWindow() {
    ipcSendSync('hideMainWindow');
  },
  showMainWindow() {
    ipcSendSync('showMainWindow');
  },
  setHostFileDropEnabled(enabled) {
    return ipcSendSync('setHostFileDropEnabled', { enabled });
  },
  updateHostDropOverlay(payload) {
    return ipcSendSync('updateHostDropOverlay', payload);
  },
  updateHostDropTarget(payload) {
    return ipcSendSync('updateHostDropTarget', payload);
  },
  reportHostDropFiles(files) {
    return ipcSendAsync('reportHostDropFiles', { files });
  },
  showOpenDialog(options, callback) {
    if (typeof callback === 'function') {
      void ipcSendAsync('showOpenDialogAsync', options)
        .then((result) => callback(result))
        .catch(() => callback(undefined));
      return undefined;
    }

    const result = ipcSendSync('showOpenDialog', options);
    return result;
  },
  showOpenDialogAsync(options) {
    return ipcSendAsync('showOpenDialogAsync', options);
  },
  showSaveDialog(options, callback) {
    if (typeof callback === 'function') {
      void ipcSendAsync('showSaveDialogAsync', options)
        .then((result) => callback(result))
        .catch(() => callback(undefined));
      return undefined;
    }

    const result = ipcSendSync('showSaveDialog', options);
    return result;
  },
  dialog: {
    showOpenDialogSync(options) {
      return ipcSendSync('showOpenDialog', options);
    },
    showOpenDialog(options) {
      return Promise.resolve(ipcSendSync('showOpenDialog', options));
    },
    showSaveDialogSync(options) {
      return ipcSendSync('showSaveDialog', options);
    },
    showSaveDialog(options) {
      return Promise.resolve(ipcSendSync('showSaveDialog', options));
    },
  },
  setExpendHeight(height) {
    ipcSendSync('setExpendHeight', height);
  },
  setSubInput(onChange, placeholder = '', isFocus) {
    typeof onChange === 'function' && (hooks.onSubInputChange = onChange);
    ipcSendSync('setSubInput', {
      placeholder,
      isFocus,
    });
  },
  removeSubInput() {
    delete hooks.onSubInputChange;
    ipcSendSync('removeSubInput');
  },
  setSubInputValue(text) {
    ipcSendSync('setSubInputValue', {
      text,
    });
  },
  subInputFocus() {
    return ipcSendSync('subInputFocus');
  },
  subInputSelect() {
    return ipcSendSync('subInputSelect');
  },
  subInputBlur() {
    ipcSendSync('subInputBlur');
  },
  startDrag(files) {
    return ipcSendAsync('startDrag', {
      file: typeof files === 'string' ? files : undefined,
      files: Array.isArray(files) ? files : undefined,
    });
  },
  readCurrentFolderPath() {
    return ipcSendAsync('readCurrentFolderPath');
  },
  getCurrentFolderPath() {
    return ipcSendSync('getCurrentFolderPath');
  },
  getCurrentBrowserUrl() {
    try {
      return ipcSendSync('getCurrentBrowserUrl');
    } catch {
      return '';
    }
  },
  readCurrentBrowserUrl() {
    return ipcSendAsync('readCurrentBrowserUrl').catch(() => '');
  },
  fetchUserServerTemporaryToken() {
    return Promise.resolve('');
  },
  clearUBrowserCache() {
    return true;
  },
  ubrowser: {
    goto(url) {
      return createLegacyUBrowserTask(url);
    },
  },
  getPath(name) {
    return ipcSendSync('getPath', { name });
  },
  showNotification(body, clickFeatureCode) {
    ipcSend('showNotification', { body, clickFeatureCode });
  },
  copyImage(img) {
    return ipcSendSync('copyImage', { img });
  },
  copyText(text) {
    return ipcSendSync('copyText', { text });
  },
  copyFile(file) {
    return ipcSendSync('copyFile', { file });
  },
  db: {
    put: (data) => ipcSendAsync('dbPut', { data }),
    get: (id) => ipcSendAsync('dbGet', { id }),
    remove: (doc) => ipcSendAsync('dbRemove', { doc }),
    bulkDocs: (docs) => ipcSendAsync('dbBulkDocs', { docs }),
    allDocs: (key) => ipcSendAsync('dbAllDocs', { key }),
    postAttachment: (docId, attachment, type) =>
      ipcSendAsync('dbPostAttachment', { docId, attachment, type }),
    getAttachment: (docId) => ipcSendAsync('dbGetAttachment', { docId }),
    getAttachmentType: (docId) =>
      ipcSendAsync('dbGetAttachmentType', { docId }),
  },
  dbStorage: {
    setItem: (key, value) => {
      setBridgeStorageItem(String(key), value);
      void ipcSendAsync('dbGet', { id: String(key) })
        .then((result) =>
          ipcSendAsync('dbPut', {
            data: {
              _id: String(key),
              _rev: result?._rev,
              value,
            },
          })
        )
        .catch(() => undefined);
      return value;
    },
    getItem: (key) => {
      const cachedValue = getBridgeStorageItem(String(key));
      if (cachedValue !== null) {
        return cachedValue;
      }

      void ipcSendAsync('dbGet', { id: String(key) })
        .then((result) => {
          if (result && 'value' in result) {
            setBridgeStorageItem(String(key), result.value);
          }
        })
        .catch(() => undefined);

      return null;
    },
    removeItem: (key) => {
      removeBridgeStorageItem(String(key));
      void ipcSendAsync('dbGet', { id: String(key) })
        .then((result) => {
          if (result) {
            return ipcSendAsync('dbRemove', { doc: result });
          }
          return undefined;
        })
        .catch(() => undefined);
    },
  },
  isDarkColors() {
    return false;
  },
  getFeatures() {
    return ipcSendSync('getFeatures');
  },
  setFeature(feature) {
    return ipcSendSync('setFeature', { feature });
  },
  screenCapture(cb) {
    typeof cb === 'function' &&
      (hooks.onScreenCapture = ({ data }) => {
        cb(data);
      });
    ipcSendSync('screenCapture');
  },
  removeFeature(code) {
    return ipcSendSync('removeFeature', { code });
  },
  shellOpenExternal(url) {
    shell.openExternal(url);
  },
  isMacOs() {
    return os.type() === 'Darwin';
  },
  isWindows() {
    return os.type() === 'Windows_NT';
  },
  isLinux() {
    return os.type() === 'Linux';
  },
  shellOpenPath(targetPath) {
    shell.openPath(targetPath);
  },
  getLocalId: () => ipcSendSync('getLocalId'),
  removePlugin() {
    ipcSend('removePlugin');
  },
  openPurchase() {
    return ipcSendSync('showNotification', {
      body: 'This build does not support in-app purchase.',
    });
  },
  openPaymentPermanent() {
    return ipcSendSync('showNotification', {
      body: 'This build does not support in-app purchase.',
    });
  },
  shellShowItemInFolder: (targetPath) => {
    ipcSend('shellShowItemInFolder', { path: targetPath });
  },
  redirect: () => undefined,
  shellBeep: () => {
    ipcSend('shellBeep');
  },
  getFileIcon: (targetPath) => {
    return ipcSendAsync('getFileIcon', { path: targetPath });
  },
  getCopyedFiles: () => {
    return ipcSendSync('getCopyFiles');
  },
  getPathForFile,
  getPathsForFiles,
  simulateKeyboardTap: (key, ...modifier) => {
    ipcSend('simulateKeyboardTap', { key, modifier });
  },
  getCursorScreenPoint: () => {
    return screen.getCursorScreenPoint();
  },
  getDisplayNearestPoint: (point) => {
    return screen.getDisplayNearestPoint(point);
  },
  outPlugin: () => {
    return ipcSend('removePlugin');
  },
  createBrowserWindow: (url, options, callback) => {
    const winUrl = path.resolve(baseDir, 'node_modules', options.name);
    const webPreferences = options.webPreferences || {};
    const winIndex = resolveWindowUrl(winUrl, url || '');
    const preloadPath = resolvePreloadPath(
      winUrl,
      webPreferences.preload || ''
    );
    let win = new BrowserWindow({
      useContentSize: true,
      resizable: true,
      title: 'rubick',
      show: false,
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#1c1c28' : '#fff',
      ...options,
      webPreferences: {
        webSecurity: false,
        backgroundThrottling: false,
        contextIsolation: false,
        webviewTag: true,
        nodeIntegration: true,
        navigateOnDragDrop: false,
        spellcheck: false,
        partition: null,
        ...webPreferences,
        preload: preloadPath,
      },
    });
    win.loadURL(winIndex);
    win.on('closed', () => {
      win = undefined;
    });
    win.once('ready-to-show', () => {
      win.show();
    });
    win.webContents.on('dom-ready', () => {
      win.webContents
        .executeJavaScript(FILE_PATH_COMPAT_SCRIPT)
        .catch(() => undefined);
      callback && callback();
    });
    return win;
  },
};

if (typeof globalThis !== 'undefined') {
  globalThis.rubick = window.rubick;
  if (typeof globalThis.utools === 'undefined') {
    globalThis.utools = window.rubick;
  }
}

if (typeof window.utools === 'undefined') {
  window.utools = window.rubick;
}
