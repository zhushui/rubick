import {
  BrowserWindow,
  ipcMain,
  dialog,
  app,
  Notification,
  nativeImage,
  clipboard,
  screen,
  shell,
  Menu,
} from 'electron';
import fs from 'fs';
import { exec } from 'child_process';
import { pathToFileURL } from 'url';
import { PluginHandler, screenCapture } from '@/core';
import appSearch from '@/core/app-search';
import plist from 'plist';

import {
  DECODE_KEY,
  PLUGIN_INSTALL_DIR as baseDir,
} from '@/common/constans/main';
import getCopyFiles from '@/common/utils/getCopyFiles';

import mainInstance from '../index';
import { runner, detach } from '../browsers';
import DBInstance from './db';
import getWinPosition from './getWinPosition';
import path from 'path';
import { simulateKeyboardTap as sendKeyboardTap } from './native/keyboardSender';
import { copyFilesToWindowsClipboard } from './windowsClipboard';
import {
  getBuiltinPluginManifestPath,
  getStaticAssetPath,
  getSubAppEntry,
} from './runtimePaths';
import { getAttachedManagedViews } from './managedView';
import hostDropOverlay from './hostDropOverlay';
import {
  consumeDroppedFiles,
  disableChildWindowFileDrop,
  enableChildWindowFileDrop,
  isWindowsHostDropAvailable,
  setWindowFileDropEnabled,
  WM_DROPFILES,
} from './windowsFileDrop';
import {
  disableOleWindowFileDrop,
  enableOleWindowFileDrop,
} from './windowsOleDrop';
import { WINDOW_HEIGHT } from '@/common/constans/common';

const sanitizeInputFiles = (input: unknown): string[] => {
  const candidates = Array.isArray(input)
    ? input
    : typeof input === 'string'
    ? [input]
    : [];
  return candidates
    .map((filePath) => (typeof filePath === 'string' ? filePath.trim() : ''))
    .filter((filePath) => {
      if (!filePath) return false;
      try {
        return fs.existsSync(filePath);
      } catch {
        return false;
      }
    });
};

const runnerInstance = runner();
const detachInstance = detach();

const isPromiseLike = (value: unknown): value is Promise<unknown> =>
  !!value &&
  (typeof value === 'object' || typeof value === 'function') &&
  typeof (value as Promise<unknown>).then === 'function';

const toIpcError = (error: unknown) => ({
  __rubickIpcError: true,
  name: error instanceof Error ? error.name : 'Error',
  message:
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error),
});

const truncateMenuLabel = (label: string, maxLength = 48) => {
  if (label.length <= maxLength) {
    return label;
  }

  return `${label.slice(0, maxLength - 1)}…`;
};

const buildPluginInfoSubmenu = (plugin: any) => {
  if (!plugin) {
    return [];
  }

  const description =
    typeof plugin.description === 'string' ? plugin.description.trim() : '';
  const featureLabels = Array.isArray(plugin.features)
    ? plugin.features
        .map((feature) =>
          typeof feature?.label === 'string' ? feature.label.trim() : ''
        )
        .filter(Boolean)
    : [];

  return [
    {
      label: '当前插件信息',
      submenu: [
        {
          label: truncateMenuLabel(
            `简介：${description || plugin.pluginName || '暂无'}`
          ),
        },
        {
          label: truncateMenuLabel(
            `功能：${featureLabels.length ? featureLabels.join('、') : '暂无'}`
          ),
        },
      ],
    },
  ];
};

class API extends DBInstance {
  private hostFileDropEnabled = false;
  private hostFileDropRetryTimers = new Set<NodeJS.Timeout>();

