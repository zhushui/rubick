import { BrowserWindow, ipcMain, nativeTheme, screen } from 'electron';
import {
  GUIDE_WIDTH,
  WINDOW_MIN_HEIGHT,
  GUIDE_HEIGHT,
} from '@/common/constans/common';
import { getPreloadPath, getSubAppEntry } from '@/main/common/runtimePaths';

const getWindowPos = (width: number, height: number) => {
  const screenPoint = screen.getCursorScreenPoint();
  const displayPoint = screen.getDisplayNearestPoint(screenPoint);
  return [
    displayPoint.bounds.x + Math.round((displayPoint.bounds.width - width) / 2),
    displayPoint.bounds.y +
      Math.round((displayPoint.bounds.height - height) / 2),
  ];
};

let win: BrowserWindow | null = null;

export default () => {
  const init = () => {
    if (win) return;
    ipcMain.on('guide:service', async (event, arg: { type: string }) => {
      const data = await operation[arg.type]();
      event.returnValue = data;
    });
    createWindow();
  };

  const createWindow = async () => {
    const [x, y] = getWindowPos(800, 600);
    win = new BrowserWindow({
      show: false,
      alwaysOnTop: true,
      resizable: false,
      fullscreenable: false,
      minimizable: false,
      maximizable: false,
      skipTaskbar: true,
      autoHideMenuBar: true,
      frame: false,
      enableLargerThanScreen: true,
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#1c1c28' : '#fff',
      x,
      y,
      width: GUIDE_WIDTH,
      height: GUIDE_HEIGHT,
      minHeight: WINDOW_MIN_HEIGHT,
      webPreferences: {
        webSecurity: false,
        backgroundThrottling: false,
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
        preload: getPreloadPath('guide'),
        spellcheck: false,
      },
    });

    await win.loadURL(getSubAppEntry('guide'));

    win.on('closed', () => {
      win = null;
    });

    win.once('ready-to-show', () => {
      win?.show();
    });
  };

  const getWindow = () => win as BrowserWindow;

  const operation = {
    close: () => {
      win?.close();
      win = null;
    },
  };

  return {
    init,
    getWindow,
  };
};
