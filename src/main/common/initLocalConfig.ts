import {
  getConfigStore,
  initConfigStore,
  setConfigStore,
} from '@/common/utils/localConfigStore';

const localConfig = {
  async init(): Promise<any> {
    return initConfigStore();
  },
  async getConfig(): Promise<any> {
    return getConfigStore();
  },

  async setConfig(data) {
    return setConfigStore(data);
  },
};

export default localConfig;
