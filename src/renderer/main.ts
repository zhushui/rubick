import { createApp } from 'vue';
import {
  Button,
  List,
  Spin,
  Input,
  Avatar,
  Tag,
  ConfigProvider,
  Row,
  Col,
  Divider,
} from 'ant-design-vue';
import App from './App.vue';
import localConfig from './confOp';

import 'ant-design-vue/dist/antd.variable.min.css';

window.addEventListener('error', (event) => {
  console.error(
    '[rubick-renderer:error]',
    event.error?.stack || event.message || event.filename
  );
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[rubick-renderer:unhandledrejection]', event.reason);
});

const config: any = localConfig.getConfig();

const applyTheme = () => {
  const currentConfig: any = localConfig.getConfig() || {};
  ConfigProvider.config({
    theme: currentConfig?.perf?.custom || {},
  });
};

window.setRubickThemeMode = (mode: 'dark' | 'light') => {
  document.body.classList.toggle('dark', mode === 'dark');
};

window.changeRubickTheme = () => {
  applyTheme();
};

if (config?.perf?.common?.darkMode) {
  window.setRubickThemeMode('dark');
}

applyTheme();

const app = createApp(App);

app.config.errorHandler = (error, _instance, info) => {
  console.error('[rubick-renderer:vue]', info, error);
};

app
  .use(Button)
  .use(List)
  .use(Spin)
  .use(Input)
  .use(Avatar)
  .use(Tag)
  .use(Row)
  .use(Col)
  .use(Divider)
  .mount('#app');

console.log('[rubick-renderer] mounted');
