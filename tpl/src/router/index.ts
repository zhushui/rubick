import {
  createRouter,
  createWebHashHistory,
  RouteRecordRaw,
} from 'vue-router';
import { defineComponent, h } from 'vue';
import List from '../views/List.vue';
import Doc from '../views/Doc.vue';

const Blank = defineComponent({
  name: 'TplBlank',
  render() {
    return h('div');
  },
});

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'blank',
    component: Blank,
  },
  {
    path: '/list',
    name: 'list',
    component: List,
  },
  {
    path: '/doc',
    name: 'doc',
    component: Doc,
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
