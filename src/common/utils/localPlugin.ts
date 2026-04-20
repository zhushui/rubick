import path from 'path';
import fs from 'fs';
import { PluginHandler } from '@/core';
import { PLUGIN_INSTALL_DIR as baseDir } from '@/common/constans/main';
import API from '@/main/common/api';

const configPath = path.join(baseDir, './rubick-local-plugin.json');

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
    if (plugin.isDev) {
      const pluginPath = path.resolve(baseDir, 'node_modules', plugin.name);
      const pluginInfo = JSON.parse(
        fs.readFileSync(path.join(pluginPath, './package.json'), 'utf8')
      );
      plugin = {
        ...plugin,
        ...pluginInfo,
      };
    }
    global.LOCAL_PLUGINS.addPlugin(plugin);
    return true;
  },
  refreshPlugin(plugin) {
    const pluginPath = path.resolve(baseDir, 'node_modules', plugin.name);
    const pluginInfo = JSON.parse(
      fs.readFileSync(path.join(pluginPath, './package.json'), 'utf8')
    );
    plugin = {
      ...plugin,
      ...pluginInfo,
    };
    let currentPlugins = global.LOCAL_PLUGINS.getLocalPlugins();

    currentPlugins = currentPlugins.map((p) => {
      if (p.name === plugin.name) {
        return plugin;
      }
      return p;
    });

    global.LOCAL_PLUGINS.PLUGINS = currentPlugins;
    fs.writeFileSync(configPath, JSON.stringify(currentPlugins));
    return true;
  },
  getLocalPlugins() {
    try {
      if (!global.LOCAL_PLUGINS.PLUGINS.length) {
        global.LOCAL_PLUGINS.PLUGINS = JSON.parse(
          fs.readFileSync(configPath, 'utf-8')
        );
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
      global.LOCAL_PLUGINS.PLUGINS = currentPlugins;
      fs.writeFileSync(configPath, JSON.stringify(currentPlugins));
    }
  },
  updatePlugin(plugin) {
    global.LOCAL_PLUGINS.PLUGINS = global.LOCAL_PLUGINS.PLUGINS.map(
      (origin) => {
        if (origin.name === plugin.name) {
          return plugin;
        }
        return origin;
      }
    );
    fs.writeFileSync(configPath, JSON.stringify(global.LOCAL_PLUGINS.PLUGINS));
  },
  async deletePlugin(plugin) {
    const pluginInstance = await getPluginInstance();
    await pluginInstance.uninstall([plugin.name], { isDev: plugin.isDev });
    global.LOCAL_PLUGINS.PLUGINS = global.LOCAL_PLUGINS.PLUGINS.filter(
      (p) => plugin.name !== p.name
    );
    fs.writeFileSync(configPath, JSON.stringify(global.LOCAL_PLUGINS.PLUGINS));
    return true;
  },
};
