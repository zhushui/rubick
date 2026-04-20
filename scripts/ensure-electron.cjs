const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function getElectronPackageDir() {
  const electronPackageJson = require.resolve('electron/package.json');
  return path.dirname(electronPackageJson);
}

function getPlatformExecutable() {
  const platform = process.env.npm_config_platform || process.platform;
  switch (platform) {
    case 'darwin':
    case 'mas':
      return path.join('Electron.app', 'Contents', 'MacOS', 'Electron');
    case 'linux':
    case 'freebsd':
    case 'openbsd':
      return 'electron';
    case 'win32':
      return 'electron.exe';
    default:
      throw new Error(`Unsupported Electron platform: ${platform}`);
  }
}

function isElectronInstalled(packageDir) {
  const pathFile = path.join(packageDir, 'path.txt');
  if (!fs.existsSync(pathFile)) {
    return false;
  }

  const executable = fs.readFileSync(pathFile, 'utf8').trim();
  if (!executable) {
    return false;
  }

  const resolvedDist = process.env.ELECTRON_OVERRIDE_DIST_PATH || path.join(packageDir, 'dist');
  const electronBinaryPath = process.env.ELECTRON_OVERRIDE_DIST_PATH
    ? path.join(resolvedDist, executable)
    : path.join(resolvedDist, executable);
  const versionFile = path.join(packageDir, 'dist', 'version');

  return fs.existsSync(electronBinaryPath) && fs.existsSync(versionFile);
}

function ensureElectronBinary() {
  const packageDir = getElectronPackageDir();
  if (isElectronInstalled(packageDir)) {
    return;
  }

  const expectedBinary = getPlatformExecutable();
  console.log(`[ensure-electron] Installing Electron runtime (${expectedBinary})...`);

  const installScript = path.join(packageDir, 'install.js');
  const result = spawnSync(process.execPath, [installScript], {
    cwd: packageDir,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`Electron runtime installation failed with exit code ${result.status ?? 'unknown'}`);
  }

  if (!isElectronInstalled(packageDir)) {
    throw new Error('Electron runtime installation completed, but the binary is still missing.');
  }
}

ensureElectronBinary();
