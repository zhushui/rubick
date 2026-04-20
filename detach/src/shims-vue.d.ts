/* eslint-disable */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface Window {
  detachBridge: {
    platform: string;
    sendMessage: (type: string, data?: unknown) => void;
    sendService: (type: string) => void;
  };
  initDetach: (pluginInfo: any) => void;
  setSubInputValue: ({ value }: { value: string }) => void;
  setSubInput: (placeholder: string) => void;
  removeSubInput: () => void;
  enterFullScreenTrigger: () => void;
  leaveFullScreenTrigger: () => void;
  maximizeTrigger: () => void;
  unmaximizeTrigger: () => void;
}
