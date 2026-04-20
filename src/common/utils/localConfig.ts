import path from 'path';
import fs from 'fs';
import getLocalDataFile from './getLocalDataFile';
import { createDefaultConfig } from '../constans/defaultConfig';

const configPath = path.join(getLocalDataFile(), './rubick-config.json');

global.OP_CONFIG = {
  config: null,
  getDefaultConfig() {
    return createDefaultConfig();
  },
  get() {
    const defaultConfigForAnyPlatform = createDefaultConfig();
    try {
      if (!global.OP_CONFIG.config) {
        global.OP_CONFIG.config = JSON.parse(
          fs.readFileSync(configPath, 'utf8') ||
            JSON.stringify(defaultConfigForAnyPlatform)
        );
      }
      // 重置
      if (
        !global.OP_CONFIG.config.version ||
        global.OP_CONFIG.config.version < defaultConfigForAnyPlatform.version
      ) {
        global.OP_CONFIG.config = defaultConfigForAnyPlatform;
        fs.writeFileSync(
          configPath,
          JSON.stringify(defaultConfigForAnyPlatform)
        );
      }
      return global.OP_CONFIG.config;
    } catch (e) {
      global.OP_CONFIG.config = defaultConfigForAnyPlatform;
      return global.OP_CONFIG.config;
    }
  },
  set(value) {
    if (!global.OP_CONFIG.config) {
      global.OP_CONFIG.config = createDefaultConfig();
    }
    global.OP_CONFIG.config = {
      ...global.OP_CONFIG.config,
      ...value,
    };
    fs.writeFileSync(configPath, JSON.stringify(global.OP_CONFIG.config));
  },
};
