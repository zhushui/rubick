<template>
  <div class="rubick-select">
    <div
      v-if="!!clipboardFile.length"
      :class="clipboardFile[0].name ? 'clipboard-tag' : 'clipboard-img'"
    >
      <img style="margin-right: 8px" :src="getIcon()" />
      <div class="ellipse">{{ clipboardFile[0].name }}</div>
      <a-tag v-if="clipboardFile.length > 1" color="#aaa">
        {{ clipboardFile.length }}
      </a-tag>
    </div>
    <div v-else :class="currentPlugin.cmd ? 'rubick-tag' : ''">
      <img
        class="rubick-logo"
        :src="getCurrentPluginLogo()"
        @click="() => emit('openMenu')"
      />
      <div v-show="currentPlugin.cmd" class="select-tag">
        {{ currentPlugin.cmd }}
      </div>
    </div>
    <a-input
      id="search"
      ref="mainInput"
      class="main-input"
      :class="{ 'is-text-target': isTextTarget }"
      :value="searchValue"
      :placeholder="
        pluginLoading
          ? '更新检测中...'
          : placeholder || config.perf.custom.placeholder
      "
      @input="(e) => changeValue(e)"
      @keydown="(e) => handleKeydown(e)"
      @keypress.enter="(e) => keydownEvent(e, 'enter')"
      @keypress.space="(e) => keydownEvent(e, 'space')"
      @focus="emit('focus')"
      @mousemove.capture="(e) => updateInputCursorState(e)"
      @mouseleave="resetInputCursorState"
    >
      <template #suffix>
        <div class="suffix-tool">
          <MoreOutlined class="icon-more" @click="showSeparate()" />
        </div>
      </template>
    </a-input>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { MoreOutlined } from '@ant-design/icons-vue';
import localConfig, { resolveRendererImage } from '../confOp';
import fileIcon from '../assets/file.png';
import {
  isPointerOverSearchText,
  isSearchInputInteractiveElement,
} from '../../common/utils/searchTextInteraction';

type Direction = 'up' | 'down' | 'left' | 'right';

const config: any = ref(localConfig.getConfig());
const isTextTarget = ref(false);

