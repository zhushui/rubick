<template>
  <router-view />
</template>

<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();

const encodePayload = (payload) => {
  try {
    return encodeURIComponent(JSON.stringify(payload ?? null));
  } catch {
    return '';
  }
};

window.rubick.onPluginEnter(({ code, type, payload }) => {
  const current = window.exports?.[code];
  if (!current) {
    return;
  }

  window.__tplRouteContext = {
    code,
    type,
    payload,
  };

  if (current.mode === 'none') {
    current.args.enter && current.args.enter({ code: code, type, payload });
    return;
  }

  const navigation = {
    name: current.mode,
    query: {
      code,
      type,
      payload: encodePayload(payload),
    },
  };

  if (router.currentRoute.value.name === current.mode) {
    router.replace(navigation);
    return;
  }

  router.push(navigation);
});
</script>

<style>
* {
  margin: 0;
  padding: 0;
}
</style>
