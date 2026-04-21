<template>
  <div class="list-container">
    <div class="options" v-show="!!(lists || []).length">
      <div
        :key="index"
        :class="currentSelect === index ? 'active op-item' : 'op-item'"
        v-for="(item, index) in lists"
        @click="select(item)"
      >
        <img v-if="item.icon" class="icon" :src="item.icon" />
        <div class="content">
          <div class="title">{{ item.title }}</div>
          <div class="desc">{{ decodeURIComponent(item.description) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useRoute } from 'vue-router';
import { ref, onBeforeUnmount, watch } from 'vue';

const route = useRoute();

const itemHeight = 60;
const itemMaxNum = 10;
const defaultHeight = 60;

window.rubick.setExpendHeight(defaultHeight);

const lists = ref([]);
watch([lists], () => {
  const height =
    lists.value.length > itemMaxNum
      ? itemMaxNum * itemHeight
      : itemHeight * lists.value.length;
  window.rubick.setExpendHeight(defaultHeight + height);
});

const decodePayload = (value: unknown) => {
  if (typeof value !== 'string' || !value) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(value));
  } catch {
    return null;
  }
};

const getRouteContext = () => {
  const context = window.__tplRouteContext || {};
  const queryCode = route.query.code;
  const queryType = route.query.type;
  const queryPayload = route.query.payload;

  return {
    code:
      typeof queryCode === 'string' && queryCode
        ? queryCode
        : context.code || '',
    type:
      typeof queryType === 'string'
        ? queryType
        : context.type || '',
    payload:
      decodePayload(queryPayload) ??
      context.payload ??
      [],
  };
};

const current = ref<any>();
const pluginContext = ref({
  code: '',
  type: '',
  payload: [] as any,
});

const currentSelect = ref(0);

const loadCurrentPlugin = () => {
  const nextContext = getRouteContext();
  pluginContext.value = nextContext;
  current.value = nextContext.code ? window.exports?.[nextContext.code] : null;
  currentSelect.value = 0;
  lists.value = [];

  current.value?.args?.enter?.(nextContext, (result) => {
    lists.value = result || [];
  });
};

const stopChangeCurrent = window.tplBridge.onChangeCurrent((result) => {
  if (
    currentSelect.value + result > lists.value.length - 1 ||
    currentSelect.value + result < 0
  ) {
    return;
  }
  currentSelect.value = currentSelect.value + result;
});

window.rubick.setSubInput(({ text }) => {
  current.value?.args?.search?.(
    {
      code: pluginContext.value.code,
      type: '',
      payload: [],
    },
    text,
    (result) => {
      lists.value = result || [];
    }
  );
}, '搜索');

const select = (item) => {
  current.value?.args?.select?.(
    {
      code: pluginContext.value.code,
      type: '',
      payload: [],
    },
    item
  );
};

const onKeydownAction = (e) => {
  if (e.code === 'Enter') {
    return select(lists.value[currentSelect.value]);
  }
  let index = 0;
  if (e.code === 'ArrowDown') {
    index = 1;
  }
  if (e.code === 'ArrowUp') {
    index = -1;
  }
  if (!lists.value.length) return;
  if (
    currentSelect.value + index > lists.value.length - 1 ||
    currentSelect.value + index < 0
  )
    return;
  currentSelect.value = currentSelect.value + index;
};

window.addEventListener('keydown', onKeydownAction);
watch(() => route.fullPath, loadCurrentPlugin, { immediate: true });

onBeforeUnmount(() => {
  stopChangeCurrent();
  window.removeEventListener('keydown', onKeydownAction);
});
</script>
<style>
.options {
  position: absolute;
  left: 0;
  width: 100%;
  z-index: 99;
  max-height: calc(100vh);
  overflow: auto;
}
.options::-webkit-scrollbar {
  width: 0;
}
.op-item {
  padding: 0 10px;
  height: 60px;
  max-height: 500px;
  overflow: auto;
  background: #fafafa;
  display: flex;
  align-items: center;
  font-size: 14px;
  text-align: left;
}
.icon {
  width: 30px;
  height: 30px;
  border-radius: 100%;
  margin-right: 10px;
}
.title {
  width: 500px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.desc {
  color: #999;
  width: 500px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.op-item.active {
  background: #dee2e8;
}
</style>
