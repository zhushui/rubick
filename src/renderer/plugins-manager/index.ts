import { reactive, toRefs, ref } from 'vue';
import searchManager from './search';
import optionsManager from './options';
import { PLUGIN_HISTORY } from '@/common/constans/renderer';
import { message } from 'ant-design-vue';

const getHistoryKey = (plugin: any) => {
  const canonicalName = plugin.originName || plugin.name || '';

  if (plugin.pluginType === 'app') {
    return ['app', canonicalName, plugin.desc || plugin.action || '']
      .filter(Boolean)
      .join(':');
  }

  return [
    'plugin',
    canonicalName,
    plugin.feature?.code || plugin.ext?.code || '',
    typeof plugin.cmd === 'string'
      ? plugin.cmd
      : plugin.cmd?.label || plugin.displayName || '',
  ]
    .filter(Boolean)
    .join(':');
};

const normalizeHistoryItem = (plugin: any) => {
  const canonicalName = plugin.originName || plugin.name || '';
  const normalizedPlugin = {
    ...plugin,
    name: canonicalName,
    originName: canonicalName,
    displayName:
      plugin.displayName ||
      plugin.cmd ||
      plugin.pluginName ||
      plugin._name ||
      plugin.name ||
      canonicalName,
  };

  normalizedPlugin.historyKey =
    plugin.historyKey || getHistoryKey(normalizedPlugin);

  return normalizedPlugin;
};

