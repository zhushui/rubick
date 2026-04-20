import { clipboard, Notification } from 'electron';
import { execFile, exec } from 'child_process';
import platform from '@/common/utils/commonConst';
import { getStaticAssetPath } from '@/main/common/runtimePaths';

export const screenWindow = (cb) => {
  const url = getStaticAssetPath('ScreenCapture.exe');
  const screenWindowProcess = execFile(url);
  screenWindowProcess.on('exit', (code) => {
    if (code) {
      const image = clipboard.readImage();
      cb && cb(image.isEmpty() ? '' : image.toDataURL());
    }
  });
};

export const handleScreenShots = (cb) => {
  exec('screencapture -i -r -c', () => {
    const image = clipboard.readImage();
    cb && cb(image.isEmpty() ? '' : image.toDataURL());
  });
};

export default (_mainWindow, cb) => {
  clipboard.writeText('');
  if (platform.macOS()) {
    handleScreenShots(cb);
  } else if (platform.windows()) {
    screenWindow(cb);
  } else {
    new Notification({
      title: '兼容性支持不足',
      body: 'Linux 系统截图暂不支持，我们会尽快更新。',
    }).show();
  }
};
