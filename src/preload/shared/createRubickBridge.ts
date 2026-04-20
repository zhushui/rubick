import * as electron from 'electron';
import fs from 'node:fs';
import os from 'os';
import {
  getConfigStore,
  setConfigStore,
} from '@/common/utils/localConfigStore';
import {
  getBridgeStorageItem,
  setBridgeStorageItem,
  removeBridgeStorageItem,
} from '@/common/utils/localBridgeStorage';

type HookName =
  | 'onPluginEnter'
  | 'onPluginReady'
  | 'onPluginOut'
  | 'onShow'
  | 'onHide'
  | 'onHostDrop'
  | 'onHostDropState'
  | 'onSubInputChange'
  | 'onScreenCapture';

type HookRegistry = Partial<Record<HookName, (...args: any[]) => void>>;
type StickyHookName = 'onPluginEnter' | 'onPluginReady';

const { clipboard, ipcRenderer, screen, shell } = electron;
const webUtils = (
  electron as typeof electron & {
    webUtils?: {
      getPathForFile?: (file: unknown) => string;
    };
  }
).webUtils;

const getPathForFile = (file: unknown) => {
  if (!file || typeof webUtils?.getPathForFile !== 'function') {
    return '';
  }

  try {
    return webUtils.getPathForFile(file) || '';
  } catch {
    return '';
  }
};

const getPathsForFiles = (files: unknown) => {
  if (!files || typeof (files as { length?: number }).length !== 'number') {
    return [];
  }

  return Array.from(files as ArrayLike<unknown>)
    .map((file) => getPathForFile(file))
    .filter(Boolean);
};

