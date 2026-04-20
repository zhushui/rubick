import {
  globalShortcut,
  nativeTheme,
  BrowserWindow,
  ipcMain,
  app,
  Notification,
} from 'electron';
import screenCapture from '@/core/screen-capture';
import localConfig from '@/main/common/initLocalConfig';
import winPosition from './getWinPosition';
import { registerDoubleModifierShortcut } from './native/uiohook';
import executeJavaScriptSafely from './executeJavaScriptSafely';
import { getAttachedManagedViews } from './managedView';

const registerHotKey = (mainWindow: BrowserWindow): void => {
  const setAutoLogin = async () => {
    const config = await localConfig.getConfig();
    if (app.getLoginItemSettings().openAtLogin !== config.perf.common.start) {
      app.setLoginItemSettings({
        openAtLogin: config.perf.common.start,
        openAsHidden: true,
      });
    }
  };

  const setTheme = async () => {
    executeJavaScriptSafely(
      mainWindow.webContents,
      `window.changeRubickTheme && window.changeRubickTheme()`
    );
    getAttachedManagedViews(mainWindow).forEach((view) => {
      executeJavaScriptSafely(
        view.webContents,
        `window.changeRubickTheme && window.changeRubickTheme()`
      );
    });
  };

  const setDarkMode = async () => {
    const config = await localConfig.getConfig();
    const isDark = config.perf.common.darkMode;
    if (isDark) {
      nativeTheme.themeSource = 'dark';
      executeJavaScriptSafely(
        mainWindow.webContents,
        `window.setRubickThemeMode ? window.setRubickThemeMode("dark") : document.body.classList.add("dark")`
      );
      getAttachedManagedViews(mainWindow).forEach((view) => {
        executeJavaScriptSafely(
          view.webContents,
          `window.setRubickThemeMode ? window.setRubickThemeMode("dark") : document.body.classList.add("dark")`
        );
      });
      return;
    }

    nativeTheme.themeSource = 'light';
    executeJavaScriptSafely(
      mainWindow.webContents,
      `window.setRubickThemeMode ? window.setRubickThemeMode("light") : document.body.classList.remove("dark")`
    );
    getAttachedManagedViews(mainWindow).forEach((view) => {
      executeJavaScriptSafely(
        view.webContents,
        `window.setRubickThemeMode ? window.setRubickThemeMode("light") : document.body.classList.remove("dark")`
      );
    });
  };

  const mainWindowPopUp = () => {
    const currentShow = mainWindow.isVisible() && mainWindow.isFocused();
    if (currentShow) {
      mainWindow.blur();
      mainWindow.hide();
      return;
    }

    const { x: wx, y: wy } = winPosition.getPosition();
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mainWindow.focus();
    mainWindow.setVisibleOnAllWorkspaces(false, {
      visibleOnFullScreen: true,
    });
    mainWindow.setPosition(wx, wy);
    mainWindow.show();
  };

  const init = async () => {
    await setAutoLogin();
    await setDarkMode();
    await setTheme();

    const config = await localConfig.getConfig();
    globalShortcut.unregisterAll();

    const doublePressShortcuts = [
      'Ctrl+Ctrl',
      'Option+Option',
      'Shift+Shift',
      'Command+Command',
    ];
    const isDoublePressShortcut = doublePressShortcuts.includes(
      config.perf.shortCut.showAndHidden
    );

    if (!isDoublePressShortcut) {
      globalShortcut.register(config.perf.shortCut.showAndHidden, () => {
        mainWindowPopUp();
      });
    }

    globalShortcut.register(config.perf.shortCut.capture, () => {
      screenCapture(mainWindow, (data) => {
        if (!data) {
          return;
        }

        new Notification({
          title: '截图完成',
          body: '截图已存储到系统剪贴板中',
        }).show();
      });
    });

    globalShortcut.register(config.perf.shortCut.quit, () => {
      // reserved
    });

    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (
        input.key.toLowerCase() === 'w' &&
        (input.control || input.meta) &&
        !input.alt &&
        !input.shift
      ) {
        event.preventDefault();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.hide();
        }
      }
    });

    config.global.forEach((shortcut) => {
      if (!shortcut.key || !shortcut.value) return;
      globalShortcut.register(shortcut.key, () => {
        mainWindow.webContents.send('global-short-key', shortcut.value);
      });
    });
  };

  registerDoubleModifierShortcut(mainWindowPopUp);
  init();
  ipcMain.on('re-register', () => {
    init();
  });
};

export default registerHotKey;
