import fs from 'fs-extra';
import path from 'path';
import spawn from 'cross-spawn';

const MINIMUM_PLUGIN_NODE_VERSION = '>=20';
const PLUGIN_INSTALLER_PACKAGE_MANAGER = 'npm@10.9.4';
const REPAIRABLE_TEXT_ASSET_EXTENSIONS = new Set(['.pug', '.html', '.txt']);
const SOURCE_FILE_EXTENSIONS = new Set(['.js', '.cjs', '.mjs']);
const MAX_SCANNED_SOURCE_SIZE = 512 * 1024;
const RELATIVE_TEXT_ASSET_PATTERN =
  /['"`]((?:\.\.?[\\/][^'"`\r\n]+?\.(?:pug|html|txt)))['"`]/g;

const buildMissingTextAssetPlaceholder = (
  extname: string,
  targetPath: string
) => {
  const fileLabel = path.basename(targetPath);

  if (extname === '.pug') {
    return `doctype html
html
  head
    meta(charset='utf-8')
    title ${fileLabel}
    style.
      body { font-family: Arial, sans-serif; padding: 24px; line-height: 1.5; }
      pre { white-space: pre-wrap; word-break: break-word; background: #f5f5f5; padding: 12px; border-radius: 8px; }
  body
    h1 ${fileLabel}
    if title && title !== '${fileLabel}'
      p Title: #{title}
    if url
      p URL: #{url}
    if explain
      p!= explain
    if error && error.message
      p Message: #{error.message}
    if errorStack && errorStack.length
      pre= errorStack.join('\\n')
    if code
      pre= code
`;
  }

  if (extname === '.html') {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${fileLabel}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; line-height: 1.5; }
      pre { white-space: pre-wrap; word-break: break-word; background: #f5f5f5; padding: 12px; border-radius: 8px; }
    </style>
  </head>
  <body>
    <h1>${fileLabel}</h1>
    <p>This asset was restored by the plugin workspace integrity repair.</p>
  </body>
</html>
`;
  }

  return `${fileLabel}\nThis asset was restored by the plugin workspace integrity repair.\n`;
};

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

const getPackageDirectories = (baseDir: string) => {
  const modulesDir = path.join(baseDir, 'node_modules');
  if (!fs.existsSync(modulesDir)) {
    return [];
  }

  return fs
    .readdirSync(modulesDir, { withFileTypes: true })
    .flatMap((entry) => {
      if (!entry.isDirectory()) {
        return [];
      }

      const entryPath = path.join(modulesDir, entry.name);
      if (entry.name.startsWith('@')) {
        return fs
          .readdirSync(entryPath, { withFileTypes: true })
          .filter((child) => child.isDirectory())
          .map((child) => path.join(entryPath, child.name));
      }

      return [entryPath];
    })
    .filter((packageDir) =>
      fs.existsSync(path.join(packageDir, 'package.json'))
    );
};

const isInsideDirectory = (targetPath: string, rootDir: string) => {
  const relativePath = path.relative(rootDir, targetPath);
  return !!relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
};

const collectPackageSourceFiles = (packageDir: string) => {
  const pendingDirs = [packageDir];
  const sourceFiles: string[] = [];

  while (pendingDirs.length) {
    const currentDir = pendingDirs.pop();
    if (!currentDir) {
      continue;
    }

    fs.readdirSync(currentDir, { withFileTypes: true }).forEach((entry) => {
      const entryPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
          return;
        }

        pendingDirs.push(entryPath);
        return;
      }

      if (!SOURCE_FILE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        return;
      }

      try {
        const stats = fs.statSync(entryPath);
        if (stats.size <= MAX_SCANNED_SOURCE_SIZE) {
          sourceFiles.push(entryPath);
        }
      } catch {
        // ignore files that disappear during scanning
      }
    });
  }

  return sourceFiles;
};

const repairMissingPackageTextAssets = (baseDir: string) => {
  const packageDirs = getPackageDirectories(baseDir);

  packageDirs.forEach((packageDir) => {
    const missingAssets = new Map<string, string>();

    collectPackageSourceFiles(packageDir).forEach((sourceFile) => {
      let sourceContent = '';

      try {
        sourceContent = fs.readFileSync(sourceFile, 'utf8');
      } catch {
        return;
      }

      for (const match of sourceContent.matchAll(RELATIVE_TEXT_ASSET_PATTERN)) {
        const relativeAssetPath = match[1];
        const extname = path.extname(relativeAssetPath).toLowerCase();
        if (!REPAIRABLE_TEXT_ASSET_EXTENSIONS.has(extname)) {
          continue;
        }

        const targetPath = path.resolve(path.dirname(sourceFile), relativeAssetPath);
        if (!isInsideDirectory(targetPath, packageDir) || fs.existsSync(targetPath)) {
          continue;
        }

        missingAssets.set(targetPath, extname);
      }
    });

    missingAssets.forEach((extname, targetPath) => {
      fs.mkdirsSync(path.dirname(targetPath));
      if (!fs.existsSync(targetPath)) {
        fs.writeFileSync(
          targetPath,
          buildMissingTextAssetPlaceholder(extname, targetPath),
          'utf8'
        );
      }
    });
  });
};

const repairPluginWorkspacePackages = (baseDir: string) => {
  ensurePluginWorkspaceManifest(baseDir);
  repairMissingPackageTextAssets(baseDir);
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
  repairPluginWorkspacePackages,
};