const ipcSendSync = (type: string, data?: unknown) => {
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

const ipcSendAsync = async (type: string, data?: unknown) => {
  const returnValue = await ipcRenderer.invoke('msg-trigger-async', {
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

const createRubickBridge = () => {
  const hooks: HookRegistry = {};
  const pendingStickyHooks: Partial<Record<StickyHookName, unknown>> = {};

  const registerHook = (name: HookName, cb?: (...args: any[]) => void) => {
    if (typeof cb !== 'function') {
      delete hooks[name];
      return;
    }

    hooks[name] = cb;

    if (
      (name === 'onPluginEnter' || name === 'onPluginReady') &&
      Object.prototype.hasOwnProperty.call(pendingStickyHooks, name)
    ) {
      const payload = pendingStickyHooks[name as StickyHookName];
      delete pendingStickyHooks[name as StickyHookName];
      cb(payload);
    }
  };

  const dispatchHook = (name: string, payload?: unknown) => {
    const hookName = `on${name}` as HookName;
    const target = hooks[hookName];

    if (typeof target === 'function') {
      target(payload);
      return;
    }

    if (hookName === 'onPluginEnter' || hookName === 'onPluginReady') {
      pendingStickyHooks[hookName] = payload;
    }
  };

  return {
    hooks,
    __dispatchHook(name: string, payload?: unknown) {
      dispatchHook(name, payload);
    },
    onPluginEnter(cb: (...args: any[]) => void) {
      registerHook('onPluginEnter', cb);
    },
    onPluginReady(cb: (...args: any[]) => void) {
      registerHook('onPluginReady', cb);
    },
    onPluginOut(cb: (...args: any[]) => void) {
      hooks.onPluginOut = cb;
    },
    onShow(cb: (...args: any[]) => void) {
      hooks.onShow = cb;
    },
    onHide(cb: (...args: any[]) => void) {
      hooks.onHide = cb;
    },
    onHostDrop(cb?: (...args: any[]) => void) {
      if (typeof cb === 'function') {
        hooks.onHostDrop = cb;
        return;
      }

      delete hooks.onHostDrop;
    },
    onHostDropState(cb?: (...args: any[]) => void) {
      if (typeof cb === 'function') {
        hooks.onHostDropState = cb;
        return;
      }

      delete hooks.onHostDropState;
    },
    onHostDropTargetState(cb?: (...args: any[]) => void) {
      if (typeof cb === 'function') {
        hooks.onHostDropState = cb;
        return;
      }

      delete hooks.onHostDropState;
    },
    openPlugin(plugin: unknown) {
      return ipcSendSync('loadPlugin', plugin);
    },
    hideMainWindow() {
      return ipcSendSync('hideMainWindow');
    },
    showMainWindow() {
      return ipcSendSync('showMainWindow');
    },
    setHostFileDropEnabled(enabled: boolean) {
      return ipcSendSync('setHostFileDropEnabled', { enabled });
    },
    updateHostDropOverlay(
      payload:
        | {
            visible: boolean;
            bounds?: {
              x: number;
              y: number;
              width: number;
              height: number;
            };
            message?: string;
            darkMode?: boolean;
          }
        | null
    ) {
      return ipcSendSync('updateHostDropOverlay', payload);
    },
    updateHostDropTarget(
      payload:
        | {
            visible: boolean;
            bounds?: {
              x: number;
              y: number;
              width: number;
              height: number;
            };
            message?: string;
            darkMode?: boolean;
          }
        | null
    ) {
      return ipcSendSync('updateHostDropTarget', payload);
    },
    reportHostDropFiles(files: string[]) {
      return ipcSendAsync('reportHostDropFiles', { files });
    },
    showOpenDialog(
      options: unknown,
      callback?: (result: string[] | undefined) => void
    ) {
      if (typeof callback === 'function') {
        void ipcSendAsync('showOpenDialogAsync', options)
          .then((result) => callback(result))
          .catch(() => callback(undefined));
        return undefined;
      }

      const result = ipcSendSync('showOpenDialog', options);
      return result;
    },
    showOpenDialogAsync(options: unknown) {
      return ipcSendAsync('showOpenDialogAsync', options);
    },
    showSaveDialog(
      options: unknown,
      callback?: (result: string | undefined) => void
    ) {
      if (typeof callback === 'function') {
        void ipcSendAsync('showSaveDialogAsync', options)
          .then((result) => callback(result))
          .catch(() => callback(undefined));
        return undefined;
      }

      const result = ipcSendSync('showSaveDialog', options);
      return result;
    },
    showSaveDialogAsync(options: unknown) {
      return ipcSendAsync('showSaveDialogAsync', options);
    },
    setExpendHeight(height: number) {
      return ipcSendSync('setExpendHeight', height);
    },
    setSubInput(
      onChange: ((payload: { text: string }) => void) | undefined,
      placeholder = '',
      isFocus?: boolean
    ) {
      hooks.onSubInputChange = onChange;
      return ipcSendSync('setSubInput', { placeholder, isFocus });
    },
    removeSubInput() {
      delete hooks.onSubInputChange;
      return ipcSendSync('removeSubInput');
    },
    setSubInputValue(text: string | { value?: string; text?: string }) {
      const nextValue =
        typeof text === 'string' ? text : text.text ?? text.value ?? '';
      return ipcSendSync('setSubInputValue', { text: nextValue });
    },
    subInputBlur() {
      return ipcSendSync('subInputBlur');
    },
    getPath(name: string) {
      return ipcSendSync('getPath', { name });
    },
    showNotification(body: string, clickFeatureCode?: string) {
      return ipcSendSync('showNotification', { body, clickFeatureCode });
    },
    getLocalConfig() {
      return getConfigStore();
    },
    setLocalConfig(config: unknown) {
      return setConfigStore(config);
    },
    copyImage(img: string) {
      return ipcSendSync('copyImage', { img });
    },
    copyText(text: string) {
      return ipcSendSync('copyText', { text });
    },
    copyFile(file: string | string[]) {
      return ipcSendSync('copyFile', { file });
    },
    db: {
      put: (data: unknown) => ipcSendAsync('dbPut', { data }),
      get: (id: string) => ipcSendAsync('dbGet', { id }),
      remove: (doc: unknown) => ipcSendAsync('dbRemove', { doc }),
      bulkDocs: (docs: unknown[]) => ipcSendAsync('dbBulkDocs', { docs }),
      allDocs: (key?: string) => ipcSendAsync('dbAllDocs', { key }),
      postAttachment: (docId: string, attachment: unknown, type: string) =>
        ipcSendAsync('dbPostAttachment', { docId, attachment, type }),
      getAttachment: (docId: string) =>
        ipcSendAsync('dbGetAttachment', { docId }),
      getAttachmentType: (docId: string) =>
        ipcSendAsync('dbGetAttachmentType', { docId }),
    },
    dbStorage: {
      setItem(key: string, value: unknown) {
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
      getItem(key: string) {
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
      removeItem(key: string) {
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
    setFeature(feature: unknown) {
      return ipcSendSync('setFeature', { feature });
    },
    screenCapture(cb: (value: unknown) => void) {
      hooks.onScreenCapture = ({ data }: any) => cb(data);
      return ipcSendSync('screenCapture');
    },
    removeFeature(code: unknown) {
      return ipcSendSync('removeFeature', { code });
    },
    shellOpenExternal(url: string) {
      return shell.openExternal(url);
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
    shellOpenPath(targetPath: string) {
      return shell.openPath(targetPath);
    },
    getLocalId() {
      return ipcSendSync('getLocalId');
    },
    removePlugin() {
      return ipcRenderer.send('msg-trigger', { type: 'removePlugin' });
    },
    shellShowItemInFolder(targetPath: string) {
      return ipcRenderer.send('msg-trigger', {
        type: 'shellShowItemInFolder',
        data: { path: targetPath },
      });
    },
    redirect() {
      return undefined;
    },
    shellBeep() {
      return ipcSendSync('shellBeep');
    },
    getFileIcon(targetPath: string) {
      return ipcSendAsync('getFileIcon', { path: targetPath });
    },
    getCopyedFiles() {
      return ipcSendSync('getCopyFiles');
    },
    simulateKeyboardTap(key: string, ...modifier: string[]) {
      return ipcRenderer.send('msg-trigger', {
        type: 'simulateKeyboardTap',
        data: { key, modifier },
      });
    },
    readClipboardFormats() {
      return clipboard.availableFormats();
    },
    readClipboardText() {
      return clipboard.readText();
    },
    readClipboardImage() {
      return clipboard.readImage().toDataURL();
    },
    getPathForFile(file: unknown) {
      return getPathForFile(file);
    },
    getPathsForFiles(files: unknown) {
      return getPathsForFiles(files);
    },
    readFileAsDataUrl(targetPath: string) {
      const ext = targetPath.split('.').pop() || 'png';
      const content = fs.readFileSync(targetPath);
      return `data:image/${ext};base64,${content.toString('base64')}`;
    },
    fileExists(targetPath: string) {
      return fs.existsSync(targetPath);
    },
    clearClipboard() {
      clipboard.clear();
    },
    getCursorScreenPoint() {
      return screen.getCursorScreenPoint();
    },
    getDisplayNearestPoint(point: { x: number; y: number }) {
      return screen.getDisplayNearestPoint(point);
    },
    outPlugin() {
      return ipcRenderer.send('msg-trigger', { type: 'removePlugin' });
    },
    windowMoving(payload: {
      mouseX: number;
      mouseY: number;
      width: number;
      height: number;
    }) {
      return ipcRenderer.send('msg-trigger', {
        type: 'windowMoving',
        data: payload,
      });
    },
  };
};

const registerIpcListener = (
  channel: string,
  cb: (payload: any) => void
) => {
  const listener = (_event: unknown, payload: any) => cb(payload);
  ipcRenderer.removeAllListeners(channel);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

export { createRubickBridge, ipcSendSync, ipcSendAsync, registerIpcListener };
