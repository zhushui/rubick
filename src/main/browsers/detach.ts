import { BrowserWindow, ipcMain, nativeTheme, screen } from 'electron';
import localConfig from '../common/initLocalConfig';
import commonConst from '@/common/utils/commonConst';
import { WINDOW_MIN_HEIGHT } from '@/common/constans/common';
import { getPreloadPath, getSubAppEntry } from '@/main/common/runtimePaths';
import executeJavaScriptSafely from '@/main/common/executeJavaScriptSafely';
import {
  attachManagedView,
  detachManagedView,
  destroyManagedView,
  enableManagedViewAutoResize,
  ManagedView,
  setManagedViewBounds,
} from '@/main/common/managedView';

export default () => {
  let win: BrowserWindow | undefined;

  const syncViewBounds = (window: BrowserWindow, view: ManagedView) => {
    setManagedViewBounds(window, view, WINDOW_MIN_HEIGHT);
  };

  const init = async (pluginInfo, viewInfo, view: ManagedView) => {
    ipcMain.removeAllListeners('detach:service');
    ipcMain.on('detach:service', async (event, arg: { type: string }) => {
      const data = await operation[arg.type]();
      event.returnValue = data;
    });
    await createWindow(pluginInfo, viewInfo, view);
  };

  const createWindow = async (pluginInfo, viewInfo, view: ManagedView) => {
    let detached = false;
    const cleanupAttachedView = () => {
      if (detached) {
        return;
      }

      detached = true;
      detachManagedView(createWin, view);
    };

    const createWin = new BrowserWindow({
      height: viewInfo.height,
      minHeight: WINDOW_MIN_HEIGHT,
      width: viewInfo.width,
      autoHideMenuBar: true,
      titleBarStyle: 'hidden',
      trafficLightPosition: { x: 12, y: 21 },
      title: pluginInfo.pluginName,
      resizable: true,
      frame: true,
      show: false,
      enableLargerThanScreen: true,
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#1c1c28' : '#fff',
      x: viewInfo.x,
      y: viewInfo.y,
      webPreferences: {
        webSecurity: false,
        backgroundThrottling: false,
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
        devTools: true,
        navigateOnDragDrop: false,
        spellcheck: false,
        preload: getPreloadPath('detach'),
      },
    });
    const loadDetachWindow = createWin.loadURL(getSubAppEntry('detach'));

    createWin.on('close', () => {
      executeHooks('PluginOut', null);
      cleanupAttachedView();
    });
    createWin.on('closed', () => {
      destroyManagedView(view);
      win = undefined;
    });
    createWin.on('focus', () => {
      win = createWin;
      view && win.webContents?.focus();
    });

    createWin.once('ready-to-show', async () => {
      const config = await localConfig.getConfig();
      const darkMode = config.perf.common.darkMode;
      if (darkMode) {
        executeJavaScriptSafely(
          createWin.webContents,
          `window.setRubickThemeMode ? window.setRubickThemeMode('dark') : document.body.classList.add('dark')`
        );
      }
      enableManagedViewAutoResize(view);
      attachManagedView(createWin, view);
      view.inDetach = true;
      syncViewBounds(createWin, view);
      executeJavaScriptSafely(
        createWin.webContents,
        `window.initDetach(${JSON.stringify(pluginInfo)})`
      );
      createWin.show();
    });

    createWin.on('resize', () => {
      syncViewBounds(createWin, view);
    });

    createWin.on('maximize', () => {
      executeJavaScriptSafely(
        createWin.webContents,
        'window.maximizeTrigger()'
      );
      const display = screen.getDisplayMatching(createWin.getBounds());
      view.setBounds({
        x: 0,
        y: WINDOW_MIN_HEIGHT,
        width: display.workArea.width,
        height: display.workArea.height - WINDOW_MIN_HEIGHT,
      });
    });

    createWin.on('unmaximize', () => {
      executeJavaScriptSafely(
        createWin.webContents,
        'window.unmaximizeTrigger()'
      );
      const bounds = createWin.getBounds();
      const display = screen.getDisplayMatching(bounds);
      const width =
        (display.scaleFactor * bounds.width) % 1 === 0
          ? bounds.width
          : bounds.width - 2;
      const height =
        (display.scaleFactor * bounds.height) % 1 === 0
          ? bounds.height
          : bounds.height - 2;
      view.setBounds({
        x: 0,
        y: WINDOW_MIN_HEIGHT,
        width,
        height: height - WINDOW_MIN_HEIGHT,
      });
    });

    createWin.on('page-title-updated', (event) => {
      event.preventDefault();
    });
    createWin.webContents.on(
      'did-fail-load',
      (_event, errorCode, errorDescription, validatedURL) => {
        console.error(
          `[detach-window:load-fail] ${errorCode} ${errorDescription} ${validatedURL}`
        );
      }
    );
    createWin.webContents.once('render-process-gone', () => {
      createWin.close();
    });

    if (commonConst.macOS()) {
      createWin.on('enter-full-screen', () => {
        executeJavaScriptSafely(
          createWin.webContents,
          'window.enterFullScreenTrigger()'
        );
      });
      createWin.on('leave-full-screen', () => {
        executeJavaScriptSafely(
          createWin.webContents,
          'window.leaveFullScreenTrigger()'
        );
      });
    }

    view.webContents.on('before-input-event', (_event, input) => {
      if (input.type !== 'keyDown') return;
      if (!(input.meta || input.control || input.shift || input.alt)) {
        if (input.key === 'Escape') {
          operation.endFullScreen();
        }
      }
    });

    const executeHooks = (hook, data) => {
      if (!view) return;
      const evalJs = `window.rubick?.__dispatchHook?.('${hook}'${
        data ? `, ${JSON.stringify(data)}` : ''
      })`;
      executeJavaScriptSafely(view.webContents, evalJs);
    };
    await loadDetachWindow;
    return createWin;
  };

  const getWindow = () => win;

  const operation = {
    minimize: () => {
      win?.focus();
      win?.minimize();
    },
    maximize: () => {
      if (!win) return;
      win.isMaximized() ? win.unmaximize() : win.maximize();
    },
    close: () => {
      win?.close();
    },
    endFullScreen: () => {
      if (win?.isFullScreen()) {
        win.setFullScreen(false);
      }
    },
  };

  return {
    init,
    getWindow,
  };
};
