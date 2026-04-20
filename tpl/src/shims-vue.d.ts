/* eslint-disable */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface Window {
  rubick: any;
  tplBridge: {
    onChangeCurrent: (cb: (delta: number) => void) => () => void;
    send: (channel: string, payload: unknown) => void;
  };
  exports: Record<string, any>;
}
