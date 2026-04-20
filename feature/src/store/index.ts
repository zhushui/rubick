import { createPinia, defineStore } from 'pinia';
import request from '@/assets/request';

const isDownload = (item: Market.Plugin, targets: any[]) => {
  let downloaded = false;
  targets.some((plugin) => {
    if (plugin.name === item.name) {
      downloaded = true;
    }
    return downloaded;
  });
  return downloaded;
};

const LOCAL_PLUGIN_JSON = 'localPluginJson';

const parseLocalPlugins = (rawValue: unknown) => {
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('[feature-market:local-plugin-json]', error);
    return [];
  }
};

const pinia = createPinia();

export const useFeatureStore = defineStore('feature', {
  state: () => ({
    totalPlugins: [] as any[],
    localPlugins: [] as any[],
    searchValue: '',
    active: ['finder'] as string[],
  }),
  actions: {
    commonUpdate(payload) {
      Object.keys(payload).forEach((key) => {
        this[key] = payload[key];
      });
    },
    setSearchValue(payload) {
      this.searchValue = payload;
    },
    async saveLocalPlugins(plugins) {
      await window.rubick.db.remove(LOCAL_PLUGIN_JSON);
      await window.rubick.db.put({
        _id: LOCAL_PLUGIN_JSON,
        data: JSON.stringify(plugins),
      });
      await this.init();
    },
    async deleteLocalPlugins() {
      await window.rubick.db.remove(LOCAL_PLUGIN_JSON);
      await this.init();
    },
    async init() {
      let totalPluginList = [];
      let localPluginJson = null;
      let localPlugins = [];

      try {
        totalPluginList = await request.getTotalPlugins();
      } catch (error) {
        console.error('[feature-market:total-plugins]', error);
      }

      try {
        localPluginJson = await window.rubick.db.get(LOCAL_PLUGIN_JSON);
      } catch (error) {
        console.error('[feature-market:db-local-plugins]', error);
      }

      try {
        localPlugins = window.market.getLocalPlugins();
      } catch (error) {
        console.error('[feature-market:get-local-plugins]', error);
      }

      const totalPlugins = totalPluginList.concat(
        parseLocalPlugins(localPluginJson?.data)
      );

      totalPlugins.forEach((origin: Market.Plugin) => {
        origin.isdownload = isDownload(origin, localPlugins);
        origin.isloading = false;
      });

      localPlugins.forEach((origin: Market.Plugin) => {
        origin.isloading = false;
      });

      this.commonUpdate({
        localPlugins,
        totalPlugins,
      });
    },
    startDownload(name) {
      const totalPlugins = JSON.parse(JSON.stringify(this.totalPlugins));
      totalPlugins.forEach((origin: Market.Plugin) => {
        if (origin.name === name) {
          origin.isloading = true;
        }
      });
      this.commonUpdate({
        totalPlugins,
      });
    },
    errorDownload(name) {
      const totalPlugins = JSON.parse(JSON.stringify(this.totalPlugins));
      totalPlugins.forEach((origin: Market.Plugin) => {
        if (origin.name === name) {
          origin.isloading = false;
        }
      });
      this.commonUpdate({
        totalPlugins,
      });
    },
    startUnDownload(name) {
      const localPlugins = window.market.getLocalPlugins();
      localPlugins.forEach((origin: Market.Plugin) => {
        if (origin.name === name) {
          origin.isloading = true;
        }
      });
      this.commonUpdate({
        localPlugins,
      });
    },
    errorUnDownload(name) {
      const localPlugins = window.market.getLocalPlugins();
      localPlugins.forEach((origin: Market.Plugin) => {
        if (origin.name === name) {
          origin.isloading = false;
        }
      });

      this.commonUpdate({
        localPlugins,
      });
    },
    successDownload(name) {
      const totalPlugins = JSON.parse(JSON.stringify(this.totalPlugins));
      totalPlugins.forEach((origin: Market.Plugin) => {
        if (origin.name === name) {
          origin.isloading = false;
          origin.isdownload = true;
        }
      });
      const localPlugins = window.market.getLocalPlugins();

      this.commonUpdate({
        totalPlugins,
        localPlugins,
      });
    },
    async updateLocalPlugin() {
      let localPlugins = [];
      let totalPlugins = [];

      try {
        localPlugins = window.market.getLocalPlugins();
      } catch (error) {
        console.error('[feature-market:update-local-plugins]', error);
      }

      try {
        totalPlugins = await request.getTotalPlugins();
      } catch (error) {
        console.error('[feature-market:update-total-plugins]', error);
      }

      totalPlugins.forEach((origin: Market.Plugin) => {
        origin.isdownload = isDownload(origin, localPlugins);
        origin.isloading = false;
      });

      this.commonUpdate({
        localPlugins,
        totalPlugins,
      });
    },
  },
});

export default pinia;
