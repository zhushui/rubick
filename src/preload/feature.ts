import { contextBridge } from 'electron';
import { ipcRenderer } from 'electron';
import {
  createRubickBridge,
  ipcSendAsync,
  ipcSendSync,
} from './shared/createRubickBridge';

const toSerializable = <T>(value: T, seen = new WeakMap<object, unknown>()): T => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'function' || typeof value === 'symbol') {
    return undefined as T;
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (seen.has(value as object)) {
    return seen.get(value as object) as T;
  }

  if (Array.isArray(value)) {
    const clonedArray: unknown[] = [];
    seen.set(value, clonedArray);
    value.forEach((item) => {
      clonedArray.push(toSerializable(item, seen));
    });
    return clonedArray as T;
  }

  const clonedObject: Record<string, unknown> = {};
  seen.set(value as object, clonedObject);

  Object.keys(value as Record<string, unknown>).forEach((key) => {
    const nextValue = toSerializable(
      (value as Record<string, unknown>)[key],
      seen
    );

    if (nextValue !== undefined) {
      clonedObject[key] = nextValue;
    }
  });

  return clonedObject as T;
};

contextBridge.exposeInMainWorld('rubick', createRubickBridge());

contextBridge.exposeInMainWorld('market', {
  getLocalPlugins() {
    return ipcSendSync('getLocalPlugins');
  },
  downloadPlugin(plugin: unknown) {
    return ipcSendAsync('downloadPlugin', {
      plugin: toSerializable(plugin),
    });
  },
  deletePlugin(plugin: unknown) {
    return ipcSendAsync('deletePlugin', {
      plugin: toSerializable(plugin),
    });
  },
  refreshPlugin(plugin: unknown) {
    return ipcSendSync('refreshPlugin', {
      plugin: toSerializable(plugin),
    });
  },
  addLocalStartPlugin(plugin: unknown) {
    return ipcSendSync('addLocalStartPlugin', {
      plugin: toSerializable(plugin),
    });
  },
  removeLocalStartPlugin(plugin: unknown) {
    return ipcSendSync('removeLocalStartPlugin', {
      plugin: toSerializable(plugin),
    });
  },
  dbDump(target: unknown) {
    return ipcSendAsync('dbDump', {
      target: toSerializable(target),
    });
  },
  dbImport(target: unknown) {
    return ipcSendAsync('dbImport', {
      target: toSerializable(target),
    });
  },
  reRegister() {
    ipcRenderer.send('re-register');
  },
});
