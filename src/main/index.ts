'use strict';
import electron, { app, globalShortcut, BrowserWindow } from 'electron';
import { main, guide } from './browsers';
import commonConst from '../common/utils/commonConst';
import API from './common/api';
import createTray from './common/tray';
import registerHotKey from './common/registerHotKey';
import localConfig from './common/initLocalConfig';
import {
  getSearchFiles,
  putFileToRubick,
  macBeforeOpen,
} from './common/getSearchFiles';

import '../common/utils/localPlugin';

import checkVersion from './common/versionHandler';
import registerSystemPlugin from './common/registerSystemPlugin';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const remoteMain = require('@electron/remote/main');
remoteMain.initialize();

const shouldEnableRemoteForWindow = (window: BrowserWindow) => {
  const webPreferences = window.webContents.getLastWebPreferences?.() || {};
  const preloadPath =
    typeof webPreferences.preload === 'string' ? webPreferences.preload : '';

  return !!(
    webPreferences.nodeIntegration ||
    webPreferences.contextIsolation === false ||
    /rubick-plugins-new[\\/]/i.test(preloadPath)
  );
};

class App {
  public windowCreator: { init: () => void; getWindow: () => BrowserWindow };
  private systemPlugins: any;

  constructor() {
    this.windowCreator = main();
    app.on('browser-window-created', (_event, createdWindow) => {
      if (shouldEnableRemoteForWindow(createdWindow)) {
        remoteMain.enable(createdWindow.webContents);
      }
    });
    const shouldUseSingleInstanceLock = commonConst.production();
    const gotTheLock =
      !shouldUseSingleInstanceLock || app.requestSingleInstanceLock();
    if (!gotTheLock) {
      app.quit();
    } else {
      this.systemPlugins = registerSystemPlugin();
      this.beforeReady();
      this.onReady();
      this.onRunning();
      this.onQuit();
    }
  }

  beforeReady() {
    if (commonConst.macOS()) {
      macBeforeOpen();
      if (commonConst.production() && !app.isInApplicationsFolder()) {
        app.moveToApplicationsFolder();
      } else {
        app.dock.hide();
      }
    } else {
      app.disableHardwareAcceleration();
    }
  }

  createWindow() {
    this.windowCreator.init();
  }

  onReady() {
    const readyFunction = async () => {
      checkVersion();
      await localConfig.init();
      const config = await localConfig.getConfig();
      if (!config.perf.common.guide) {
        guide().init();
        config.perf.common.guide = true;
        localConfig.setConfig(config);
      }
      this.createWindow();
      const mainWindow = this.windowCreator.getWindow();
      API.init(mainWindow);
      createTray(mainWindow);
      registerHotKey(mainWindow);
      this.systemPlugins.triggerReadyHooks(
        Object.assign(electron, {
          mainWindow,
          API,
        })
      );
    };
    if (!app.isReady()) {
      app.on('ready', readyFunction);
    } else {
      readyFunction();
    }
  }

  onRunning() {
    app.on('second-instance', (_event, commandLine, workingDirectory) => {
      const files = getSearchFiles(commandLine, workingDirectory);
      const win = this.windowCreator.getWindow();
      if (win) {
        if (win.isMinimized()) {
          win.restore();
        }
        win.focus();
        if (files.length > 0) {
          win.show();
          putFileToRubick(win.webContents, files);
        }
      }
    });
    app.on('activate', () => {
      if (!this.windowCreator.getWindow()) {
        this.createWindow();
      }
    });
  }

  onQuit() {
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('will-quit', () => {
      globalShortcut.unregisterAll();
    });

    if (commonConst.dev()) {
      if (process.platform === 'win32') {
        process.on('message', (data) => {
          if (data === 'graceful-exit') {
            app.quit();
          }
        });
      } else {
        process.on('SIGTERM', () => {
          app.quit();
        });
      }
    }
  }
}

export default new App();
