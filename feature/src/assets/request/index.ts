import axios from 'axios';

const DEFAULT_BASE_URL = 'https://gitee.com/monkeyWang/rubickdatabase/raw/master';

const getRequestConfig = async () => {
  try {
    const dbdata = await window.rubick.db.get('rubick-localhost-config');
    return {
      baseURL: dbdata?.data?.database || DEFAULT_BASE_URL,
      accessToken: dbdata?.data?.access_token || '',
    };
  } catch {
    return {
      baseURL: DEFAULT_BASE_URL,
      accessToken: '',
    };
  }
};

const createRequestInstance = async () => {
  const { baseURL, accessToken } = await getRequestConfig();
  return {
    accessToken,
    instance: axios.create({
      timeout: 4000,
      baseURL,
    }),
  };
};

export default {
  async getTotalPlugins() {
    const { accessToken, instance } = await createRequestInstance();
    let targetPath = 'plugins/total-plugins.json';
    if (accessToken) {
      targetPath = `${encodeURIComponent(
        targetPath
      )}?access_token=${accessToken}&ref=master`;
    }
    const res = await instance.get(targetPath);
    console.log('total plugsin', res);
    return res.data;
  },

  async getFinderDetail() {
    const { accessToken, instance } = await createRequestInstance();
    let targetPath = 'plugins/finder.json';
    if (accessToken) {
      targetPath = `${encodeURIComponent(
        targetPath
      )}?access_token=${accessToken}&ref=master`;
    }
    const res = await instance.get(targetPath);
    return res.data;
  },

  async getSystemDetail() {
    const { accessToken, instance } = await createRequestInstance();
    let targetPath = 'plugins/system.json';
    if (accessToken) {
      targetPath = `${encodeURIComponent(
        targetPath
      )}?access_token=${accessToken}&ref=master`;
    }
    const res = await instance.get(targetPath);
    return res.data;
  },
  async getWorkerDetail() {
    const { accessToken, instance } = await createRequestInstance();
    let targetPath = 'plugins/worker.json';
    if (accessToken) {
      targetPath = `${encodeURIComponent(
        targetPath
      )}?access_token=${accessToken}&ref=master`;
    }
    const res = await instance.get(targetPath);
    return res.data;
  },

  async getPluginDetail(url: string) {
    const { instance } = await createRequestInstance();
    const res = await instance.get(url);
    return res.data;
  },

  async getSearchDetail() {
    const { accessToken, instance } = await createRequestInstance();
    let targetPath = 'plugins/search.json';
    if (accessToken) {
      targetPath = `${encodeURIComponent(
        targetPath
      )}?access_token=${accessToken}&ref=master`;
    }
    const res = await instance.get(targetPath);
    return res.data;
  },
  async getDevDetail() {
    const { accessToken, instance } = await createRequestInstance();
    let targetPath = 'plugins/dev.json';
    if (accessToken) {
      targetPath = `${encodeURIComponent(
        targetPath
      )}?access_token=${accessToken}&ref=master`;
    }
    const res = await instance.get(targetPath);
    return res.data;
  },
  async getImageDetail() {
    const { accessToken, instance } = await createRequestInstance();
    let targetPath = 'plugins/image.json';
    if (accessToken) {
      targetPath = `${encodeURIComponent(
        targetPath
      )}?access_token=${accessToken}&ref=master`;
    }
    const res = await instance.get(targetPath);
    return res.data;
  },
};
