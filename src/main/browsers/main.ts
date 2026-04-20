import { BrowserWindow, nativeTheme } from 'electron';
import localConfig from '@/main/common/initLocalConfig';
import {
  WINDOW_HEIGHT,
  WINDOW_MIN_HEIGHT,
  WINDOW_WIDTH,
} from '@/common/constans/common';
import {
  getPreloadPath,
  getRendererEntry,
} from '@/main/common/runtimePaths';
import executeJavaScriptSafely from '@/main/common/executeJavaScriptSafely';
import commonConst from '@/common/utils/commonConst';
import { hasManagedView } from '@/main/common/managedView';

export default () => {
  let win: BrowserWindow | undefined;

  const init = () => {
    createWindow();
  };

  const createWindow = async () => {
    win = new BrowserWindow({
      height: WINDOW_HEIGHT,
      minHeight: WINDOW_MIN_HEIGHT,
      useContentSize: true,
      resizable: true,
      width: WINDOW_WIDTH,
      frame: false,
      title: 'rubick',
      show: false,
      skipTaskbar: true,
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#1c1c28' : '#fff',
      webPreferences: {
        webSecurity: true,
        backgroundThrottling: false,
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
        preload: getPreloadPath('main'),
        spellcheck: false,
      },
    });
    win.setMaxListeners(30);

    if (commonConst.dev()) {
      win.webContents.on(
        'did-fail-load',
        (_event, errorCode, errorDescription, validatedURL) => {
          console.error(
            `[main-renderer:load-fail] ${errorCode} ${errorDescription} ${validatedURL}`
          );
        }
      );
      win.webContents.on(
        'render-process-gone',
        (_event, details) => {
          console.error('[main-renderer:gone]', details);
        }
      );
    }

    await win.loadURL(getRendererEntry());

    win.on('closed', () => {
      win = undefined;
    });

    win.on('show', () => {
      executeJavaScriptSafely(
        win?.webContents,
        `window.rubick?.__dispatchHook?.('Show')`
      );
    });

    win.on('hide', () => {
      executeJavaScriptSafely(
        win?.webContents,
        `window.rubick?.__dispatchHook?.('Hide')`
      );
    });

    win.on('blur', async () => {
      if (win && hasManagedView(win)) {
        return;
      }

      const config = await localConfig.getConfig();
      if (config.perf.common.hideOnBlur) {
        win?.hide();
      }
    });
  };

  const getWindow = () => win as BrowserWindow;

  return {
    init,
    getWindow,
  };
};
