import path from 'path';
import fs from 'fs';

const homeDir = process.env.HOME || '';
const desktopSession = String(process.env.DESKTOP_SESSION || '').toLowerCase();

const appPaths = [
  '/usr/share/applications',
  '/var/lib/snapd/desktop/applications',
  `${homeDir}/.local/share/applications`,
];
const emptyIcon = '';

function dirAppRead(dir, target) {
  let files: Array<string> | null = null;
  try {
    if (!fs.existsSync(dir)) return;
    files = fs.readdirSync(dir);
  } catch {
    return;
  }
  if (files.length !== 0) {
    for (const file of files) {
      const app = path.join(dir, file);
      if (path.extname(app) === '.desktop') {
        target.push(app);
      }
    }
  }
}

function convertEntryFile2Feature(appPath) {
  let appInfo: any = null;
  try {
    appInfo = fs.readFileSync(appPath, 'utf8');
  } catch {
    return null;
  }
  if (!appInfo.includes('[Desktop Entry]')) {
    return null;
  }
  appInfo = appInfo
    .substr(appInfo.indexOf('[Desktop Entry]'))
    .replace('[Desktop Entry]', '')
    .trim();

  const splitIndex = appInfo.indexOf('\n[');
  if (splitIndex > 0) {
    appInfo = appInfo.substr(0, splitIndex).trim();
  }

  const targetAppInfo: any = {};
  appInfo.match(/^[\w\-[\]]+ ?=.*$/gm)?.forEach((entry) => {
    const index = entry.indexOf('=');
    targetAppInfo[entry.substr(0, index).trim()] = entry
      .substr(index + 1)
      .trim();
  });

  if (targetAppInfo.Type !== 'Application') {
    return null;
  }
  if (!targetAppInfo.Exec) {
    return null;
  }
  if (
    targetAppInfo.NoDisplay === 'true' &&
    !targetAppInfo.Exec.startsWith('gnome-control-center')
  ) {
    return null;
  }

  let currentDesktop = desktopSession;
  if (currentDesktop === 'ubuntu') {
    currentDesktop = 'gnome';
    if (
      targetAppInfo.OnlyShowIn &&
      !targetAppInfo.OnlyShowIn.toLowerCase().includes(currentDesktop)
    ) {
      return null;
    }
  }
  if (
    targetAppInfo.NotShowIn &&
    targetAppInfo.NotShowIn.toLowerCase().includes(currentDesktop)
  ) {
    return null;
  }

  let icon = targetAppInfo.Icon;
  if (!icon) return null;
  if (icon.startsWith('/')) {
    if (!fs.existsSync(icon)) return null;
  } else if (
    appPath.startsWith('/usr/share/applications') ||
    appPath.startsWith('/var/lib/snapd/desktop/applications')
  ) {
    icon = getIcon(icon);
  } else {
    if (!appPath.startsWith(`${homeDir}/.local/share/applications`)) {
      return null;
    }
    appPath = path.join(homeDir, '.local/share/icons', `${appPath}.png`);
    if (!fs.existsSync(appPath)) {
      appPath = emptyIcon;
    }
  }

  let desc = '';
  const lang = String(process.env.LANG || 'en_US.UTF-8').split('.')[0];
  if (`Comment[${lang}]` in targetAppInfo) {
    desc = targetAppInfo[`Comment[${lang}]`];
  } else if (targetAppInfo.Comment) {
    desc = targetAppInfo.Comment;
  } else {
    desc = appPath;
  }

  let execPath = targetAppInfo.Exec.replace(/ %[A-Za-z]/g, '')
    .replace(/"/g, '')
    .trim();
  if (targetAppInfo.Terminal === 'true') {
    execPath = `gnome-terminal -x ${execPath}`;
  }

  const info = {
    value: 'plugin',
    pluginType: 'app',
    desc,
    icon: `file://${icon}`,
    keyWords: [targetAppInfo.Name],
    action: execPath,
  };

  if ('X-Ubuntu-Gettext-Domain' in targetAppInfo) {
    const cmd = targetAppInfo['X-Ubuntu-Gettext-Domain'];
    if (cmd && cmd !== targetAppInfo.Name) {
      info.keyWords.push(cmd);
    }
  }
  return info;
}

function getIcon(filePath) {
  const themes = [
    'ubuntu-mono-dark',
    'ubuntu-mono-light',
    'Yaru',
    'hicolor',
    'Adwaita',
    'Humanity',
  ];

  const sizes = ['48x48', '48', 'scalable', '256x256', '512x512', '256', '512'];
  const types = [
    'apps',
    'categories',
    'devices',
    'mimetypes',
    'legacy',
    'actions',
    'places',
    'status',
    'mimes',
  ];
  const exts = ['.png', '.svg'];
  for (const theme of themes) {
    for (const size of sizes) {
      for (const type of types) {
        for (const ext of exts) {
          let iconPath = path.join(
            '/usr/share/icons',
            theme,
            size,
            type,
            filePath + ext
          );
          if (fs.existsSync(iconPath)) return iconPath;
          iconPath = path.join(
            '/usr/share/icons',
            theme,
            type,
            size,
            filePath + ext
          );
          if (fs.existsSync(iconPath)) return iconPath;
        }
      }
    }
  }
  return fs.existsSync(path.join('/usr/share/pixmaps', `${filePath}.png`))
    ? path.join('/usr/share/pixmaps', `${filePath}.png`)
    : emptyIcon;
}

export default () => {
  const apps: any[] = [];
  const fileList: string[] = [];
  appPaths.forEach((dir) => {
    dirAppRead(dir, fileList);
  });

  fileList.forEach((file) => {
    apps.push(convertEntryFile2Feature(file));
  });
  return apps.filter((app) => !!app);
};
