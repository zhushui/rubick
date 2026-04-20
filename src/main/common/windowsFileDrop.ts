import { BrowserWindow } from 'electron';

const WM_DROPFILES = 0x0233;
const WM_COPYDATA = 0x004a;
const WM_COPYGLOBALDATA = 0x0049;
const GW_HWNDNEXT = 2;
const GW_CHILD = 5;
const SUBCLASS_ID = 0x72756269636b;
const MSGFLT_ALLOW = 1;

const toUIntPtr = (value: Buffer | bigint | number) => {
  if (typeof value === 'bigint' || typeof value === 'number') {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    if (process.arch === 'ia32') {
      return value.readUInt32LE(0);
    }
    return value.readBigUInt64LE(0);
  }

  return 0;
};

let DragAcceptFiles:
  | ((windowHandle: Buffer, accept: boolean) => void)
  | undefined;
let DragQueryFileW:
  | ((
      dropHandle: bigint | number,
      index: number,
      targetBuffer: Buffer | null,
      targetBufferLength: number
    ) => number)
  | undefined;
let DragFinish: ((dropHandle: bigint | number) => void) | undefined;
let GetWindow:
  | ((windowHandle: Buffer | object, command: number) => object | null)
  | undefined;
let EnumChildWindows:
  | ((
      parentWindowHandle: Buffer | object,
      callback: object,
      refData: bigint | number
    ) => boolean)
  | undefined;
let GetClassNameW:
  | ((
      windowHandle: Buffer | object,
      classNameBuffer: Buffer,
      maxCount: number
    ) => number)
  | undefined;
let ChangeWindowMessageFilterEx:
  | ((
      windowHandle: Buffer | object,
      message: number,
      action: number,
      changeFilterStruct: null
    ) => boolean)
  | undefined;
let GetWindowLongPtrW:
  | ((windowHandle: Buffer | object, index: number) => bigint | number)
  | undefined;
let IsWindowVisible:
  | ((windowHandle: Buffer | object) => boolean)
  | undefined;
let SetWindowSubclass:
  | ((
      windowHandle: Buffer | object,
      callback: object,
      subclassId: bigint | number,
      refData: bigint | number
    ) => boolean)
  | undefined;
let RemoveWindowSubclass:
  | ((
      windowHandle: Buffer | object,
      callback: object,
      subclassId: bigint | number
    ) => boolean)
  | undefined;
let DefSubclassProc:
  | ((
      windowHandle: Buffer | object,
      message: number,
      wParam: bigint | number,
      lParam: bigint | number
    ) => bigint | number)
  | undefined;
let koffiRef:
  | {
      pointer: (...args: unknown[]) => unknown;
      alias: (...args: unknown[]) => unknown;
      opaque: (...args: unknown[]) => unknown;
      proto: (...args: unknown[]) => unknown;
      register: (...args: unknown[]) => object;
      unregister: (callback: object) => void;
    }
  | undefined;

type WindowDropState = {
  handles: Array<Buffer | object>;
  callback: object;
  onFiles: (files: string[]) => void;
};

const windowDropStates = new WeakMap<BrowserWindow, WindowDropState>();

if (process.platform === 'win32') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const koffi = require('koffi');
  koffiRef = koffi;
  const shell32 = koffi.load('shell32.dll');
  const user32 = koffi.load('user32.dll');
  const comctl32 = koffi.load('comctl32.dll');
  const HANDLE = koffi.pointer('HANDLE', koffi.opaque());
  const HWND = koffi.alias('HWND', HANDLE);
  const EnumChildProc = koffi.proto(
    'bool __stdcall EnumChildProc(HWND hWnd, intptr_t lParam)'
  );
  const SubclassProc = koffi.proto(
    'intptr __stdcall SubclassProc(HWND hWnd, uint32_t uMsg, uintptr_t wParam, intptr_t lParam, uintptr_t uIdSubclass, intptr_t dwRefData)'
  );

  DragAcceptFiles = shell32.func(
    'void __stdcall DragAcceptFiles(HWND hWnd, bool fAccept)'
  );
  DragQueryFileW = shell32.func(
    'uint32 __stdcall DragQueryFileW(uintptr_t hDrop, uint32 iFile, _Out_ uint16_t *lpszFile, uint32 cch)'
  );
  DragFinish = shell32.func('void __stdcall DragFinish(uintptr_t hDrop)');
  GetWindow = user32.func('HWND __stdcall GetWindow(HWND hWnd, uint32 uCmd)');
  EnumChildWindows = user32.func(
    'bool __stdcall EnumChildWindows(HWND hWndParent, EnumChildProc *lpEnumFunc, intptr_t lParam)'
  );
  GetClassNameW = user32.func(
    'int __stdcall GetClassNameW(HWND hWnd, _Out_ uint16_t *lpClassName, int nMaxCount)'
  );
  ChangeWindowMessageFilterEx = user32.func(
    'bool __stdcall ChangeWindowMessageFilterEx(HWND hWnd, uint32 message, uint32 action, void *pChangeFilterStruct)'
  );
  GetWindowLongPtrW = user32.func(
    'intptr __stdcall GetWindowLongPtrW(HWND hWnd, int nIndex)'
  );
  IsWindowVisible = user32.func('bool __stdcall IsWindowVisible(HWND hWnd)');
  SetWindowSubclass = comctl32.func(
    'bool __stdcall SetWindowSubclass(HWND hWnd, SubclassProc *pfnSubclass, uintptr_t uIdSubclass, intptr_t dwRefData)'
  );
  RemoveWindowSubclass = comctl32.func(
    'bool __stdcall RemoveWindowSubclass(HWND hWnd, SubclassProc *pfnSubclass, uintptr_t uIdSubclass)'
  );
  DefSubclassProc = comctl32.func(
    'intptr __stdcall DefSubclassProc(HWND hWnd, uint32_t uMsg, uintptr_t wParam, intptr_t lParam)'
  );
}