  init(mainWindow: BrowserWindow) {
    const handleRequest = (event, arg) => {
      const window = arg.winId ? BrowserWindow.fromId(arg.winId) : mainWindow;
      const handler = this[arg.type];

      if (typeof handler !== 'function') {
        throw new Error(`Unknown IPC method: ${arg?.type}`);
      }

      return handler.call(this, arg, window, event);
    };

    ipcMain.on('msg-trigger', (event, arg) => {
      try {
        const data = handleRequest(event, arg);
        if (isPromiseLike(data)) {
          event.returnValue = toIpcError(
            new Error(`IPC method "${arg?.type}" must be invoked asynchronously`)
          );
          return;
        }
        event.returnValue = data;
      } catch (error) {
        event.returnValue = toIpcError(error);
      }
    });

    try {
      ipcMain.removeHandler('msg-trigger-async');
    } catch {
      // ignore repeated handler registration in dev
    }

    ipcMain.handle('msg-trigger-async', async (event, arg) => {
      try {
        return await handleRequest(event, arg);
      } catch (error) {
        return toIpcError(error);
      }
    });
    mainWindow.webContents.on('before-input-event', (event, input) =>
      this.__EscapeKeyDown(event, input, mainWindow)
    );
    this.setupMainWindowHooks(mainWindow);
    this.setupWindowsFileDrop(mainWindow);
  }

  private setupMainWindowHooks(mainWindow: BrowserWindow) {
    mainWindow.on('show', () => {
      runnerInstance.executeHooks('Show', null);
    });

    mainWindow.on('hide', () => {
      runnerInstance.executeHooks('Hide', null);
    });
  }

  private setupWindowsFileDrop(mainWindow: BrowserWindow) {
    if (
      !isWindowsHostDropAvailable() ||
      (mainWindow as BrowserWindow & { __rubickHostDropHooked?: boolean })
        .__rubickHostDropHooked
    ) {
      return;
    }

    (
      mainWindow as BrowserWindow & {
        __rubickHostDropHooked?: boolean;
      }
    ).__rubickHostDropHooked = true;

    mainWindow.hookWindowMessage(WM_DROPFILES, (wParam) => {
      const files = consumeDroppedFiles(wParam).filter(Boolean);

      if (!this.hostFileDropEnabled || !files.length) {
        return;
      }

      runnerInstance.executeHooks('HostDrop', { files });
    });
  }

  public getCurrentWindow = (window, e) => {
    const senderWindow = BrowserWindow.fromWebContents(e?.sender);
    const hostWindow = e?.sender?.hostWebContents
      ? BrowserWindow.fromWebContents(e.sender.hostWebContents)
      : null;
    const focusedWindow = BrowserWindow.getFocusedWindow();

    return senderWindow || hostWindow || focusedWindow || detachInstance.getWindow() || window;
  };

  public __EscapeKeyDown = (_event, input, window) => {
    if (input.type !== 'keyDown') return;
    if (!(input.meta || input.control || input.shift || input.alt)) {
      if (input.key === 'Escape') {
        if (this.currentPlugin) {
          this.removePlugin(null, window);
        } else {
          mainInstance.windowCreator.getWindow().hide();
        }
      }
    }
  };

  public windowMoving({ data: { mouseX, mouseY, width, height } }, window, e) {
    const { x, y } = screen.getCursorScreenPoint();
    const originWindow = this.getCurrentWindow(window, e);
    if (!originWindow) return;
    originWindow.setBounds({ x: x - mouseX, y: y - mouseY, width, height });
    getWinPosition.setPosition(x - mouseX, y - mouseY);
  }

  public loadPlugin({ data: plugin }, window) {
    window.webContents.executeJavaScript(
      `window.loadPlugin(${JSON.stringify(plugin)})`
    );
    this.openPlugin({ data: plugin }, window);
  }

