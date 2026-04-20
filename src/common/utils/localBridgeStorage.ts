import fs from 'fs';
import path from 'path';
import getLocalDataFile from './getLocalDataFile';

const storagePath = path.join(getLocalDataFile(), 'rubick-bridge-storage.json');

const readStorage = (): Record<string, unknown> => {
  try {
    if (!fs.existsSync(storagePath)) {
      return {};
    }
    const content = fs.readFileSync(storagePath, 'utf8');
    return content ? JSON.parse(content) : {};
  } catch {
    return {};
  }
};

const writeStorage = (data: Record<string, unknown>) => {
  fs.writeFileSync(storagePath, JSON.stringify(data));
  return data;
};

const getBridgeStorageItem = (key: string) => {
  const storage = readStorage();
  return key in storage ? storage[key] : null;
};

const setBridgeStorageItem = (key: string, value: unknown) => {
  const storage = readStorage();
  storage[String(key)] = value;
  writeStorage(storage);
  return value;
};

const removeBridgeStorageItem = (key: string) => {
  const storage = readStorage();
  delete storage[String(key)];
  writeStorage(storage);
};

export {
  getBridgeStorageItem,
  setBridgeStorageItem,
  removeBridgeStorageItem,
  storagePath as bridgeStoragePath,
};
