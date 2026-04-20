/* eslint-disable */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'axios'

interface Window {
  rubick: {
    onHostDrop: (cb?: (payload: { files?: string[] }) => void) => void;
    onHostDropState: (
      cb?: (payload: {
        phase?: 'drag-enter' | 'drag-over' | 'drag-leave' | 'drop';
        inside?: boolean;
        active?: boolean;
      }) => void
    ) => void;
    onHostDropTargetState: (
      cb?: (payload: {
        phase?: 'drag-enter' | 'drag-over' | 'drag-leave' | 'drop';
        inside?: boolean;
        active?: boolean;
      }) => void
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
    updateHostDropTarget: (
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
  } & any;
  changeRubickTheme: () => void;
  setRubickThemeMode: (mode: 'dark' | 'light') => void;
  market: {
    getLocalPlugins: () => any;
    downloadPlugin: (plugin: any) => any;
    deletePlugin: (plugin: any) => any;
    refreshPlugin: (plugin: any) => any;
    addLocalStartPlugin: (plugin: any) => any;
    removeLocalStartPlugin: (plugin: any) => any;
    dbDump: (target: any) => any;
    dbImport: (target: any) => any;
    reRegister: () => void;
  }
}

namespace Market {
  interface Plugin {
    isdownload?: boolean;
    name?: string;
    isloading: boolean
  }
}
