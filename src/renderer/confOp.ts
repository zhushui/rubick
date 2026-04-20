import { normalizeConfig } from '@/common/constans/configFactory';

const getFallbackLogo = () => new URL('./assets/logo.png', import.meta.url).href;

const isLocalFileSource = (value: string) =>
  value.startsWith('file://') ||
  value.startsWith('image://') ||
  /^[A-Za-z]:[\\/]/.test(value) ||
  value.startsWith('\\\\') ||
  (!window.rubick.isWindows?.() && value.startsWith('/'));

const toLocalFilePath = (value: string) => {
  let normalized = decodeURIComponent(value);

  if (normalized.startsWith('image://')) {
    normalized = normalized.replace(/^image:\/\//i, '');
  } else if (normalized.startsWith('file://')) {
    normalized = normalized.replace(/^file:\/+/i, '');
  }

  if (!normalized) {
    return '';
  }

  if (window.rubick.isWindows?.()) {
    if (normalized.startsWith('\\\\')) {
      return normalized;
    }
    return normalized.replace(/\//g, '\\');
  }

  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

const resolveLocalFileImage = (value: string, fallbackImage: string) => {
  try {
    const targetPath = toLocalFilePath(value);
    if (
      targetPath &&
      window.rubick.fileExists?.(targetPath) &&
      window.rubick.readFileAsDataUrl
    ) {
      return window.rubick.readFileAsDataUrl(targetPath);
    }
  } catch (error) {
    console.error('[rubick-renderer:image:file]', error);
  }

  return fallbackImage;
};

const resolveRendererImage = (
  value: unknown,
  fallbackImage = getFallbackLogo()
) => {
  if (typeof value !== 'string' || !value) {
    return fallbackImage;
  }

  if (
    value.startsWith('data:') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('blob:')
  ) {
    return value;
  }

  if (isLocalFileSource(value)) {
    return resolveLocalFileImage(value, fallbackImage);
  }

  return value;
};

const getSafeConfig = (config?: any) => {
  const fallbackLogo = getFallbackLogo();
  const nextConfig = normalizeConfig(config, fallbackLogo);
  nextConfig.perf.custom.logo = resolveRendererImage(
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
      console.error('[rubick-renderer:config:get]', error);
      return getSafeConfig();
    }
  },

  setConfig(data) {
    try {
      const currentConfig = getSafeConfig(window.rubick.getLocalConfig?.());
      return window.rubick.setLocalConfig?.({
        ...currentConfig,
        ...data,
        perf: {
          ...currentConfig.perf,
          ...data?.perf,
        },
      });
    } catch (error) {
      console.error('[rubick-renderer:config:set]', error);
      return undefined;
    }
  },
};

export { resolveRendererImage };
export default localConfig;
