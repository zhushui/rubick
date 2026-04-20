<template>
  <div ref="optionsContainer" v-show="!currentPlugin.name" class="options">
    <div class="history-plugins" v-if="showHistory">
      <a-row>
        <a-col
          @click="() => openPlugin(item)"
          @contextmenu.prevent="openMenu($event, item)"
          :class="
            currentSelect === index ? 'active history-item' : 'history-item'
          "
          :span="3"
          v-for="(item, index) in pluginHistory"
          :key="index"
        >
          <a-avatar
            style="width: 28px; height: 28px"
            :src="getItemIcon(item)"
          />
          <div class="name ellpise">
            {{ item.cmd || item.displayName || item.pluginName || item._name || item.name }}
          </div>
          <div class="badge" v-if="item.pin"></div>
        </a-col>
      </a-row>
    </div>
    <div v-else-if="showEmptyState" class="empty-state">
      <div class="empty-state-row">
        <div class="empty-state-icon-wrap">
          <img class="empty-state-icon" :src="emptyStateIcon" />
        </div>
        <div class="empty-state-copy">
          <div class="empty-state-title">没有找到匹配项</div>
          <div class="empty-state-desc">
            <span class="empty-state-query">{{ displaySearchValue }}</span>
            <span class="empty-state-hint">
              试试拼音、英文名、应用全称，或更短一点的关键词
            </span>
          </div>
        </div>
      </div>
    </div>
    <a-list v-else item-layout="horizontal" :dataSource="sortedOptions">
      <template #renderItem="{ item, index }">
        <a-list-item
          @click="() => item.click()"
          :class="currentSelect === index ? 'active op-item' : 'op-item'"
        >
          <a-list-item-meta :description="renderDesc(item.desc)">
            <template #title>
              <span v-html="renderTitle(item.name, item.match)"></span>
            </template>
            <template #avatar>
              <a-avatar style="border-radius: 0" :src="getItemIcon(item)" />
            </template>
          </a-list-item-meta>
        </a-list-item>
      </template>
    </a-list>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, reactive, ref, toRaw, watch } from 'vue';
import localConfig, { resolveRendererImage } from '../confOp';
import fileIcon from '../assets/file.png';

const config: any = ref(localConfig.getConfig());

const props: any = defineProps({
  searchValue: {
    type: [String, Number],
    default: '',
  },
  options: {
    type: Array,
    default: (() => [])(),
  },
  currentSelect: {
    type: Number,
    default: 0,
  },
  currentPlugin: {
    type: Object,
    default: () => ({}),
  },
  pluginHistory: {
    type: Array,
    default: () => [],
  },
  clipboardFile: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['choosePlugin', 'setPluginHistory']);
const optionsContainer = ref<HTMLElement | null>(null);

const getHistoryKey = (item) =>
  item.historyKey ||
  [
    item.pluginType || 'plugin',
    item.originName || item.name || '',
    item.feature?.code || '',
    item.cmd || item.displayName || item.desc || '',
  ]
    .filter(Boolean)
    .join(':');

const emptyStateIcon = computed(() =>
  resolveRendererImage(config.value.perf.custom.logo, fileIcon)
);

const displaySearchValue = computed(() =>
  String(props.searchValue ?? '').trim()
);

const showHistory = computed(
  () =>
    !props.options.length &&
    !props.searchValue &&
    !props.clipboardFile.length &&
    config.value.perf.common.history
);

const showEmptyState = computed(
  () =>
    !showHistory.value &&
    String(props.searchValue ?? '').trim().length > 0 &&
    !props.options.length &&
    !props.clipboardFile.length
);

const renderTitle = (title, match) => {
  if (typeof title !== 'string') return;
  if (!props.searchValue || !match) return title;
  const result = title.substring(match[0], match[1] + 1);
  return `<div>${title.substring(
    0,
    match[0]
  )}<span style='color: var(--ant-error-color)'>${result}</span>${title.substring(
    match[1] + 1,
    title.length
  )}</div>`;
};

const renderDesc = (desc = '') => {
  if (desc.length > 80) {
    return `${desc.substr(0, 63)}...${desc.substr(
      desc.length - 14,
      desc.length
    )}`;
  }
  return desc;
};

const sort = (options) => {
  return [...options]
    .sort((prev, next) => {
      const scoreDiff = (next?.zIndex || 0) - (prev?.zIndex || 0);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      const prevName = String(prev?.name || '');
      const nextName = String(next?.name || '');
      if (prevName.length !== nextName.length) {
        return prevName.length - nextName.length;
      }

      return prevName.localeCompare(nextName, 'zh-CN');
    })
    .slice(0, 20);
};

const sortedOptions = computed(() => sort(props.options));

watch(
  [() => props.currentSelect, sortedOptions, showHistory],
  async () => {
    await nextTick();

    const activeElement =
      optionsContainer.value?.querySelector<HTMLElement>('.active');

    activeElement?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    });
  },
  {
    flush: 'post',
  }
);

