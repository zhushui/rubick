const DEFAULT_PLACEHOLDER = '你好，Rubick！请输入插件关键词';

const createDefaultConfigWithLogo = (logo: string) => ({
  version: 7,
  perf: {
    custom: {
      theme: 'SPRING',
      primaryColor: '#ff4ea4',
      errorColor: '#ed6d46',
      warningColor: '#e5a84b',
      successColor: '#c0d695',
      infoColor: '#aa8eeB',
      logo,
      placeholder: DEFAULT_PLACEHOLDER,
      username: 'Rubick',
    },
    shortCut: {
      showAndHidden: 'Option+R',
      separate: 'Ctrl+D',
      quit: 'Shift+Escape',
      capture: 'Ctrl+Shift+A',
    },
    common: {
      start: true,
      space: true,
      hideOnBlur: true,
      autoPast: false,
      darkMode: false,
      guide: false,
      history: true,
      lang: 'zh-CN',
    },
    local: {
      search: true,
    },
  },
  global: [],
});

const normalizeConfig = (config: any, logo: string) => {
  const defaults = createDefaultConfigWithLogo(logo);
  return {
    ...defaults,
    ...config,
    perf: {
      ...defaults.perf,
      ...config?.perf,
      custom: {
        ...defaults.perf.custom,
        ...config?.perf?.custom,
      },
      shortCut: {
        ...defaults.perf.shortCut,
        ...config?.perf?.shortCut,
      },
      common: {
        ...defaults.perf.common,
        ...config?.perf?.common,
      },
      local: {
        ...defaults.perf.local,
        ...config?.perf?.local,
      },
    },
    global: Array.isArray(config?.global) ? config.global : defaults.global,
  };
};

export { DEFAULT_PLACEHOLDER, createDefaultConfigWithLogo, normalizeConfig };
