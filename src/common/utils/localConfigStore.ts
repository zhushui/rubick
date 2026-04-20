import fs from 'fs';
import path from 'path';
import { createDefaultConfig } from '@/common/constans/defaultConfig';
import { normalizeConfig } from '@/common/constans/configFactory';
import getLocalDataFile from './getLocalDataFile';

const configPath = path.join(getLocalDataFile(), 'rubick-config.json');

const getDefaultLogo = () => createDefaultConfig().perf.custom.logo;

const mergeConfig = (currentConfig: any, nextConfig: any) =>
  normalizeConfig(
    {
      ...currentConfig,
      ...nextConfig,
      perf: {
        ...currentConfig?.perf,
        ...nextConfig?.perf,
        custom: {
          ...currentConfig?.perf?.custom,
          ...nextConfig?.perf?.custom,
        },
        shortCut: {
          ...currentConfig?.perf?.shortCut,
          ...nextConfig?.perf?.shortCut,
        },
        common: {
          ...currentConfig?.perf?.common,
          ...nextConfig?.perf?.common,
        },
        local: {
          ...currentConfig?.perf?.local,
          ...nextConfig?.perf?.local,
        },
      },
      global: Array.isArray(nextConfig?.global)
        ? nextConfig.global
        : currentConfig?.global,
    },
    currentConfig?.perf?.custom?.logo || getDefaultLogo()
  );

const readConfig = () => {
  const defaultConfig = createDefaultConfig();
  try {
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig));
      return defaultConfig;
    }

    const fileContent = fs.readFileSync(configPath, 'utf8');
    const parsedConfig = fileContent ? JSON.parse(fileContent) : {};
    return mergeConfig(defaultConfig, parsedConfig);
  } catch {
    return defaultConfig;
  }
};

const writeConfig = (config: any) => {
  fs.writeFileSync(configPath, JSON.stringify(config));
  return config;
};

const initConfigStore = () => {
  const config = readConfig();
  return writeConfig(config);
};

const getConfigStore = () => readConfig();

const setConfigStore = (config: any) => {
  const currentConfig = readConfig();
  const nextConfig = mergeConfig(currentConfig, config);
  return writeConfig(nextConfig);
};

export { initConfigStore, getConfigStore, setConfigStore, configPath };
