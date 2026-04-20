import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('guideBridge', {
  close() {
    ipcRenderer.send('guide:service', { type: 'close' });
  },
});