  public openPlugin({ data: plugin }, window) {
    if (plugin.platform && !plugin.platform.includes(process.platform)) {
      return new Notification({
        title: `插件不支持当前 ${process.platform} 系统`,
        body: `插件仅支持 ${plugin.platform.join(', ')}`,
        icon: plugin.logo,
      }).show();
    }
    window.setSize(window.getSize()[0], 60);
    this.removePlugin(null, window);
    if (!plugin.main) {
      plugin.tplPath = getSubAppEntry('tpl');
    }
    if (plugin.name === 'rubick-system-feature') {
      plugin.logo = plugin.logo || `file://${getStaticAssetPath('logo.png')}`;
      plugin.indexPath = getSubAppEntry('feature');
    } else if (!plugin.indexPath) {
      const pluginPath = path.resolve(baseDir, 'node_modules', plugin.name);
      plugin.indexPath = pathToFileURL(
        path.join(pluginPath, './', plugin.main || '')
      ).toString();
    }
    runnerInstance.init(plugin, window);
    this.currentPlugin = plugin;
    window.webContents.executeJavaScript(
      `window.setCurrentPlugin(${JSON.stringify({
        currentPlugin: this.currentPlugin,
      })})`
    );
    window.show();
    const view = runnerInstance.getView();
    if (view && !view.inited) {
      view.webContents.on('before-input-event', (event, input) =>
        this.__EscapeKeyDown(event, input, window)
      );
      view.inited = true;
    }
  }

  public removePlugin(_arg, window) {
    this.hostFileDropRetryTimers.forEach((timer) => clearTimeout(timer));
    this.hostFileDropRetryTimers.clear();
    this.hostFileDropEnabled = false;
    setWindowFileDropEnabled(window, false);
    disableChildWindowFileDrop(window);
    disableOleWindowFileDrop(window);
    hostDropOverlay.hide();
    runnerInstance.removeView(window);
    this.currentPlugin = null;
  }

  public openPluginDevTools(_arg, window, event) {
    const targetWindow = this.getCurrentWindow(window, event);
    const targetView = targetWindow
      ? getAttachedManagedViews(targetWindow)[0]
      : runnerInstance.getView();

    if (targetView?.webContents && !targetView.webContents.isDestroyed()) {
      targetView.webContents.openDevTools({ mode: 'detach' });
      return true;
    }

    if (targetWindow?.webContents && !targetWindow.webContents.isDestroyed()) {
      targetWindow.webContents.openDevTools({ mode: 'detach' });
      return true;
    }

    return false;
  }

  public hideMainWindow(_arg, window) {
    window.hide();
  }

  public showMainWindow(_arg, window) {
    window.show();
  }

  public setHostFileDropEnabled({ data }, window, e) {
    const originWindow = this.getCurrentWindow(window, e);
    if (!originWindow) return false;

    this.hostFileDropRetryTimers.forEach((timer) => clearTimeout(timer));
    this.hostFileDropRetryTimers.clear();
    this.hostFileDropEnabled = Boolean(data?.enabled);

    const enabled = setWindowFileDropEnabled(
      originWindow,
      this.hostFileDropEnabled
    );

    if (this.hostFileDropEnabled) {
      try {
        enableOleWindowFileDrop(originWindow, (event) =>
          hostDropOverlay.handleOleEvent(originWindow, event)
        );
      } catch (error) {
        console.error('[host-file-drop:ole-register:error]', error);
      }

      const attachChildDrop = () =>
        enableChildWindowFileDrop(originWindow, (files) => {
          runnerInstance.executeHooks('HostDrop', { files });
        });

      attachChildDrop();

      [300, 1000, 2500].forEach((delay) => {
        const timer = setTimeout(() => {
          this.hostFileDropRetryTimers.delete(timer);
          if (!this.hostFileDropEnabled || originWindow.isDestroyed()) {
            return;
          }

          attachChildDrop();
        }, delay);

        this.hostFileDropRetryTimers.add(timer);
      });
    } else {
      disableChildWindowFileDrop(originWindow);
      disableOleWindowFileDrop(originWindow);
      hostDropOverlay.hide();
    }
    return enabled;
  }

