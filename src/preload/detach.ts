import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('detachBridge', {
  platform: process.platform,
  sendMessage(type: string, data?: unknown) {
    ipcRenderer.send('msg-trigger', { type, data });
  },
  sendService(type: string) {
    ipcRenderer.send('detach:service', { type });
  },
});
