import { contextBridge } from 'electron';
import {
  createRubickBridge,
  ipcSendAsync,
  ipcSendSync,
  registerIpcListener,
} from './shared/createRubickBridge';

const rubick = createRubickBridge();

contextBridge.exposeInMainWorld('rubick', {
  ...rubick,
  internal: {
    getAppList() {
      return ipcSendSync('getAppList');
    },
    getBuiltinPluginInfo() {
      return ipcSendSync('getBuiltinPluginInfo');
    },
    getLocalPlugins() {
      return ipcSendSync('getLocalPlugins');
    },
    addLocalPlugin(plugin: unknown) {
      return ipcSendSync('addLocalPluginRecord', { plugin });
    },
    updateLocalPlugin(plugin: unknown) {
      return ipcSendSync('updateLocalPluginRecord', { plugin });
    },
    upgradePlugin(name: string) {
      return ipcSendAsync('pluginUpgrade', { name });
    },
    execAction(action: string) {
      return ipcSendSync('execAction', { action });
    },
    popupMainMenu(payload: unknown) {
      return ipcSendSync('popupMainMenu', payload);
    },
    popupHistoryMenu(payload: unknown) {
      return ipcSendSync('popupHistoryMenu', payload);
    },
    sendPluginSomeKeyDownEvent(payload: unknown) {
      return ipcSendSync('sendPluginSomeKeyDownEvent', payload);
    },
    sendSubInputChangeEvent(payload: unknown) {
      return ipcSendSync('sendSubInputChangeEvent', payload);
    },
    detachPlugin() {
      return ipcSendSync('detachPlugin');
    },
    openPluginDevTools() {
      return ipcSendSync('openPluginDevTools');
    },
    onMainMenuAction(cb: (payload: any) => void) {
      return registerIpcListener('rubick:main-menu-action', cb);
    },
    onHistoryMenuAction(cb: (payload: any) => void) {
      return registerIpcListener('rubick:history-menu-action', cb);
    },
    onGlobalShortKey(cb: (payload: any) => void) {
      return registerIpcListener('global-short-key', cb);
    },
  },
});