  public updateHostDropOverlay({ data }, window, e) {
    const originWindow = this.getCurrentWindow(window, e);
    if (!originWindow) {
      return false;
    }

    if (!data || data.visible === false || !data.bounds) {
      return hostDropOverlay.hide();
    }

    return hostDropOverlay.update(
      originWindow,
      {
        x: Number(data.bounds.x || 0),
        y: Number(data.bounds.y || 0) + WINDOW_HEIGHT,
        width: Number(data.bounds.width || 0),
        height: Number(data.bounds.height || 0),
      },
      (files) => {
        runnerInstance.executeHooks('HostDrop', { files });
      },
      (payload) => {
        runnerInstance.executeHooks('HostDropState', payload);
      }
    );
  }

  public updateHostDropTarget(arg, window, e) {
    return this.updateHostDropOverlay(arg, window, e);
  }

  public reportHostDropFiles({ data }) {
    const files = Array.isArray(data?.files) ? data.files.filter(Boolean) : [];
    if (!files.length) {
      return false;
    }

    runnerInstance.executeHooks('HostDrop', { files });
    return true;
  }

  public showOpenDialog({ data }, window, e) {
    const originWindow = this.getCurrentWindow(window, e);
    return dialog.showOpenDialogSync(originWindow || undefined, data);
  }

  public async showOpenDialogAsync({ data }, window, e) {
    const originWindow = this.getCurrentWindow(window, e);
    const result = await dialog.showOpenDialog(originWindow || undefined, data);
    return result.canceled ? undefined : result.filePaths;
  }

  public showSaveDialog({ data }, window, e) {
    const originWindow = this.getCurrentWindow(window, e);
    return dialog.showSaveDialogSync(originWindow || undefined, data);
  }

  public async showSaveDialogAsync({ data }, window, e) {
    const originWindow = this.getCurrentWindow(window, e);
    const result = await dialog.showSaveDialog(originWindow || undefined, data);
    return result.canceled ? undefined : result.filePath;
  }

  public setExpendHeight({ data: height }, window: BrowserWindow, e) {
    const originWindow = this.getCurrentWindow(window, e);
    if (!originWindow) return;
    originWindow.setSize(originWindow.getSize()[0], height);
    const screenPoint = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(screenPoint);
    const position =
      originWindow.getPosition()[1] + height > display.bounds.height
        ? height - 60
        : 0;
    originWindow.webContents.executeJavaScript(
      `window.setPosition && typeof window.setPosition === "function" && window.setPosition(${position})`
    );
  }

  public setSubInput({ data }, window, e) {
    const originWindow = this.getCurrentWindow(window, e);
    if (!originWindow) return;
    originWindow.webContents.executeJavaScript(
      `window.setSubInput(${JSON.stringify({
        placeholder: data.placeholder,
      })})`
    );
  }

  public subInputBlur() {
    runnerInstance.getView()?.webContents.focus();
  }

  public sendSubInputChangeEvent({ data }) {
    runnerInstance.executeHooks('SubInputChange', data);
  }

  public removeSubInput(_data, window, e) {
    const originWindow = this.getCurrentWindow(window, e);
    if (!originWindow) return;
    originWindow.webContents.executeJavaScript(`window.removeSubInput()`);
  }

  public setSubInputValue({ data }, window, e) {
    const originWindow = this.getCurrentWindow(window, e);
    if (!originWindow) return;
    originWindow.webContents.executeJavaScript(
      `window.setSubInputValue(${JSON.stringify({
        value: data.text,
      })})`
    );
    this.sendSubInputChangeEvent({ data });
  }

  public getPath({ data }) {
    return app.getPath(data.name);
  }

  public showNotification({ data: { body } }) {
    if (!Notification.isSupported()) return;
    const plugin = this.currentPlugin;
    const notify = new Notification({
      title: plugin ? plugin.pluginName : 'Rubick',
      body: typeof body === 'string' ? body : String(body),
      icon: plugin ? plugin.logo : undefined,
    });
    notify.show();
  }

  public copyImage = ({ data }) => {
    const image = nativeImage.createFromDataURL(data.img);
    clipboard.writeImage(image);
  };

  public copyText({ data }) {
    clipboard.writeText(String(data.text));
    return true;
  }

