import { contextBridge, ipcRenderer } from 'electron';
import {
  createRubickBridge,
  registerIpcListener,
} from './shared/createRubickBridge';

contextBridge.exposeInMainWorld('rubick', createRubickBridge());

contextBridge.exposeInMainWorld('tplBridge', {
  onChangeCurrent(cb: (delta: number) => void) {
    return registerIpcListener('changeCurrent', cb);
  },
  send(channel: string, payload: unknown) {
    ipcRenderer.send(channel, payload);
  },
});
