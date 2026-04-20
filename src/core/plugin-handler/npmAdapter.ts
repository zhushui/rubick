import fs from 'fs-extra';
import path from 'path';
import spawn from 'cross-spawn';

const MINIMUM_PLUGIN_NODE_VERSION = '>=20';
const PLUGIN_INSTALLER_PACKAGE_MANAGER = 'npm@10.9.4';

const getPluginWorkspaceManifest = (existingManifest: Record<string, any> = {}) => ({
  private: true,
  ...existingManifest,
  packageManager: PLUGIN_INSTALLER_PACKAGE_MANAGER,
  engines: {
    ...(existingManifest.engines || {}),
    node: MINIMUM_PLUGIN_NODE_VERSION,
  },
  volta: {
    ...(existingManifest.volta || {}),
    node: process.versions.node,
  },
  dependencies: existingManifest.dependencies || {},
});

const ensurePluginWorkspaceManifest = (baseDir: string) => {
  fs.mkdirsSync(baseDir);
  const manifestPath = path.join(baseDir, 'package.json');
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : {};
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(getPluginWorkspaceManifest(manifest), null, 2)
  );
};

const resolveBundledNpmCli = () => {
  try {
    return require.resolve('npm/bin/npm-cli.js');
  } catch {
    return null;
  }
};

const createPluginInstaller = (args: string[], cwd: string) => {
  const npmCliPath = resolveBundledNpmCli();
  if (npmCliPath) {
    return spawn(process.execPath, [npmCliPath, ...args], {
      cwd,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
      },
    });
  }

  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return spawn(command, args, {
    cwd,
    env: process.env,
  });
};

export {
  MINIMUM_PLUGIN_NODE_VERSION,
  PLUGIN_INSTALLER_PACKAGE_MANAGER,
  ensurePluginWorkspaceManifest,
  createPluginInstaller,
};
