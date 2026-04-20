import { createApp } from 'vue';
import Vue3Lottie from 'vue3-lottie';
import {
  ConfigProvider,
  Button,
  Divider,
  Row,
  Col,
  Dropdown,
  Menu,
  Form,
  Input,
  Radio,
  Typography,
  Select,
  Switch,
  Avatar,
  Popconfirm,
  Collapse,
  List,
  Tooltip,
  Alert,
  Drawer,
  Modal,
  Upload,
  Result,
  Spin,
  Tag,
} from 'ant-design-vue';
import App from './App.vue';
import router from './router';
import store from './store';
import './assets/ant-reset.less';
import 'ant-design-vue/dist/antd.variable.min.css';
import registerI18n from './languages/i18n';
import localConfig from './confOp';

window.addEventListener('error', (event) => {
  console.error(
    '[feature-renderer:error]',
    event.error?.stack || event.message || event.filename
  );
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[feature-renderer:unhandledrejection]', event.reason);
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
  console.error('[feature-renderer:vue]', info, error);
};

app
  .use(registerI18n)
  .use(store)
  .use(Button)
  .use(Divider)
  .use(Row)
  .use(Col)
  .use(Dropdown)
  .use(Menu)
  .use(Form)
  .use(Input)
  .use(Radio)
  .use(Select)
  .use(Switch)
  .use(Avatar)
  .use(Collapse)
  .use(List)
  .use(Tooltip)
  .use(Alert)
  .use(Drawer)
  .use(Modal)
  .use(Result)
  .use(Spin)
  .use(Tag)
  .use(Upload)
  .use(Popconfirm)
  .use(Typography)
  .use(router)
  .use(Vue3Lottie)
  .mount('#app');

console.log('[feature-renderer] mounted');