const openPlugin = (item) => {
  emit('choosePlugin', item);
};

const getItemIcon = (item) => {
  const fallbackIcon =
    item?.pluginType === 'app' ? fileIcon : config.value.perf.custom.logo;
  return resolveRendererImage(item?.icon || item?.logo, fallbackIcon);
};

const menuState: any = reactive({
  plugin: null,
});

window.rubick.internal.onHistoryMenuAction(({ action }) => {
  if (!menuState.plugin) return;
  if (action === 'remove') {
    const history = props.pluginHistory.filter(
      (item) => getHistoryKey(item) !== getHistoryKey(menuState.plugin)
    );
    emit('setPluginHistory', toRaw(history));
  }
  if (action === 'pin') {
    const history = props.pluginHistory.map((item) => {
      if (getHistoryKey(item) === getHistoryKey(menuState.plugin)) {
        item.pin = true;
      }
      return item;
    });
    emit('setPluginHistory', toRaw(history));
  }
  if (action === 'unpin') {
    const history = props.pluginHistory.map((item) => {
      if (getHistoryKey(item) === getHistoryKey(menuState.plugin)) {
        item.pin = false;
      }
      return item;
    });
    emit('setPluginHistory', toRaw(history));
  }
});

const openMenu = (e, item) => {
  menuState.plugin = item;
  window.rubick.internal.popupHistoryMenu({
    pinned: item.pin,
    x: e.pageX,
    y: e.pageY,
  });
};
</script>

<style lang="less">
.ellpise {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}

.options {
  position: absolute;
  top: 60px;
  left: 0;
  width: 100%;
  z-index: 99;
  max-height: calc(~'100vh - 60px');
  overflow: auto;
  background: var(--color-body-bg);
  .history-plugins {
    width: 100%;
    border-top: 1px dashed var(--color-border-light);
    box-sizing: border-box;
    .history-item {
      cursor: pointer;
      box-sizing: border-box;
      height: 69px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      color: var(--color-text-content);
      border-right: 1px dashed var(--color-border-light);
      position: relative;
      .badge {
        position: absolute;
        top: 2px;
        right: 2px;
        width: 0;
        height: 0;
        border-radius: 4px;
        border-top: 6px solid var(--ant-primary-4);
        border-right: 6px solid var(--ant-primary-4);
        border-left: 6px solid transparent;
        border-bottom: 6px solid transparent;
      }
      &.active {
        background: var(--color-list-hover);
      }
    }
    .name {
      font-size: 12px;
      margin-top: 4px;
      width: 100%;
      text-align: center;
    }
  }
  .empty-state {
    min-height: 84px;
    padding: 0;
    box-sizing: border-box;
    border-top: 1px dashed var(--color-border-light);
    display: flex;
    align-items: center;
    color: var(--color-text-desc);
    .empty-state-row {
      width: 100%;
      min-width: 0;
      min-height: 84px;
      padding: 0 14px;
      display: flex;
      align-items: center;
      gap: 12px;
      background: var(--color-body-bg);
      border-bottom: 1px solid var(--color-border-light);
    }
    .empty-state-icon-wrap {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: var(--color-list-hover);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .empty-state-icon {
      width: 20px;
      height: 20px;
      opacity: 0.82;
    }
    .empty-state-copy {
      min-width: 0;
      flex: 1;
    }
    .empty-state-title {
      font-size: 14px;
      line-height: 1.4;
      margin-bottom: 4px;
      color: var(--color-text-primary);
      min-width: 0;
    }
    .empty-state-query {
      color: var(--ant-primary-color);
      margin-right: 6px;
    }
    .empty-state-desc {
      font-size: 12px;
      line-height: 1.5;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .empty-state-hint {
      color: var(--color-text-desc);
    }
  }
  .op-item {
    padding: 0 10px;
    height: 70px;
    line-height: 50px;
    max-height: 500px;
    overflow: auto;
    background: var(--color-body-bg);
    color: var(--color-text-content);
    border-color: var(--color-border-light);
    border-bottom: 1px solid var(--color-border-light) !important;
    &.active {
      background: var(--color-list-hover);
    }
    .ant-list-item-meta-title {
      color: var(--color-text-content);
    }
    .ant-list-item-meta-description {
      color: var(--color-text-desc);
    }
  }
}
</style>