const props: any = defineProps({
  searchValue: {
    type: [String, Number],
    default: '',
  },
  placeholder: {
    type: String,
    default: '',
  },
  pluginHistory: {
    type: Array,
    default: () => [],
  },
  currentPlugin: {
    type: Object,
    default: () => ({}),
  },
  pluginLoading: {
    type: Boolean,
    default: false,
  },
  clipboardFile: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits([
  'onSearch',
  'changeCurrent',
  'openMenu',
  'changeSelect',
  'choosePlugin',
  'focus',
  'clearSearchValue',
  'readClipboardContent',
  'clearClipbord',
]);

const changeValue = (e) => {
  targetSearch({ value: e.target.value });
  emit('onSearch', e);
  isTextTarget.value = false;
};

const canNavigateHistory = () =>
  !props.currentPlugin.name &&
  !String(props.searchValue ?? '').trim() &&
  !!config.value.perf.common.history &&
  !props.clipboardFile.length &&
  !!props.pluginHistory.length;

const keydownEvent = (e, key: Direction | 'enter' | 'space') => {
  key !== 'space' && e.preventDefault();
  const { ctrlKey, shiftKey, altKey, metaKey } = e;
  const modifiers: Array<string> = [];
  ctrlKey && modifiers.push('control');
  shiftKey && modifiers.push('shift');
  altKey && modifiers.push('alt');
  metaKey && modifiers.push('meta');
  window.rubick.internal.sendPluginSomeKeyDownEvent({
      keyCode: e.code,
      modifiers,
  });
  const runPluginDisable =
    (e.target.value === '' && !props.pluginHistory.length) ||
    props.currentPlugin.name;
  switch (key) {
    case 'up':
      if (props.currentPlugin.name) return;
      emit('changeCurrent', 'up');
      break;
    case 'down':
      if (props.currentPlugin.name) return;
      emit('changeCurrent', 'down');
      break;
    case 'left':
      if (!canNavigateHistory()) return;
      emit('changeCurrent', 'left');
      break;
    case 'right':
      if (!canNavigateHistory()) return;
      emit('changeCurrent', 'right');
      break;
    case 'enter':
      if (runPluginDisable) return;
      emit('choosePlugin');
      break;
    case 'space':
      if (runPluginDisable || !config.value.perf.common.space) return;
      e.preventDefault();
      emit('choosePlugin');
      break;
    default:
      break;
  }
};

const checkNeedInit = (e) => {
  const { ctrlKey, metaKey } = e;

  if (e.target.value === '' && e.keyCode === 8) {
    closeTag();
  }
  if ((ctrlKey || metaKey) && e.key === 'v') {
    emit('readClipboardContent');
  }
};

const handleKeydown = (e) => {
  checkNeedInit(e);

  switch (e.key) {
    case 'ArrowLeft':
      if (canNavigateHistory()) {
        keydownEvent(e, 'left');
      }
      break;
    case 'ArrowRight':
      if (canNavigateHistory()) {
        keydownEvent(e, 'right');
      }
      break;
    case 'ArrowDown':
      keydownEvent(e, 'down');
      break;
    case 'Tab':
      keydownEvent(e, 'down');
      break;
    case 'ArrowUp':
      keydownEvent(e, 'up');
      break;
    default:
      break;
  }
};

const updateInputCursorState = (e: MouseEvent) => {
  const target = e.target instanceof Element ? e.target : null;
  if (!target || isSearchInputInteractiveElement(target)) {
    isTextTarget.value = false;
    return;
  }

  isTextTarget.value = isPointerOverSearchText(e, target);
};

const resetInputCursorState = () => {
  isTextTarget.value = false;
};

const getCurrentPluginMenuInfo = () => {
  if (!props.currentPlugin?.name) {
    return null;
  }

  const features = Array.isArray(props.currentPlugin.features)
    ? props.currentPlugin.features
        .map((feature) => ({
          code: feature?.code || '',
          label:
            feature?.explain ||
            feature?.cmd ||
            feature?.name ||
            (Array.isArray(feature?.cmds)
              ? feature.cmds.filter(Boolean).join(' / ')
              : '') ||
            feature?.code ||
            '',
        }))
        .filter((feature) => feature.label)
    : [];

  return {
    pluginName:
      props.currentPlugin.pluginName ||
      props.currentPlugin.displayName ||
      props.currentPlugin.name ||
      '',
    description: props.currentPlugin.description || props.currentPlugin.desc || '',
    features,
  };
};

const targetSearch = ({ value }) => {
  if (props.currentPlugin.name) {
    return window.rubick.internal.sendSubInputChangeEvent({
      text: value,
    });
  }
};

const closeTag = () => {
  emit('changeSelect', {});
  emit('clearClipbord');
  window.rubick.removePlugin();
};

window.rubick.internal.onMainMenuAction(({ action, value }) => {
  if (action === 'toggle-hide-on-blur') {
    changeHideOnBlur();
  }
  if (action === 'change-lang') {
    changeLang(value);
  }
  if (action === 'open-plugin-devtools') {
    window.rubick.internal.openPluginDevTools();
  }
  if (action === 'detach-plugin') {
    newWindow();
  }
});

const showSeparate = () => {
  const plugin = getCurrentPluginMenuInfo();
  window.rubick.internal.popupMainMenu({
    hideOnBlur: config.value.perf.common.hideOnBlur,
    lang: config.value.perf.common.lang,
    hasPlugin: !!plugin,
    plugin,
  });
};

const changeLang = (lang) => {
  const cfg = { ...config.value };
  cfg.perf.common.lang = lang;
  localConfig.setConfig(JSON.parse(JSON.stringify(cfg)));
  config.value = cfg;
};

const changeHideOnBlur = () => {
  const cfg = { ...config.value };
  cfg.perf.common.hideOnBlur = !cfg.perf.common.hideOnBlur;
  localConfig.setConfig(JSON.parse(JSON.stringify(cfg)));
  config.value = cfg;
};

const getIcon = () => {
  return props.clipboardFile[0].dataUrl || fileIcon;
};

const getCurrentPluginLogo = () =>
  resolveRendererImage(
    props.currentPlugin.icon || props.currentPlugin.logo,
    config.value.perf.custom.logo
  );

const getNativeSearchInput = () => {
  const fromQuery = document.querySelector(
    '.main-input input, .main-input textarea'
  );
  if (
    fromQuery instanceof HTMLInputElement ||
    fromQuery instanceof HTMLTextAreaElement
  ) {
    return fromQuery;
  }

  const searchComponent = mainInput.value as any;
  const componentInput =
    searchComponent?.input ||
    searchComponent?.$el?.querySelector?.('input, textarea');

  return componentInput instanceof HTMLInputElement ||
    componentInput instanceof HTMLTextAreaElement
    ? componentInput
    : null;
};

const newWindow = () => {
  window.rubick.internal.detachPlugin();
};

const mainInput = ref(null);
Object.assign(window, {
  focusSubInput: () => {
    const input = getNativeSearchInput();
    input?.focus();
  },
  selectSubInput: () => {
    const input = getNativeSearchInput();
    if (!input) return;
    input.focus();
    input.select?.();
  },
});

window.rubick.onShow(() => {
  (mainInput.value as unknown as HTMLDivElement).focus();
});

window.rubick.onHide(() => {
  emit('clearSearchValue');
});
</script>

<style lang="less">
.rubick-select {
  display: flex;
  padding-left: 16px;
  background: var(--color-body-bg);
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  align-items: center;
  height: 60px;
  z-index: 100;
  box-sizing: border-box;
  .ellipse {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
  }
  .rubick-tag {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    height: 40px;
    border-radius: 9px;
    background: var(--color-list-hover);
  }
  .select-tag {
    white-space: pre;
    user-select: none;
    font-size: 16px;
    color: var(--color-text-primary);
    margin-left: 8px;
  }

  .main-input {
    height: 40px !important;
    box-sizing: border-box;
    flex: 1;
    border: none;
    outline: none;
    box-shadow: none !important;
    background: var(--color-body-bg);
    padding-left: 8px;
    cursor: default;
    .ant-select-selection,
    .ant-input,
    .ant-select-selection__rendered {
      caret-color: var(--ant-primary-color);
      height: 100% !important;
      font-size: 16px;
      border: none !important;
      background: var(--color-body-bg);
      color: var(--color-text-primary);
      cursor: default;
    }
    .ant-input-affix-wrapper,
    .ant-input-suffix,
    .ant-input-prefix,
    input,
    textarea {
      cursor: default;
    }
    &.is-text-target {
      .ant-input,
      .ant-input-affix-wrapper,
      input,
      textarea {
        cursor: text;
      }
    }
  }

  .rubick-logo {
    width: 32px;
    border-radius: 100%;
  }
  .icon-tool {
    background: var(--color-input-hover);
  }
  .ant-input:focus {
    border: none;
    box-shadow: none;
  }
  .suffix-tool {
    display: flex;
    align-items: center;
    cursor: default;
    .icon-more {
      font-size: 26px;
      font-weight: bold;
      cursor: pointer;
      color: var(--color-text-content);
    }
  }
  .clipboard-tag {
    white-space: pre;
    user-select: none;
    font-size: 16px;
    height: 32px;
    position: relative;
    align-items: center;
    display: flex;
    border: 1px solid var(--color-border-light);
    padding: 0 8px;
    margin-right: 12px;
    img {
      width: 24px;
      height: 24px;
      margin-right: 6px;
    }
  }
  .clipboard-img {
    white-space: pre;
    user-select: none;
    font-size: 16px;
    height: 32px;
    position: relative;
    align-items: center;
    display: flex;
    img {
      width: 32px;
      height: 32px;
    }
  }
}
</style>