  public copyFile({ data }) {
    const targetFiles = sanitizeInputFiles(data?.file);

    if (!targetFiles.length) {
      return false;
    }

    if (process.platform === 'darwin') {
      try {
        clipboard.writeBuffer(
          'NSFilenamesPboardType',
          Buffer.from(plist.build(targetFiles))
        );
        return true;
      } catch {
        return false;
      }
    }

    if (process.platform === 'win32') {
      return copyFilesToWindowsClipboard(targetFiles);
    }

    return false;
  }

  public getFeatures() {
    return this.currentPlugin?.features;
  }

  public setFeature({ data }, window) {
    this.currentPlugin = {
      ...this.currentPlugin,
      features: (() => {
        let has = false;
        this.currentPlugin.features.some((feature) => {
          has = feature.code === data.feature.code;
          return has;
        });
        if (!has) {
          return [...this.currentPlugin.features, data.feature];
        }
        return this.currentPlugin.features;
      })(),
    };
    window.webContents.executeJavaScript(
      `window.updatePlugin(${JSON.stringify({
        currentPlugin: this.currentPlugin,
      })})`
    );
    return true;
  }

  public removeFeature({ data }, window) {
    this.currentPlugin = {
      ...this.currentPlugin,
      features: this.currentPlugin.features.filter((feature) => {
        if (data.code.type) {
          return feature.code.type !== data.code.type;
        }
        return feature.code !== data.code;
      }),
    };
    window.webContents.executeJavaScript(
      `window.updatePlugin(${JSON.stringify({
        currentPlugin: this.currentPlugin,
      })})`
    );
    return true;
  }

  public sendPluginSomeKeyDownEvent({ data: { modifiers, keyCode } }) {
    const code = DECODE_KEY[keyCode];
    const currentView = runnerInstance.getView();
    if (!code || !currentView) return;
    if (modifiers.length > 0) {
      currentView.webContents.sendInputEvent({
        type: 'keyDown',
        modifiers,
        keyCode: code,
      });
    } else {
      currentView.webContents.sendInputEvent({
        type: 'keyDown',
        keyCode: code,
      });
    }
  }

  public detachPlugin(_arg, window) {
    if (!this.currentPlugin) return;
    const view = runnerInstance.takeView(window);
    if (!view) return;
    window.webContents.executeJavaScript(`window.getMainInputInfo()`).then((res) => {
      detachInstance.init(
        {
          ...this.currentPlugin,
          subInput: res,
        },
        window.getBounds(),
        view
      );
      window.webContents.executeJavaScript(`window.initRubick()`);
      window.setSize(window.getSize()[0], 60);
      this.currentPlugin = null;
    });
  }

  public detachInputChange({ data }) {
    this.sendSubInputChangeEvent({ data });
  }

  public getLocalId() {
    return encodeURIComponent(app.getPath('home'));
  }

  public shellShowItemInFolder({ data }) {
    shell.showItemInFolder(data.path);
    return true;
  }

  public async getFileIcon({ data }) {
    const image = await app.getFileIcon(data.path, { size: 'normal' });
    return image.toDataURL();
  }

  public shellBeep() {
    shell.beep();
    return true;
  }

  public screenCapture(_arg, window) {
    screenCapture(window, (img) => {
      runnerInstance.executeHooks('ScreenCapture', {
        data: img,
      });
    });
  }

  public getCopyFiles() {
    return getCopyFiles();
  }

  public simulateKeyboardTap({ data: { key, modifier } }) {
    return sendKeyboardTap(key, Array.isArray(modifier) ? modifier : []);
  }

  public addLocalStartPlugin({ data: { plugin } }, window) {
    window.webContents.executeJavaScript(
      `window.addLocalStartPlugin(${JSON.stringify({
        plugin,
      })})`
    );
    return true;
  }

  public removeLocalStartPlugin({ data: { plugin } }, window) {
    window.webContents.executeJavaScript(
      `window.removeLocalStartPlugin(${JSON.stringify({
        plugin,
      })})`
    );
    return true;
  }

