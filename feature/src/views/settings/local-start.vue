<template>
  <div class="file-container">
    <div
      ref="dropZoneRef"
      class="drop-zone"
      :class="{ 'is-dragging': isDragging }"
      @click="selectLocalStartItems"
      @dragenter.stop.prevent="handleZoneDragEnter"
      @dragover.stop.prevent="handleZoneDragOver"
      @dragleave.stop="handleZoneDragLeave"
      @drop.stop.prevent="dropFile"
    >
      <div class="drop-zone__icon">
        <InboxOutlined />
      </div>
      <div class="drop-zone__content">
        <div class="drop-zone__label">
          {{ $t('feature.settings.localstart.title') }}
        </div>
        <div class="drop-zone__hint">
          {{ $t('feature.settings.localstart.dropHint') }}
        </div>
      </div>
      <div class="drop-zone__cue">
        <PlusOutlined />
      </div>
    </div>
    <a-list item-layout="horizontal" :data-source="localStartList">
      <template #renderItem="{ item }">
        <a-list-item>
          <template #actions>
            <a key="list-loadmore-edit" @click.stop="() => remove(item)">
              {{ $t('feature.settings.localstart.remove') }}
            </a>
          </template>
          <a-list-item-meta :description="item.desc">
            <template #title>
              <div>
                <span :class="item.del ? 'del-title' : ''">
                  {{ item.name }}
                </span>
                <span v-if="item.del" class="has-del">
                  {{ $t('feature.settings.localstart.missing') }}
                </span>
              </div>
            </template>
            <template #avatar>
              <a-avatar shape="square" :src="item.icon" />
            </template>
          </a-list-item-meta>
        </a-list-item>
      </template>
    </a-list>
  </div>
</template>

<script setup>
import { InboxOutlined, PlusOutlined } from '@ant-design/icons-vue';
import { onMounted, ref } from 'vue';
import { toBridgePayload } from '@/utils/bridge';
import { useHostFileDropTarget } from '@/utils/useHostFileDropTarget';

const dbId = 'rubick-local-start-app';

const localStartList = ref(window.rubick.dbStorage.getItem(dbId) || []);
const dropZoneRef = ref(null);

const appendPathsAsLocalStartItems = async (paths) => {
  const normalizedItems = Array.isArray(paths)
    ? paths
        .filter(Boolean)
        .map((targetPath) => ({
          path: targetPath,
          name: '',
        }))
    : [];

  await appendLocalStartItems(normalizedItems);
};

const getDisplayName = (targetPath, fallbackName = '') => {
  if (fallbackName) {
    return fallbackName;
  }

  const normalizedPath = String(targetPath || '').replace(/[\\/]+$/, '');
  const parts = normalizedPath.split(/[\\/]/);
  return parts[parts.length - 1] || normalizedPath;
};

const buildLocalStartPlugin = async (targetPath, displayName = '') => {
  if (!targetPath || !window.rubick.fileExists(targetPath)) {
    return null;
  }

  let icon = '';
  try {
    icon = (await window.rubick.getFileIcon(targetPath)) || '';
  } catch {
    icon = '';
  }

  const name = getDisplayName(targetPath, displayName);
  const action = window.rubick.isWindows()
    ? `start "dummyclient" "${targetPath}"`
    : `open ${targetPath.replace(/ /g, '\\ ')}`;

  return {
    icon,
    value: 'plugin',
    desc: targetPath,
    pluginType: 'app',
    name,
    action,
    keyWords: [name],
    names: [name],
  };
};

const appendLocalStartItems = async (items) => {
  const currentPaths = new Set(
    localStartList.value.map((plugin) => plugin.desc).filter(Boolean)
  );

  const nextPlugins = (
    await Promise.all(
      items
        .filter(({ path }) => path && !currentPaths.has(path))
        .map(async ({ path, name }) => {
          const plugin = await buildLocalStartPlugin(path, name);
          if (plugin) {
            window.market.addLocalStartPlugin(toBridgePayload(plugin));
          }
          return plugin;
        })
    )
  ).filter(Boolean);

  if (!nextPlugins.length) {
    return;
  }

  localStartList.value = [...localStartList.value, ...nextPlugins];
  window.rubick.dbStorage.setItem(
    dbId,
    JSON.parse(JSON.stringify(localStartList.value))
  );
};

const checkFileExists = () => {
  localStartList.value = localStartList.value.map((plugin) => {
    if (!window.rubick.fileExists(plugin.desc)) {
      return {
        ...plugin,
        del: true,
      };
    }
    return plugin;
  });
};

checkFileExists();

const {
  isDragging,
  handleDrop: dropFile,
  handleZoneDragEnter,
  handleZoneDragOver,
  handleZoneDragLeave,
} = useHostFileDropTarget({
  targetRef: dropZoneRef,
  message: 'Click or drag files/folders here',
  onFiles: appendPathsAsLocalStartItems,
});

