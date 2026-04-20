import path from 'path';
import fs from 'fs';
import { PLUGIN_INSTALL_DIR } from '@/common/constans/main';

export default () => {
  const totalPlugins = global.LOCAL_PLUGINS.getLocalPlugins();
  let systemPlugins = totalPlugins.filter(
    (plugin) => plugin.pluginType === 'system'
  );
  systemPlugins = systemPlugins
    .map((plugin) => {
      try {
        const pluginPath = path.resolve(
          PLUGIN_INSTALL_DIR,
          'node_modules',
          plugin.name
        );
        return {
          ...plugin,
          indexPath: path.join(pluginPath, './', plugin.entry),
        };
      } catch {
        return false;
      }
    })
    .filter(Boolean);

  const hooks = {
    onReady: [],
  };

  systemPlugins.forEach((plugin) => {
    if (fs.existsSync(plugin.indexPath)) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pluginModule = require(plugin.indexPath)();
      hooks.onReady.push(pluginModule.onReady);
    }
  });

  const triggerReadyHooks = (ctx) => {
    hooks.onReady.forEach((hook: any) => {
      try {
        hook && hook(ctx);
      } catch (error) {
        console.log(error);
      }
    });
  };

  return {
    triggerReadyHooks,
  };
};
