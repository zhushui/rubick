import path from 'path';
import fs from 'fs';
import { PluginHandler } from '@/core';
import { PLUGIN_INSTALL_DIR as baseDir } from '@/common/constans/main';
import API from '@/main/common/api';

const configPath = path.join(baseDir, './rubick-local-plugin.json');
const manifestDecoders = ['utf-8', 'gbk', 'utf-16le'];
const getInstalledPluginPath = (pluginName) =>
  path.resolve(baseDir, 'node_modules', pluginName || '');

const readPluginManifest = (pluginPath) => {
  const manifestPath = path.join(pluginPath, './package.json');
  const raw = fs.readFileSync(manifestPath);

  let lastError = null;
  for (const encoding of manifestDecoders) {
    try {
      const text = new TextDecoder(encoding, {
        fatal: encoding !== 'gbk',
      })
        .decode(raw)
        .replace(/^\uFEFF/, '');
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error(`Unable to parse plugin manifest: ${manifestPath}`);
};

const resolveInstalledPluginInfo = (plugin) => {
  const pluginPath = getInstalledPluginPath(plugin?.name);
  const manifestPath = path.join(pluginPath, './package.json');

  if (!plugin?.name || !fs.existsSync(manifestPath)) {
    return null;
  }

  const pluginInfo = readPluginManifest(pluginPath);
  return {
    ...plugin,
    ...pluginInfo,
    name: pluginInfo?.name || plugin.name,
  };
};

const ensureInstalledPluginInfo = (plugin, action = 'install') => {
  const installedPlugin = resolveInstalledPluginInfo(plugin);

  if (installedPlugin) {
    return installedPlugin;
  }

  const pluginLabel = plugin?.pluginName || plugin?.name || 'plugin';
  throw new Error(
    `${pluginLabel} ${action}ed but no valid local package was found; skipped writing the installed record`
  );
};

const persistLocalPlugins = (plugins) => {
  global.LOCAL_PLUGINS.PLUGINS = plugins;
  fs.writeFileSync(configPath, JSON.stringify(plugins));
  return plugins;
};

let pluginInstancePromise: Promise<PluginHandler> | null = null;

const createPluginInstance = async () => {
  try {
    const res = await API.dbGet({
      data: {
        id: 'rubick-localhost-config',
      },
    });

    return new PluginHandler({
      baseDir,
      registry: res?.data?.register,
    });
  } catch {
    return new PluginHandler({
      baseDir,
    });
  }
};

const getPluginInstance = async () => {
  if (!pluginInstancePromise) {
    pluginInstancePromise = createPluginInstance().catch((error) => {
      pluginInstancePromise = null;
      throw error;
    });
  }

  return pluginInstancePromise;
};

global.LOCAL_PLUGINS = {
  PLUGINS: [],
  async downloadPlugin(plugin) {
    const pluginInstance = await getPluginInstance();
    await pluginInstance.install([plugin.name], { isDev: plugin.isDev });
    const installedPlugin = ensureInstalledPluginInfo(plugin, 'install');
    global.LOCAL_PLUGINS.addPlugin(installedPlugin);
    return true;
  },
  refreshPlugin(plugin) {
    let currentPlugins = global.LOCAL_PLUGINS.getLocalPlugins();
    const installedPlugin = resolveInstalledPluginInfo(plugin);

    if (!installedPlugin) {
      persistLocalPlugins(
        currentPlugins.filter((origin) => origin.name !== plugin?.name)
      );
      return false;
    }

    currentPlugins = currentPlugins.map((p) => {
      if (p.name === installedPlugin.name) {
        return installedPlugin;
      }
      return p;
    });

    persistLocalPlugins(currentPlugins);
    return true;
  },
  getLocalPlugins() {
    try {
      if (!global.LOCAL_PLUGINS.PLUGINS.length) {
        const cachedPlugins = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const normalizedPlugins = Array.isArray(cachedPlugins)
          ? cachedPlugins
              .map((plugin) => resolveInstalledPluginInfo(plugin))
              .filter(Boolean)
          : [];
        persistLocalPlugins(normalizedPlugins);
      }
      return global.LOCAL_PLUGINS.PLUGINS;
    } catch {
      global.LOCAL_PLUGINS.PLUGINS = [];
      return global.LOCAL_PLUGINS.PLUGINS;
    }
  },
  addPlugin(plugin) {
    let has = false;
    const currentPlugins = global.LOCAL_PLUGINS.getLocalPlugins();
    currentPlugins.some((p) => {
      has = p.name === plugin.name;
      return has;
    });
    if (!has) {
      currentPlugins.unshift(plugin);
      persistLocalPlugins(currentPlugins);
    }
  },
  updatePlugin(plugin) {
    persistLocalPlugins(
      global.LOCAL_PLUGINS.PLUGINS.map((origin) => {
        if (origin.name === plugin.name) {
          return resolveInstalledPluginInfo(plugin) || origin;
        }
        return origin;
      })
    );
  },
  async deletePlugin(plugin) {
    const pluginInstance = await getPluginInstance();
    await pluginInstance.uninstall([plugin.name], { isDev: plugin.isDev });
    persistLocalPlugins(
      global.LOCAL_PLUGINS.PLUGINS.filter((p) => plugin.name !== p.name)
    );
    return true;
  },
};
