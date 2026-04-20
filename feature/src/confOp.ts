import { normalizeConfig } from '../../src/common/constans/configFactory';

const LOCAL_CONFIG_CHANGE_EVENT = 'rubick-local-config-change';

const getFallbackLogo = () => new URL('./assets/logo.png', import.meta.url).href;

const toLocalFilePath = (logo: string) => {
  const normalized = decodeURIComponent(logo).replace(/^file:\/+/i, '');
  if (!normalized) {
    return '';
  }

  if (window.rubick.isWindows?.()) {
    return normalized.replace(/\//g, '\\');
  }

  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

const resolveLocalFileLogo = (logo: string, fallbackLogo: string) => {
  try {
    const targetPath = toLocalFilePath(logo);
    if (
      targetPath &&
      window.rubick.fileExists?.(targetPath) &&
      window.rubick.readFileAsDataUrl
    ) {
      return window.rubick.readFileAsDataUrl(targetPath);
    }
  } catch (error) {
    console.error('[feature-renderer:logo:file]', error);
  }

  return fallbackLogo;
};

const resolveRendererLogo = (
  logo: unknown,
  fallbackLogo = getFallbackLogo()
) => {
  if (typeof logo === 'string' && logo.startsWith('file://')) {
    return resolveLocalFileLogo(logo, fallbackLogo);
  }

  return typeof logo === 'string' && logo ? logo : fallbackLogo;
};

const getSafeConfig = (config?: any) => {
  const fallbackLogo = getFallbackLogo();
  const nextConfig = normalizeConfig(config, fallbackLogo);
  nextConfig.perf.custom.logo = resolveRendererLogo(
    nextConfig?.perf?.custom?.logo,
    fallbackLogo
  );
  return nextConfig;
};

const localConfig = {
  getConfig(): any {
    try {
      return getSafeConfig(window.rubick.getLocalConfig?.());
    } catch (error) {
      console.error('[feature-renderer:config:get]', error);
      return getSafeConfig();
    }
  },

  setConfig(data: any) {
    try {
      const currentConfig = getSafeConfig(window.rubick.getLocalConfig?.());
      const nextConfig = {
        ...currentConfig,
        ...data,
        perf: {
          ...currentConfig.perf,
          ...data?.perf,
        },
      };

      const result = window.rubick.setLocalConfig?.(nextConfig);
      window.dispatchEvent(
        new CustomEvent(LOCAL_CONFIG_CHANGE_EVENT, {
          detail: getSafeConfig(nextConfig),
        })
      );
      window.changeRubickTheme?.();
      return result;
    } catch (error) {
      console.error('[feature-renderer:config:set]', error);
      return undefined;
    }
  },
};

export { LOCAL_CONFIG_CHANGE_EVENT, resolveRendererLogo };
export default localConfig;
