<template>
  <div id="components-layout" @mousedown="onMouseDown">
    <Search
      :currentPlugin="currentPlugin"
      @changeCurrent="changeIndex"
      @onSearch="onSearch"
      @openMenu="openMenu"
      @changeSelect="changeSelect"
      :searchValue="searchValue"
      :placeholder="placeholder"
      :pluginLoading="pluginLoading"
      :pluginHistory="pluginHistory"
      :clipboardFile="clipboardFile || []"
      @choosePlugin="choosePlugin"
      @focus="searchFocus"
      @clear-search-value="clearSearchValue"
      @clearClipbord="clearClipboardFile"
      @readClipboardContent="readClipboardContent"
    />
    <Result
      :pluginHistory="pluginHistory"
      :currentPlugin="currentPlugin"
      :searchValue="searchValue"
      :currentSelect="currentSelect"
      :options="options"
      :clipboardFile="clipboardFile || []"
      @setPluginHistory="setPluginHistory"
      @choosePlugin="choosePlugin"
    />
  </div>
</template>

<script setup lang="ts">
import { watch, ref, toRaw, onMounted } from 'vue';
import Result from './components/result.vue';
import Search from './components/search.vue';
import getWindowHeight from '../common/utils/getWindowHeight';
import createPluginManager from './plugins-manager';
import useDrag from '../common/utils/dragWindow';
import { message } from 'ant-design-vue';
import localConfig from './confOp';

const { onMouseDown } = useDrag();

const {
  initPlugins,
  options,
  onSearch,
  searchValue,
  changeSelect,
  openPlugin,
  currentPlugin,
  placeholder,
  pluginLoading,
  searchFocus,
  clipboardFile,
  setSearchValue,
  clearClipboardFile,
  readClipboardContent,
  pluginHistory,
  setPluginHistory,
  changePluginHistory,
} = createPluginManager();

const currentSelect = ref(0);
const HISTORY_GRID_COLUMNS = 8;
type Direction = 'up' | 'down' | 'left' | 'right';
const menuPluginInfo: any = ref({
  features: [{ code: 'settings' }],
});

const config: any = ref(localConfig.getConfig());

const syncBuiltinPlugin = () => {
  try {
    const builtinPluginInfo = window.rubick.internal.getBuiltinPluginInfo();
    if (builtinPluginInfo) {
      menuPluginInfo.value = builtinPluginInfo;
      window.rubick.internal.addLocalPlugin(
        JSON.parse(JSON.stringify(menuPluginInfo.value))
      );
    }
  } catch (error) {
    console.error('[rubick-renderer:builtin-plugin]', error);
  }
};

const syncWindowHeight = () => {
  try {
    const showEmptyState =
      !!String(searchValue.value || '').trim() &&
      !options.value.length &&
      !(clipboardFile.value || []).length;

    window.rubick.setExpendHeight(
      getWindowHeight(
        options.value,
        pluginLoading.value || !config.value.perf.common.history
          ? []
          : pluginHistory.value,
        showEmptyState
      )
    );
  } catch (error) {
    console.error('[rubick-renderer:height]', error);
  }
};

watch(
  [options, pluginHistory, currentPlugin],
  () => {
    currentSelect.value = 0;
    if (currentPlugin.value.name) return;
    syncWindowHeight();
  }
);

onMounted(async () => {
  syncBuiltinPlugin();
  await initPlugins();
  syncWindowHeight();
});