const isWindowsHostDropAvailable = () =>
  process.platform === 'win32' &&
  typeof DragAcceptFiles === 'function' &&
  typeof DragQueryFileW === 'function' &&
  typeof DragFinish === 'function';

const GWL_STYLE = -16;
const GWL_EXSTYLE = -20;
const WINDOW_STYLE_FLAGS = [
  [0x80000000, 'WS_POPUP'],
  [0x40000000, 'WS_CHILD'],
  [0x10000000, 'WS_VISIBLE'],
  [0x04000000, 'WS_CLIPSIBLINGS'],
  [0x02000000, 'WS_CLIPCHILDREN'],
  [0x00c00000, 'WS_CAPTION'],
  [0x00080000, 'WS_SYSMENU'],
  [0x00040000, 'WS_THICKFRAME'],
] as const;
const WINDOW_EX_STYLE_FLAGS = [
  [0x00000008, 'WS_EX_TOPMOST'],
  [0x00000010, 'WS_EX_ACCEPTFILES'],
  [0x00000080, 'WS_EX_TOOLWINDOW'],
  [0x00040000, 'WS_EX_APPWINDOW'],
  [0x00080000, 'WS_EX_LAYERED'],
  [0x08000000, 'WS_EX_NOACTIVATE'],
] as const;

const toUInt32 = (value: bigint | number | undefined | null) => {
  if (typeof value === 'bigint') {
    return Number(value & BigInt(0xffffffff));
  }

  return Number(value || 0) >>> 0;
};

const toHex32 = (value: bigint | number | undefined | null) =>
  `0x${toUInt32(value).toString(16).padStart(8, '0')}`;

const getStyleFlagNames = (
  value: bigint | number | undefined | null,
  flags: ReadonlyArray<readonly [number, string]>
) => {
  const nextValue = toUInt32(value);
  return flags
    .filter(([mask]) => (nextValue & mask) === mask)
    .map(([, name]) => name);
};

const getWindowHandleHex = (windowHandle: Buffer | object) =>
  `0x${toUIntPtr(windowHandle as Buffer).toString(16)}`;

const setWindowFileDropEnabled = (
  window: BrowserWindow,
  enabled: boolean
) => {
  if (!isWindowsHostDropAvailable() || window.isDestroyed()) {
    return false;
  }

  const windowHandle = window.getNativeWindowHandle();
  if (enabled) {
    [WM_DROPFILES, WM_COPYDATA, WM_COPYGLOBALDATA].forEach((message) => {
      try {
        ChangeWindowMessageFilterEx?.(
          windowHandle,
          message,
          MSGFLT_ALLOW,
          null
        );
      } catch {
        // Ignore message-filter failures and keep trying DragAcceptFiles.
      }
    });
  }

  DragAcceptFiles?.(windowHandle, enabled);
  return true;
};

