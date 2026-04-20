import { useFeatureStore } from './index';

const useStore = () => {
  const store = useFeatureStore();
  return {
    get state() {
      return store.$state;
    },
    commit(type: string, payload: unknown) {
      if (type === 'commonUpdate') {
        store.commonUpdate(payload);
      }
      if (type === 'setSearchValue') {
        store.setSearchValue(payload);
      }
    },
    dispatch(type: string, payload?: unknown) {
      return store[type](payload);
    },
  };
};

export { useStore };