const createPluginManager = (): any => {
  const state: any = reactive({
    appList: [],
    plugins: [],
    localPlugins: [],
    currentPlugin: {},
    pluginLoading: false,
    pluginHistory: [],
  });

  const appList: any = ref([]);

  const loadPluginHistory = async () => {
    const cachedHistory = window.rubick.dbStorage.getItem(PLUGIN_HISTORY);
    if (Array.isArray(cachedHistory)) {
      state.pluginHistory = cachedHistory.map(normalizeHistoryItem);
      window.rubick.dbStorage.setItem(PLUGIN_HISTORY, state.pluginHistory);
      void persistPluginHistory();
      return;
    }

    try {
      const result = (await window.rubick.db.get(PLUGIN_HISTORY)) || {};
      if (Array.isArray(result?.data)) {
        state.pluginHistory = result.data.map(normalizeHistoryItem);
        window.rubick.dbStorage.setItem(PLUGIN_HISTORY, state.pluginHistory);
        void persistPluginHistory();
      }
    } catch (error) {
      console.error('[rubick-renderer:plugin-history:migrate]', error);
    }
  };

  const persistPluginHistory = async () => {
    const history = JSON.parse(JSON.stringify(state.pluginHistory));
    window.rubick.dbStorage.setItem(PLUGIN_HISTORY, history);

    try {
      const result = (await window.rubick.db.get(PLUGIN_HISTORY)) || {};
      await window.rubick.db.put({
        _id: PLUGIN_HISTORY,
        _rev: result?._rev,
        data: history,
      });
    } catch (error) {
      console.error('[rubick-renderer:plugin-history:save]', error);
    }
  };

  const initPlugins = async () => {
    try {
      await initPluginHistory();
      appList.value = window.rubick.internal.getAppList() || [];
      initLocalStartPlugin();
    } catch (error) {
      console.error('[rubick-renderer:init-plugins]', error);
      appList.value = [];
    }
  };

  const initPluginHistory = async () => {
    try {
      await loadPluginHistory();
    } catch (error) {
      console.error('[rubick-renderer:plugin-history]', error);
    }
  };

  const initLocalStartPlugin = () => {
    try {
      const result = window.rubick.dbStorage.getItem('rubick-local-start-app');
      if (result) {
        appList.value.push(...result);
        return;
      }

      void window.rubick.db.get('rubick-local-start-app').then((dbResult) => {
        if (Array.isArray(dbResult?.value)) {
          window.rubick.dbStorage.setItem(
            'rubick-local-start-app',
            dbResult.value
          );
          appList.value.push(...dbResult.value);
        }
      });
    } catch (error) {
      console.error('[rubick-renderer:local-start]', error);
    }
  };

  window.removeLocalStartPlugin = ({ plugin }) => {
    appList.value = appList.value.filter((app) => app.desc !== plugin.desc);
  };

  window.addLocalStartPlugin = ({ plugin }) => {
    window.removeLocalStartPlugin({ plugin });
    appList.value.push(plugin);
  };

  const loadPlugin = async (plugin) => {
    setSearchValue('');
    try {
      window.rubick.setExpendHeight(60);
    } catch (error) {
      console.error('[rubick-renderer:load-plugin-height]', error);
    }
    state.pluginLoading = true;
    state.currentPlugin = plugin;
    if (plugin.name !== 'rubick-system-feature') {
      await window.rubick.internal.upgradePlugin(plugin.name);
    }
    state.pluginLoading = false;
  };

  const openPlugin = async (plugin, option) => {
    window.rubick.removePlugin();
    window.initRubick();
    if (plugin.pluginType === 'ui' || plugin.pluginType === 'system') {
      if (state.currentPlugin && state.currentPlugin.name === plugin.name) {
        window.rubick.showMainWindow();
        return;
      }
      await loadPlugin(plugin);
      window.rubick.openPlugin(
        JSON.parse(
          JSON.stringify({
            ...plugin,
            ext: plugin.ext || {
              code: plugin.feature.code,
              type: plugin.cmd.type || 'text',
              payload: null,
            },
          })
        )
      );
    }
    if (plugin.pluginType === 'app') {
      try {
        window.rubick.internal.execAction(plugin.action);
      } catch {
        message.error('鍚姩搴旂敤鍑洪敊锛岃纭鍚姩搴旂敤瀛樺湪銆?');
      }
    }
    changePluginHistory(
      normalizeHistoryItem({
        ...plugin,
        originName: plugin.originName || plugin.name,
        displayName: option?.name || plugin.displayName,
        desc: option?.desc ?? plugin.desc,
        icon: plugin.icon || option?.icon || plugin.logo,
      })
    );
  };

  const changePluginHistory = (plugin) => {
    plugin = normalizeHistoryItem({
      ...plugin,
      icon: plugin.icon || plugin.logo,
    });
    const unpin = state.pluginHistory.filter((item) => !item.pin);
    const pin = state.pluginHistory.filter((item) => item.pin);
    const isPin = state.pluginHistory.find(
      (p) => p.historyKey === plugin.historyKey
    )?.pin;
    if (isPin) {
      pin.forEach((item, index) => {
        if (item.historyKey === plugin.historyKey) {
          plugin = pin.splice(index, 1)[0];
        }
      });
      pin.unshift(plugin);
    } else {
      unpin.forEach((item, index) => {
        if (item.historyKey === plugin.historyKey) {
          unpin.splice(index, 1);
        }
      });
      unpin.unshift(plugin);
    }
    if (state.pluginHistory.length > 8) {
      unpin.pop();
    }
    state.pluginHistory = [...pin, ...unpin];
    void persistPluginHistory();
  };

  const setPluginHistory = (plugins) => {
    state.pluginHistory = plugins.map(normalizeHistoryItem);
    const unpin = state.pluginHistory.filter((plugin) => !plugin.pin);
    const pin = state.pluginHistory.filter((plugin) => plugin.pin);
    state.pluginHistory = [...pin, ...unpin];
    void persistPluginHistory();
  };

  const { searchValue, onSearch, setSearchValue, placeholder } =
    searchManager();
  const {
    options,
    searchFocus,
    setOptionsRef,
    clipboardFile,
    clearClipboardFile,
    readClipboardContent,
  } = optionsManager({
    searchValue,
    appList,
    openPlugin,
    currentPlugin: toRefs(state).currentPlugin,
  });

  const changeSelect = (select) => {
    state.currentPlugin = select;
  };

  const addPlugin = (plugin: any) => {
    state.plugins.unshift(plugin);
  };

  const removePlugin = () => {
    return undefined;
  };

  window.loadPlugin = (plugin) => loadPlugin(plugin);

  window.updatePlugin = ({ currentPlugin }: any) => {
    state.currentPlugin = currentPlugin;
    window.rubick.internal.updateLocalPlugin(currentPlugin);
  };

  window.setCurrentPlugin = ({ currentPlugin }) => {
    state.currentPlugin = currentPlugin;
    setSearchValue('');
  };

  window.initRubick = () => {
    state.currentPlugin = {};
    setSearchValue('');
    setOptionsRef([]);
    window.setSubInput({ placeholder: '' });
  };

  window.pluginLoaded = () => {
    state.pluginLoading = false;
  };

  window.searchFocus = (args, strict) => {
    window.rubick.removePlugin();
    window.initRubick();
    searchFocus(args, strict);
  };

  return {
    ...toRefs(state),
    initPlugins,
    addPlugin,
    removePlugin,
    onSearch,
    openPlugin,
    changeSelect,
    options,
    searchValue,
    placeholder,
    searchFocus,
    setSearchValue,
    clipboardFile,
    clearClipboardFile,
    readClipboardContent,
    setPluginHistory,
    changePluginHistory,
  };
};

export default createPluginManager;