onMounted(async () => {
  if (localStartList.value.length) {
    return;
  }

  const dbData = await window.rubick.db.get(dbId);
  if (Array.isArray(dbData?.value)) {
    localStartList.value = dbData.value;
    window.rubick.dbStorage.setItem(dbId, dbData.value);
    checkFileExists();
  }
});

const remove = (item) => {
  localStartList.value = localStartList.value.filter(
    (app) => app.desc !== item.desc
  );
  window.rubick.dbStorage.setItem(
    dbId,
    JSON.parse(JSON.stringify(localStartList.value))
  );
  window.market.removeLocalStartPlugin(toBridgePayload(item));
};

const selectLocalStartItems = async () => {
  const selectedPaths = await window.rubick.showOpenDialogAsync({
    properties: ['openFile', 'openDirectory', 'multiSelections'],
  });

  await appendPathsAsLocalStartItems(selectedPaths);
};
</script>

<style lang="less">
.file-container {
  box-sizing: border-box;
  width: 100%;
  overflow-x: hidden;
  background: var(--color-body-bg);
  height: calc(~'100vh - 180px');
  .drop-zone {
    align-items: center;
    background: color-mix(
      in srgb,
      var(--ant-primary-color) 10%,
      var(--color-body-bg)
    );
    border: 1px dashed
      color-mix(in srgb, var(--ant-primary-color) 34%, transparent);
    border-radius: 10px;
    cursor: pointer;
    display: flex;
    gap: 14px;
    margin-bottom: 12px;
    min-height: 82px;
    overflow: hidden;
    padding: 14px 16px;
    position: relative;
    transition:
      background 0.2s ease,
      border-color 0.2s ease,
      box-shadow 0.2s ease;
    &::before {
      border: 1px dashed
        color-mix(in srgb, var(--ant-primary-color) 28%, transparent);
      border-radius: 8px;
      content: '';
      inset: 7px;
      opacity: 0.4;
      pointer-events: none;
      position: absolute;
    }
    &:hover,
    &.is-dragging {
      background: color-mix(
        in srgb,
        var(--ant-primary-color) 14%,
        var(--color-body-bg)
      );
      border-color: var(--ant-primary-color);
      box-shadow: 0 0 0 2px
        color-mix(in srgb, var(--ant-primary-color) 18%, transparent);
      &::before {
        opacity: 0.75;
      }
    }
  }
  .drop-zone__icon {
    align-items: center;
    background: color-mix(in srgb, var(--ant-primary-color) 16%, transparent);
    border-radius: 14px;
    box-shadow: inset 0 0 0 1px
      color-mix(in srgb, var(--ant-primary-color) 24%, transparent);
    color: var(--ant-primary-color);
    display: flex;
    flex: 0 0 44px;
    font-size: 22px;
    height: 44px;
    justify-content: center;
    line-height: 1;
    pointer-events: none;
    position: relative;
    transition: background 0.2s ease;
    z-index: 1;
  }
  .drop-zone__content {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    pointer-events: none;
    position: relative;
    z-index: 1;
  }
  .drop-zone__label {
    color: color-mix(in srgb, var(--ant-primary-color) 72%, var(--color-heading));
    font-size: 14px;
    font-weight: 600;
    line-height: 1.3;
  }
  .drop-zone__hint {
    color: color-mix(
      in srgb,
      var(--color-text-description) 92%,
      var(--color-text)
    );
    font-size: 12px;
    line-height: 1.5;
    max-width: 420px;
    overflow-wrap: anywhere;
  }
  .drop-zone__cue {
    align-items: center;
    align-self: stretch;
    background: color-mix(in srgb, var(--ant-primary-color) 12%, transparent);
    border: 1px dashed
      color-mix(in srgb, var(--ant-primary-color) 40%, transparent);
    border-radius: 12px;
    color: var(--ant-primary-color);
    display: flex;
    flex: 0 0 36px;
    font-size: 14px;
    justify-content: center;
    margin-left: auto;
    min-height: 100%;
    pointer-events: none;
    position: relative;
    transition:
      background 0.2s ease,
      border-color 0.2s ease;
    z-index: 1;
  }
  .drop-zone:hover .drop-zone__icon,
  .drop-zone.is-dragging .drop-zone__icon {
    background: color-mix(in srgb, var(--ant-primary-color) 22%, transparent);
  }
  .drop-zone:hover .drop-zone__cue,
  .drop-zone.is-dragging .drop-zone__cue {
    background: color-mix(in srgb, var(--ant-primary-color) 18%, transparent);
    border-color: color-mix(
      in srgb,
      var(--ant-primary-color) 56%,
      transparent
    );
  }
  @media (max-width: 640px) {
    .drop-zone {
      align-items: flex-start;
      min-height: 90px;
    }
    .drop-zone__hint {
      max-width: none;
    }
    .drop-zone__cue {
      align-self: center;
      min-height: 40px;
    }
  }
  .del-title {
    text-decoration-line: line-through;
    text-decoration-color: var(--ant-error-color);
  }
  .has-del {
    color: var(--ant-error-color);
    font-size: 12px;
    margin-left: 6px;
  }
}
</style>