  public getAppList() {
    return appSearch(nativeImage);
  }

  public getBuiltinPluginInfo() {
    return JSON.parse(fs.readFileSync(getBuiltinPluginManifestPath(), 'utf8'));
  }

  public getLocalPlugins() {
    return global.LOCAL_PLUGINS.getLocalPlugins();
  }

  public addLocalPluginRecord({ data: { plugin } }) {
    global.LOCAL_PLUGINS.addPlugin(plugin);
    return global.LOCAL_PLUGINS.getLocalPlugins();
  }

  public updateLocalPluginRecord({ data: { plugin } }) {
    global.LOCAL_PLUGINS.updatePlugin(plugin);
    return global.LOCAL_PLUGINS.getLocalPlugins();
  }

  public async downloadPlugin({ data: { plugin } }) {
    await global.LOCAL_PLUGINS.downloadPlugin(plugin);
    return true;
  }

  public async deletePlugin({ data: { plugin } }) {
    await global.LOCAL_PLUGINS.deletePlugin(plugin);
    return true;
  }

  public refreshPlugin({ data: { plugin } }) {
    global.LOCAL_PLUGINS.refreshPlugin(plugin);
    return true;
  }

  public async pluginUpgrade({ data: { name } }) {
    const pluginHandler = new PluginHandler({ baseDir });
    await pluginHandler.upgrade(name);
    return true;
  }

  public execAction({ data: { action } }) {
    exec(action);
    return true;
  }

  public popupMainMenu({ data }, _window, event) {
    const pluginInfo =
      data?.plugin && typeof data.plugin === 'object'
        ? data.plugin
        : data?.hasPlugin
          ? {}
          : null;
    const menu = Menu.buildFromTemplate([
      {
        label: data.hideOnBlur ? '钉住' : '自动隐藏',
        click: () => {
          event.sender.send('rubick:main-menu-action', {
            action: 'toggle-hide-on-blur',
          });
        },
      },
      {
        label: data.lang === 'zh-CN' ? '切换语言' : 'Change Language',
        submenu: [
          {
            label: '简体中文',
            click: () => {
              event.sender.send('rubick:main-menu-action', {
                action: 'change-lang',
                value: 'zh-CN',
              });
            },
          },
          {
            label: 'English',
            click: () => {
              event.sender.send('rubick:main-menu-action', {
                action: 'change-lang',
                value: 'en-US',
              });
            },
          },
        ],
      },
      ...(pluginInfo
        ? [
            {
              label: '开发者工具',
              click: () => {
                event.sender.send('rubick:main-menu-action', {
                  action: 'open-plugin-devtools',
                });
              },
            },
            ...buildPluginInfoSubmenu(pluginInfo),
            {
              label: '分离窗口',
              click: () => {
                event.sender.send('rubick:main-menu-action', {
                  action: 'detach-plugin',
                });
              },
            },
          ]
        : []),
    ]);
    const targetWindow = BrowserWindow.fromWebContents(event.sender);
    menu.popup({ window: targetWindow || undefined });
    return true;
  }

  public popupHistoryMenu({ data }, _window, event) {
    const menu = Menu.buildFromTemplate([
      {
        label: '从使用记录中删除',
        click: () => {
          event.sender.send('rubick:history-menu-action', {
            action: 'remove',
          });
        },
      },
      ...(data.pinned
        ? [
            {
              label: '取消固定',
              click: () => {
                event.sender.send('rubick:history-menu-action', {
                  action: 'unpin',
                });
              },
            },
          ]
        : [
            {
              label: '固定到搜索面板',
              click: () => {
                event.sender.send('rubick:history-menu-action', {
                  action: 'pin',
                });
              },
            },
          ]),
    ]);
    const targetWindow = BrowserWindow.fromWebContents(event.sender);
    menu.popup({
      window: targetWindow || undefined,
      x: data.x,
      y: data.y,
    });
    return true;
  }
}

export default new API();