const getChildWindowHandles = (windowHandle: Buffer | object) => {
  if (!GetWindow && !EnumChildWindows) {
    return [];
  }

  const handles: Array<Buffer | object> = [];
  const seenHandles = new Set<string>();

  const rememberHandle = (handle: Buffer | object | null | undefined) => {
    if (!handle) {
      return;
    }

    const key =
      typeof handle === 'object'
        ? JSON.stringify(handle, (_key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          )
        : String(handle);

    if (seenHandles.has(key)) {
      return;
    }

    seenHandles.add(key);
    handles.push(handle);
  };

  if (EnumChildWindows && koffiRef) {
    const enumCallback = koffiRef.register(
      (childHandle: Buffer | object) => {
        rememberHandle(childHandle);
        return true;
      },
      'EnumChildProc *'
    );

    try {
      EnumChildWindows(windowHandle, enumCallback, 0);
    } finally {
      koffiRef.unregister(enumCallback);
    }
  }

  const visit = (targetHandle: Buffer | object) => {
    let childHandle = GetWindow?.(targetHandle, GW_CHILD) || null;

    while (childHandle) {
      rememberHandle(childHandle);
      visit(childHandle);
      childHandle = GetWindow?.(childHandle, GW_HWNDNEXT) || null;
    }
  };

  if (GetWindow) {
    visit(windowHandle);
  }

  return handles;
};

const getWindowClassName = (windowHandle: Buffer | object) => {
  if (!GetClassNameW) {
    return '';
  }

  const classNameBuffer = Buffer.alloc(256 * 2);
  const classNameLength = GetClassNameW(windowHandle, classNameBuffer, 256);
  if (!classNameLength) {
    return '';
  }

  return classNameBuffer.toString('utf16le', 0, classNameLength * 2);
};

const describeWindowForDrop = (window: BrowserWindow) => {
  if (window.isDestroyed()) {
    return {
      windowId: window.id,
      destroyed: true,
    };
  }

  const handle = window.getNativeWindowHandle();
  const style = GetWindowLongPtrW?.(handle, GWL_STYLE);
  const exStyle = GetWindowLongPtrW?.(handle, GWL_EXSTYLE);
  const childHandles = getChildWindowHandles(handle);

  return {
    windowId: window.id,
    hwnd: getWindowHandleHex(handle),
    className: getWindowClassName(handle) || 'unknown',
    visible: IsWindowVisible?.(handle) ?? false,
    style: toHex32(style),
    styleFlags: getStyleFlagNames(style, WINDOW_STYLE_FLAGS),
    exStyle: toHex32(exStyle),
    exStyleFlags: getStyleFlagNames(exStyle, WINDOW_EX_STYLE_FLAGS),
    childCount: childHandles.length,
    childClasses: childHandles
      .map((childHandle) => getWindowClassName(childHandle))
      .filter(Boolean),
  };
};

const consumeDroppedFiles = (dropHandle: Buffer | bigint | number) => {
  if (!isWindowsHostDropAvailable()) {
    return [];
  }

  const nativeDropHandle = toUIntPtr(dropHandle);
  try {
    const fileCount = Number(
      DragQueryFileW?.(nativeDropHandle, 0xffffffff, null, 0) || 0
    );
    const nextFiles: string[] = [];

    for (let index = 0; index < fileCount; index += 1) {
      const charLength = Number(
        DragQueryFileW?.(nativeDropHandle, index, null, 0) || 0
      );

      if (!charLength) {
        continue;
      }

      const outputBuffer = Buffer.alloc((charLength + 1) * 2);
      DragQueryFileW?.(
        nativeDropHandle,
        index,
        outputBuffer,
        charLength + 1
      );
      nextFiles.push(outputBuffer.toString('utf16le', 0, charLength * 2));
    }

    return nextFiles;
  } finally {
    DragFinish?.(nativeDropHandle);
  }
};

const disableChildWindowFileDrop = (window: BrowserWindow) => {
  const state = windowDropStates.get(window);
  if (!state) {
    return false;
  }

  state.handles.forEach((handle) => {
    DragAcceptFiles?.(handle as Buffer, false);
    RemoveWindowSubclass?.(handle, state.callback, SUBCLASS_ID);
  });
  koffiRef?.unregister(state.callback);
  windowDropStates.delete(window);
  return true;
};

const enableChildWindowFileDrop = (
  window: BrowserWindow,
  onFiles: (files: string[]) => void
) => {
  if (
    !isWindowsHostDropAvailable() ||
    !koffiRef ||
    !SetWindowSubclass ||
    !RemoveWindowSubclass ||
    !DefSubclassProc ||
    !GetWindow
  ) {
    return false;
  }

  disableChildWindowFileDrop(window);

  const handles = getChildWindowHandles(window.getNativeWindowHandle());
  if (!handles.length) {
    return false;
  }

  const callback = koffiRef.register(
    (
      windowHandle: Buffer | object,
      message: number,
      wParam: bigint | number,
      lParam: bigint | number
    ) => {
      if (message === WM_DROPFILES) {
        const files = consumeDroppedFiles(wParam).filter(Boolean);
        if (files.length) {
          onFiles(files);
          return 0;
        }
      }

      return DefSubclassProc(windowHandle, message, wParam, lParam);
    },
    'SubclassProc *'
  );

  handles.forEach((handle) => {
    DragAcceptFiles?.(handle as Buffer, true);
    SetWindowSubclass(handle, callback, SUBCLASS_ID, 0);
  });

  windowDropStates.set(window, {
    handles,
    callback,
    onFiles,
  });
  return true;
};

export {
  WM_DROPFILES,
  consumeDroppedFiles,
  describeWindowForDrop,
  disableChildWindowFileDrop,
  enableChildWindowFileDrop,
  isWindowsHostDropAvailable,
  setWindowFileDropEnabled,
};