const changeIndex = (index) => {
  const showHistory =
    !options.value.length &&
    !String(searchValue.value || '').trim() &&
    !(clipboardFile.value || []).length &&
    config.value.perf.common.history;
  const len = options.value.length || pluginHistory.value.length;
  if (!len) return;

  const getNextHistoryIndex = (
    direction: Direction,
    currentIndex: number,
    total: number
  ) => {
    if (total <= 1) {
      return 0;
    }

    const currentRow = Math.floor(currentIndex / HISTORY_GRID_COLUMNS);
    const currentColumn = currentIndex % HISTORY_GRID_COLUMNS;
    const lastRow = Math.floor((total - 1) / HISTORY_GRID_COLUMNS);

    switch (direction) {
      case 'left':
        return currentIndex === 0 ? total - 1 : currentIndex - 1;
      case 'right':
        return currentIndex === total - 1 ? 0 : currentIndex + 1;
      case 'up': {
        const targetRow = currentRow === 0 ? lastRow : currentRow - 1;
        return Math.min(
          targetRow * HISTORY_GRID_COLUMNS + currentColumn,
          total - 1
        );
      }
      case 'down': {
        const targetRow = currentRow === lastRow ? 0 : currentRow + 1;
        return Math.min(
          targetRow * HISTORY_GRID_COLUMNS + currentColumn,
          total - 1
        );
      }
      default:
        return currentIndex;
    }
  };

  if (showHistory && typeof index === 'string') {
    currentSelect.value = getNextHistoryIndex(index, currentSelect.value, len);
    return;
  }

  const deltaMap = showHistory
    ? {
        up: -HISTORY_GRID_COLUMNS,
        down: HISTORY_GRID_COLUMNS,
        left: -1,
        right: 1,
      }
    : {
        up: -1,
        down: 1,
        left: -1,
        right: 1,
      };

  const delta =
    typeof index === 'number'
      ? index
      : deltaMap[index as keyof typeof deltaMap] ?? 0;

  if (!delta) {
    return;
  }

  if (showHistory) {
    currentSelect.value =
      ((currentSelect.value + delta) % len + len) % len;
    return;
  }

  if (currentSelect.value + delta > len - 1) {
    currentSelect.value = 0;
  } else if (currentSelect.value + delta < 0) {
    currentSelect.value = len - 1;
  } else {
    currentSelect.value = currentSelect.value + delta;
  }
};

const openMenu = (ext) => {
  if (!menuPluginInfo.value?.features?.length) {
    console.warn('[rubick-renderer:open-menu] builtin feature unavailable');
    return;
  }
  openPlugin({
    ...toRaw(menuPluginInfo.value),
    feature: menuPluginInfo.value.features[0],
    cmd: '插件市场',
    ext,
    click: () => openMenu(ext),
  });
};

window.openRubickMenu = openMenu;

const choosePlugin = (plugin) => {
  if (options.value.length) {
    const currentChoose = options.value[currentSelect.value];
    currentChoose.click();
    return;
  }

  const localPlugins = window.rubick.internal.getLocalPlugins();
  const currentChoose = plugin || pluginHistory.value[currentSelect.value];
  const canonicalName = currentChoose.originName || currentChoose.name;
  let hasRemove = true;

  if (currentChoose.pluginType === 'app') {
    hasRemove = false;
    changePluginHistory(currentChoose);
    window.rubick.internal.execAction(currentChoose.action);
    return;
  }

  localPlugins.find((localPlugin) => {
    if (localPlugin.name === canonicalName) {
      hasRemove = false;
      return true;
    }
    return false;
  });

  if (hasRemove) {
    const history = pluginHistory.value.filter(
      (item) => (item.originName || item.name) !== canonicalName
    );
    setPluginHistory(history);
    message.warning('插件已被卸载');
    return;
  }

  changePluginHistory(currentChoose);
  window.rubick.openPlugin(
    JSON.parse(
      JSON.stringify({
        ...currentChoose,
        name: canonicalName,
        originName: canonicalName,
        ext: {
          code: currentChoose.feature.code,
          type: currentChoose.cmd.type || 'text',
          payload: null,
        },
      })
    )
  );
};

const clearSearchValue = () => {
  setSearchValue('');
};
</script>

<style lang="less">
@import './assets/var.less';
#components-layout {
  height: 100vh;
  overflow: hidden;
  background: var(--color-body-bg);
  user-select: none !important;
  -webkit-user-select: none !important;
  ::-webkit-scrollbar {
    width: 0;
  }
  &.drag {
    -webkit-app-region: drag;
  }
  * {
    user-select: none !important;
    -webkit-user-select: none !important;
  }
  .main-input,
  .main-input *,
  .main-input input,
  .main-input textarea {
    user-select: text !important;
    -webkit-user-select: text !important;
  }
  .main-input .suffix-tool,
  .main-input .suffix-tool *,
  .main-input .icon-more,
  .main-input .ant-input-suffix,
  .main-input .ant-input-prefix {
    user-select: none !important;
    -webkit-user-select: none !important;
  }
}
</style>
