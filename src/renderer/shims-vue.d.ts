/* eslint-disable */
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module 'main' {
  export function main(): any;
}

declare const __static: string;

declare module 'lodash.throttle';

interface Window {
  rubick: {
    getLocalConfig: () => any;
    setLocalConfig: (config: any) => any;
    showOpenDialogAsync: (options: unknown) => Promise<string[] | undefined>;
    showSaveDialogAsync: (options: unknown) => Promise<string | undefined>;
    getPathForFile: (file: unknown) => string;
    getPathsForFiles: (files: unknown) => string[];
    onHostDrop: (
      cb?: (payload: { files?: string[] }) => void
    ) => void;
    setHostFileDropEnabled: (enabled: boolean) => boolean;
    updateHostDropOverlay: (
      payload:
        | {
            visible: boolean;
            bounds?: {
              x: number;
              y: number;
              width: number;
              height: number;
            };
            message?: string;
            darkMode?: boolean;
          }
        | null
    ) => boolean;
    reportHostDropFiles: (files: string[]) => Promise<boolean>;
    windowMoving: (payload: {
      mouseX: number;
      mouseY: number;
      width: number;
      height: number;
    }) => void;
  } & any;
  market: any;
  tplBridge: any;
  detachBridge: any;
  guideBridge: any;
  setSubInput: ({ placeholder }: { placeholder: string }) => void;
  setSubInputValue: ({ value }: { value: string }) => void;
  removeSubInput: () => void;
  loadPlugin: (plugin: any) => void;
  updatePlugin: (plugin: any) => void;
  initRubick: () => void;
  openRubickMenu: (ext: any) => void;
  changeRubickTheme: () => void;
  setRubickThemeMode: (mode: 'dark' | 'light') => void;
  addLocalStartPlugin: (plugin: any) => void;
  removeLocalStartPlugin: (plugin: any) => void;
  setCurrentPlugin: (plugin: any) => void;
  pluginLoaded: () => void;
  getMainInputInfo: () => any;
  searchFocus: (args: any, strict?: boolean) => any;
  exports: Record<string, any>;
}
