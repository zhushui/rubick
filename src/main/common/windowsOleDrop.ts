import { BrowserWindow } from 'electron';

const S_OK = 0;
const S_FALSE = 1;
const E_FAIL = -2147467259;
const E_NOINTERFACE = -2147467262;
const DRAGDROP_E_NOTREGISTERED = -2147221248;
const CF_HDROP = 15;
const DVASPECT_CONTENT = 1;
const TYMED_HGLOBAL = 1;
const DROPEFFECT_NONE = 0;
const DROPEFFECT_COPY = 1;
const IID_IUNKNOWN = '00000000-0000-0000-c000-000000000046';
const IID_IDROPTARGET = '00000122-0000-0000-c000-000000000046';

type OleDropState = {
  objectPtr: unknown;
  refCount: number;
  onEvent: (event: OleDropEvent) => boolean | void;
  pendingFiles: string[];
  pendingPoint?: OleDropPoint;
  pendingAccepted: boolean;
  registered: boolean;
  window: BrowserWindow;
};

type OleDropDebugInfo = {
  enabled: boolean;
  reason: string;
  detail?: string;
  hr?: string;
};

type OleDropPoint = {
  x: number;
  y: number;
};

type OleDropEvent = {
  phase: 'drag-enter' | 'drag-over' | 'drag-leave' | 'drop';
  files: string[];
  point?: OleDropPoint;
  window: BrowserWindow;
};

let koffiRef:
  | {
      alloc: (...args: unknown[]) => unknown;
      decode: (...args: unknown[]) => any;
      encode: (...args: unknown[]) => void;
      address: (value: unknown) => bigint;
      load: (libraryName: string) => {
        func: (declaration: string) => (...args: unknown[]) => any;
      };
      proto: (...args: unknown[]) => unknown;
      register: (...args: unknown[]) => unknown;
      unregister: (callback: unknown) => void;
      pointer: (...args: unknown[]) => unknown;
      alias: (...args: unknown[]) => unknown;
      opaque: (...args: unknown[]) => unknown;
      struct: (...args: unknown[]) => unknown;
      union: (...args: unknown[]) => unknown;
      array: (...args: unknown[]) => unknown;
      call: (...args: unknown[]) => any;
      free: (value: unknown) => void;
    }
  | undefined;

let RegisterDragDrop:
  | ((windowHandle: bigint | number, dropTarget: unknown) => number)
  | undefined;
let RevokeDragDrop: ((windowHandle: bigint | number) => number) | undefined;
let OleInitialize: ((reserved: unknown) => number) | undefined;
let ReleaseStgMedium: ((medium: unknown) => void) | undefined;
let DragQueryFileW:
  | ((
      dropHandle: unknown,
      index: number,
      targetBuffer: Buffer | null,
      targetBufferLength: number
    ) => number)
  | undefined;

let IDropTarget: unknown;
let IDataObject: unknown;
let GUID: unknown;
let POINTL: unknown;
let FORMATETC: unknown;
let STGMEDIUM: unknown;
let IDataObjectVtbl: unknown;
let GetDataProc: unknown;
let dropTargetVTablePtr: unknown;
let queryInterfaceCallback: unknown;
let addRefCallback: unknown;
let releaseCallback: unknown;
let dragEnterCallback: unknown;
let dragOverCallback: unknown;
let dragLeaveCallback: unknown;
let dropCallback: unknown;
let oleAvailable = false;
let oleInitialized = false;

const oleDropStates = new WeakMap<BrowserWindow, OleDropState>();
const oleDropStatesByAddress = new Map<string, OleDropState>();
const oleDropDebugStates = new WeakMap<BrowserWindow, OleDropDebugInfo>();
let oleGlobalDebugInfo: OleDropDebugInfo = {
  enabled: false,
  reason: 'uninitialized',
};

const hresultHex = (value: number) => `0x${(value >>> 0).toString(16)}`;

const toNativeIntPtr = (value: Buffer | bigint | number) => {
  if (typeof value === 'bigint' || typeof value === 'number') {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    if (process.arch === 'ia32') {
      return value.readUInt32LE(0);
    }
    return Number(value.readBigUInt64LE(0));
  }

  return 0;
};

const logOleDropError = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[windows-ole-drop]', ...args);
  }
};

const setOleGlobalDebugInfo = (info: OleDropDebugInfo) => {
  oleGlobalDebugInfo = info;
};

const setOleWindowDebugInfo = (
  window: BrowserWindow,
  info: OleDropDebugInfo
) => {
  oleDropDebugStates.set(window, info);
};

const getOleWindowFileDropDebugInfo = (window: BrowserWindow) =>
  oleDropDebugStates.get(window) || oleGlobalDebugInfo;

const normalizeOlePoint = (pointValue: unknown): OleDropPoint | undefined => {
  if (!pointValue || typeof pointValue !== 'object') {
    return undefined;
  }

  const x = Number((pointValue as { x?: number }).x);
  const y = Number((pointValue as { y?: number }).y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return undefined;
  }

  return { x, y };
};

const getStateFromPtr = (pointerValue: unknown) => {
  if (!koffiRef || !pointerValue) {
    return undefined;
  }

  try {
    return oleDropStatesByAddress.get(koffiRef.address(pointerValue).toString());
  } catch {
    return undefined;
  }
};

const formatGuid = (guid: {
  Data1?: number;
  Data2?: number;
  Data3?: number;
  Data4?: Uint8Array;
}) => {
  const data4 = Array.from(guid?.Data4 || []);
  const hex = (value: number, length: number) =>
    value.toString(16).padStart(length, '0');

  return [
    hex(guid?.Data1 || 0, 8),
    hex(guid?.Data2 || 0, 4),
    hex(guid?.Data3 || 0, 4),
    `${hex(data4[0] || 0, 2)}${hex(data4[1] || 0, 2)}`,
    data4
      .slice(2)
      .map((value) => hex(value, 2))
      .join(''),
  ]
    .join('-')
    .toLowerCase();
};

const readDropHandleFiles = (dropHandle: unknown) => {
  if (!DragQueryFileW) {
    return [];
  }

  const fileCount = Number(DragQueryFileW(dropHandle, 0xffffffff, null, 0) || 0);
  const files: string[] = [];

  for (let index = 0; index < fileCount; index += 1) {
    const charLength = Number(DragQueryFileW(dropHandle, index, null, 0) || 0);
    if (!charLength) {
      continue;
    }

    const outputBuffer = Buffer.alloc((charLength + 1) * 2);
    DragQueryFileW(dropHandle, index, outputBuffer, charLength + 1);
    files.push(outputBuffer.toString('utf16le', 0, charLength * 2));
  }

  return files;
};

const extractDataObjectFiles = (dataObjectPtr: unknown) => {
  if (
    !koffiRef ||
    !dataObjectPtr ||
    !IDataObject ||
    !IDataObjectVtbl ||
    !FORMATETC ||
    !STGMEDIUM ||
    !GetDataProc ||
    !ReleaseStgMedium
  ) {
    return [];
  }

  try {
    const dataObject = koffiRef.decode(dataObjectPtr, IDataObject);
    const vtable = koffiRef.decode(dataObject.lpVtbl, IDataObjectVtbl);
    if (!vtable?.GetData) {
      return [];
    }

    const formatEtcPtr = koffiRef.alloc(FORMATETC, 1);
    const mediumPtr = koffiRef.alloc(STGMEDIUM, 1);

    koffiRef.encode(formatEtcPtr, FORMATETC, {
      cfFormat: CF_HDROP,
      ptd: null,
      dwAspect: DVASPECT_CONTENT,
      lindex: -1,
      tymed: TYMED_HGLOBAL,
    });

    const hr = koffiRef.call(
      vtable.GetData,
      GetDataProc,
      dataObjectPtr,
      formatEtcPtr,
      mediumPtr
    );

    if (hr < 0) {
      return [];
    }

    try {
      const medium = koffiRef.decode(mediumPtr, STGMEDIUM);
      if (Number(medium?.tymed || 0) !== TYMED_HGLOBAL) {
        return [];
      }

      const dropHandle = medium?.u?.hGlobal;
      if (!dropHandle) {
        return [];
      }

      return readDropHandleFiles(dropHandle).filter(Boolean);
    } finally {
      ReleaseStgMedium(mediumPtr);
    }
  } catch (error) {
    logOleDropError('extract:error', error);
    return [];
  }
};

const writeDropEffect = (effectPtr: unknown, effect: number) => {
  if (!koffiRef || !effectPtr) {
    return;
  }

  try {
    koffiRef.encode(effectPtr, 'uint32', effect);
  } catch {
    // ignore effect write failures
  }
};

const ensureNativeBindings = () => {
  if (process.platform !== 'win32' || !koffiRef) {
    return false;
  }

  if (RegisterDragDrop && RevokeDragDrop && OleInitialize && ReleaseStgMedium) {
    return true;
  }

  try {
    const ole32 = koffiRef.load('ole32.dll');
    const shell32 = koffiRef.load('shell32.dll');
    GUID = koffiRef.struct('WindowsOleDropGUID', {
      Data1: 'uint32',
      Data2: 'uint16',
      Data3: 'uint16',
      Data4: koffiRef.array('uint8', 8),
    });
    POINTL = koffiRef.struct('WindowsOleDropPOINTL', {
      x: 'int32',
      y: 'int32',
    });
    FORMATETC = koffiRef.struct('WindowsOleDropFORMATETC', {
      cfFormat: 'uint16',
      ptd: 'void *',
      dwAspect: 'uint32',
      lindex: 'int32',
      tymed: 'uint32',
    });
    const STGMEDIUMUnion = koffiRef.union('WindowsOleDropSTGMEDIUMUnion', {
      hBitmap: 'void *',
      hMetaFilePict: 'void *',
      hEnhMetaFile: 'void *',
      hGlobal: 'void *',
      lpszFileName: 'void *',
      pstm: 'void *',
      pstg: 'void *',
    });
    STGMEDIUM = koffiRef.struct('WindowsOleDropSTGMEDIUM', {
      tymed: 'uint32',
      u: STGMEDIUMUnion,
      pUnkForRelease: 'void *',
    });

    IDropTarget = koffiRef.opaque('WindowsOleDropIDropTarget');
    IDataObject = koffiRef.opaque('WindowsOleDropIDataObject');

    const QueryInterfaceProc = koffiRef.proto(
      '__stdcall',
      'WindowsOleDropQueryInterfaceProc',
      'int32',
      ['WindowsOleDropIDropTarget *', 'const WindowsOleDropGUID *', 'void **']
    );
    const AddRefProc = koffiRef.proto(
      '__stdcall',
      'WindowsOleDropAddRefProc',
      'uint32',
      ['WindowsOleDropIDropTarget *']
    );
    const ReleaseProc = koffiRef.proto(
      '__stdcall',
      'WindowsOleDropReleaseProc',
      'uint32',
      ['WindowsOleDropIDropTarget *']
    );
    const DragEnterProc = koffiRef.proto(
      '__stdcall',
      'WindowsOleDropDragEnterProc',
      'int32',
      [
        'WindowsOleDropIDropTarget *',
        'WindowsOleDropIDataObject *',
        'uint32',
        POINTL,
        'uint32 *',
      ]
    );
    const DragOverProc = koffiRef.proto(
      '__stdcall',
      'WindowsOleDropDragOverProc',
      'int32',
      ['WindowsOleDropIDropTarget *', 'uint32', POINTL, 'uint32 *']
    );
    const DragLeaveProc = koffiRef.proto(
      '__stdcall',
      'WindowsOleDropDragLeaveProc',
      'int32',
      ['WindowsOleDropIDropTarget *']
    );
    const DropProc = koffiRef.proto(
      '__stdcall',
      'WindowsOleDropDropProc',
      'int32',
      [
        'WindowsOleDropIDropTarget *',
        'WindowsOleDropIDataObject *',
        'uint32',
        POINTL,
        'uint32 *',
      ]
    );
    GetDataProc = koffiRef.proto(
      '__stdcall',
      'WindowsOleDropGetDataProc',
      'int32',
      [
        'WindowsOleDropIDataObject *',
        'const WindowsOleDropFORMATETC *',
        'WindowsOleDropSTGMEDIUM *',
      ]
    );

    const IDropTargetVtbl = koffiRef.struct('WindowsOleDropIDropTargetVtbl', {
      QueryInterface: koffiRef.pointer(QueryInterfaceProc),
      AddRef: koffiRef.pointer(AddRefProc),
      Release: koffiRef.pointer(ReleaseProc),
      DragEnter: koffiRef.pointer(DragEnterProc),
      DragOver: koffiRef.pointer(DragOverProc),
      DragLeave: koffiRef.pointer(DragLeaveProc),
      Drop: koffiRef.pointer(DropProc),
    });
    IDataObjectVtbl = koffiRef.struct('WindowsOleDropIDataObjectVtbl', {
      QueryInterface: 'void *',
      AddRef: 'void *',
      Release: 'void *',
      GetData: koffiRef.pointer(GetDataProc),
      GetDataHere: 'void *',
      QueryGetData: 'void *',
      GetCanonicalFormatEtc: 'void *',
      SetData: 'void *',
      EnumFormatEtc: 'void *',
      DAdvise: 'void *',
      DUnadvise: 'void *',
      EnumDAdvise: 'void *',
    });

    koffiRef.struct(IDropTarget, {
      lpVtbl: 'WindowsOleDropIDropTargetVtbl *',
    });
    koffiRef.struct(IDataObject, {
      lpVtbl: 'WindowsOleDropIDataObjectVtbl *',
    });

    queryInterfaceCallback = koffiRef.register(
      (selfPtr: unknown, iidPtr: unknown, outPtr: unknown) => {
        const state = getStateFromPtr(selfPtr);
        if (!state) {
          return E_FAIL;
        }

        try {
          const iid = formatGuid(koffiRef?.decode(iidPtr, GUID) || {});
          if (iid === IID_IUNKNOWN || iid === IID_IDROPTARGET) {
            state.refCount += 1;
            koffiRef?.encode(outPtr, 'void *', selfPtr);
            return S_OK;
          }

          koffiRef?.encode(outPtr, 'void *', null);
          return E_NOINTERFACE;
        } catch (error) {
          logOleDropError('query-interface:error', error);
          return E_FAIL;
        }
      },
      koffiRef.pointer(QueryInterfaceProc)
    );
    addRefCallback = koffiRef.register(
      (selfPtr: unknown) => {
        const state = getStateFromPtr(selfPtr);
        if (!state) {
          return 0;
        }

        state.refCount += 1;
        return state.refCount;
      },
      koffiRef.pointer(AddRefProc)
    );
    releaseCallback = koffiRef.register(
      (selfPtr: unknown) => {
        const state = getStateFromPtr(selfPtr);
        if (!state) {
          return 0;
        }

        state.refCount = Math.max(0, state.refCount - 1);
        return state.refCount;
      },
      koffiRef.pointer(ReleaseProc)
    );
    dragEnterCallback = koffiRef.register(
      (selfPtr: unknown, dataObjectPtr: unknown, _keyState: number, pointValue: unknown, effectPtr: unknown) => {
        const state = getStateFromPtr(selfPtr);
        if (!state) {
          writeDropEffect(effectPtr, DROPEFFECT_NONE);
          return E_FAIL;
        }

        const files = extractDataObjectFiles(dataObjectPtr);
        const point = normalizeOlePoint(pointValue);
        state.pendingFiles = files;
        state.pendingPoint = point;
        state.pendingAccepted =
          !!files.length &&
          state.onEvent({
            phase: 'drag-enter',
            files,
            point,
            window: state.window,
          }) !== false;
        writeDropEffect(
          effectPtr,
          state.pendingAccepted ? DROPEFFECT_COPY : DROPEFFECT_NONE
        );
        return S_OK;
      },
      koffiRef.pointer(DragEnterProc)
    );
    dragOverCallback = koffiRef.register(
      (selfPtr: unknown, _keyState: number, pointValue: unknown, effectPtr: unknown) => {
        const state = getStateFromPtr(selfPtr);
        if (!state) {
          writeDropEffect(effectPtr, DROPEFFECT_NONE);
          return S_OK;
        }

        const point = normalizeOlePoint(pointValue);
        state.pendingPoint = point;
        state.pendingAccepted =
          !!state.pendingFiles.length &&
          state.onEvent({
            phase: 'drag-over',
            files: state.pendingFiles,
            point,
            window: state.window,
          }) !== false;
        writeDropEffect(
          effectPtr,
          state.pendingAccepted ? DROPEFFECT_COPY : DROPEFFECT_NONE
        );
        return S_OK;
      },
      koffiRef.pointer(DragOverProc)
    );
    dragLeaveCallback = koffiRef.register(
      (selfPtr: unknown) => {
        const state = getStateFromPtr(selfPtr);
        if (state) {
          state.onEvent({
            phase: 'drag-leave',
            files: state.pendingFiles,
            point: state.pendingPoint,
            window: state.window,
          });
          state.pendingFiles = [];
          state.pendingPoint = undefined;
          state.pendingAccepted = false;
        }
        return S_OK;
      },
      koffiRef.pointer(DragLeaveProc)
    );
    dropCallback = koffiRef.register(
      (selfPtr: unknown, dataObjectPtr: unknown, _keyState: number, pointValue: unknown, effectPtr: unknown) => {
        const state = getStateFromPtr(selfPtr);
        if (!state) {
          writeDropEffect(effectPtr, DROPEFFECT_NONE);
          return E_FAIL;
        }

        const files = extractDataObjectFiles(dataObjectPtr).filter(Boolean);
        const point = normalizeOlePoint(pointValue);
        const accepted =
          !!files.length &&
          state.onEvent({
            phase: 'drop',
            files,
            point,
            window: state.window,
          }) !== false;
        state.pendingFiles = [];
        state.pendingPoint = undefined;
        state.pendingAccepted = false;
        writeDropEffect(effectPtr, accepted ? DROPEFFECT_COPY : DROPEFFECT_NONE);
        return S_OK;
      },
      koffiRef.pointer(DropProc)
    );

    dropTargetVTablePtr = koffiRef.alloc(IDropTargetVtbl, 1);
    koffiRef.encode(dropTargetVTablePtr, IDropTargetVtbl, {
      QueryInterface: queryInterfaceCallback,
      AddRef: addRefCallback,
      Release: releaseCallback,
      DragEnter: dragEnterCallback,
      DragOver: dragOverCallback,
      DragLeave: dragLeaveCallback,
      Drop: dropCallback,
    });

    RegisterDragDrop = ole32.func(
      'int32 __stdcall RegisterDragDrop(intptr hwnd, WindowsOleDropIDropTarget *dropTarget)'
    );
    RevokeDragDrop = ole32.func('int32 __stdcall RevokeDragDrop(intptr hwnd)');
    OleInitialize = ole32.func('int32 __stdcall OleInitialize(void *pvReserved)');
    ReleaseStgMedium = ole32.func(
      'void __stdcall ReleaseStgMedium(WindowsOleDropSTGMEDIUM *pmedium)'
    );
    DragQueryFileW = shell32.func(
      'uint32 __stdcall DragQueryFileW(void *hDrop, uint32 iFile, _Out_ uint16_t *lpszFile, uint32 cch)'
    );

    return true;
  } catch (error) {
    setOleGlobalDebugInfo({
      enabled: false,
      reason: 'bindings-init-exception',
      detail: error instanceof Error ? error.message : String(error),
    });
    logOleDropError('bindings-init:exception', error);
    return false;
  }
};

const ensureOleReady = () => {
  if (oleInitialized) {
    return oleAvailable;
  }

  oleInitialized = true;

  if (process.platform !== 'win32') {
    oleAvailable = false;
    setOleGlobalDebugInfo({
      enabled: false,
      reason: 'platform-unsupported',
      detail: process.platform,
    });
    return false;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const koffi = require('koffi');
    koffiRef = koffi;
  } catch (error) {
    oleAvailable = false;
    setOleGlobalDebugInfo({
      enabled: false,
      reason: 'koffi-require-failed',
      detail: error instanceof Error ? error.message : String(error),
    });
    logOleDropError('koffi:require:error', error);
    return false;
  }

  if (!ensureNativeBindings()) {
    oleAvailable = false;
    const previousDebugInfo = oleGlobalDebugInfo;
    setOleGlobalDebugInfo({
      enabled: false,
      reason: 'bindings-unavailable',
      detail:
        previousDebugInfo.reason === 'uninitialized'
          ? undefined
          : [
              previousDebugInfo.reason,
              previousDebugInfo.detail,
            ]
              .filter(Boolean)
              .join(': '),
      hr: previousDebugInfo.hr,
    });
    return false;
  }

  const hr = OleInitialize?.(null) ?? E_FAIL;
  oleAvailable = hr === S_OK || hr === S_FALSE;
  if (!oleAvailable) {
    setOleGlobalDebugInfo({
      enabled: false,
      reason: 'ole-initialize-failed',
      hr: hresultHex(hr),
    });
    logOleDropError('ole-initialize:error', hresultHex(hr));
  } else {
    setOleGlobalDebugInfo({
      enabled: true,
      reason: 'ready',
      hr: hresultHex(hr),
    });
  }

  return oleAvailable;
};

const createDropTargetState = (
  window: BrowserWindow,
  onEvent: (event: OleDropEvent) => boolean | void
) => {
  if (!koffiRef || !IDropTarget) {
    return undefined;
  }

  const objectPtr = koffiRef.alloc(IDropTarget, 1);
  koffiRef.encode(objectPtr, IDropTarget, {
    lpVtbl: dropTargetVTablePtr,
  });

  const state: OleDropState = {
    objectPtr,
    refCount: 1,
    onEvent,
    pendingFiles: [],
    pendingPoint: undefined,
    pendingAccepted: false,
    registered: false,
    window,
  };

  oleDropStates.set(window, state);
  oleDropStatesByAddress.set(koffiRef.address(objectPtr).toString(), state);
  return state;
};

const disableOleWindowFileDrop = (window: BrowserWindow) => {
  const state = oleDropStates.get(window);
  if (!state) {
    return false;
  }

  try {
    const hr =
      RevokeDragDrop?.(toNativeIntPtr(window.getNativeWindowHandle())) ??
      DRAGDROP_E_NOTREGISTERED;
    if (process.env.NODE_ENV !== 'production' && hr !== S_OK && hr !== DRAGDROP_E_NOTREGISTERED) {
      logOleDropError('revoke:error', `window=${window.id}`, hresultHex(hr));
    }
  } catch (error) {
    logOleDropError('revoke:exception', error);
  }

  if (koffiRef) {
    oleDropStatesByAddress.delete(koffiRef.address(state.objectPtr).toString());
    try {
      koffiRef.free(state.objectPtr);
    } catch {
      // ignore native pointer free failures
    }
  }

  oleDropStates.delete(window);
  return true;
};

const enableOleWindowFileDrop = (
  window: BrowserWindow,
  onEvent: (event: OleDropEvent) => boolean | void
) => {
  try {
    if (!ensureOleReady()) {
      setOleWindowDebugInfo(window, {
        enabled: false,
        reason: 'ole-not-ready',
        detail: oleGlobalDebugInfo.reason,
        hr: oleGlobalDebugInfo.hr,
      });
      return false;
    }

    if (!RegisterDragDrop || !RevokeDragDrop) {
      setOleWindowDebugInfo(window, {
        enabled: false,
        reason: 'bindings-missing',
      });
      return false;
    }

    disableOleWindowFileDrop(window);
    const state = createDropTargetState(window, onEvent);
    if (!state) {
      setOleWindowDebugInfo(window, {
        enabled: false,
        reason: 'state-create-failed',
      });
      return false;
    }

    try {
      // Chromium may register its own drop target internally. Revoke any existing
      // registration before installing ours.
      RevokeDragDrop(toNativeIntPtr(window.getNativeWindowHandle()));
    } catch {
      // ignore pre-revoke failures
    }

    const hr = RegisterDragDrop(
      toNativeIntPtr(window.getNativeWindowHandle()),
      state.objectPtr
    );
    state.registered = hr === S_OK || hr === S_FALSE;

    if (!state.registered) {
      logOleDropError(
        'register:error',
        `window=${window.id}`,
        hresultHex(hr)
      );
      setOleWindowDebugInfo(window, {
        enabled: false,
        reason: 'register-failed',
        hr: hresultHex(hr),
      });
      disableOleWindowFileDrop(window);
      return false;
    }

    setOleWindowDebugInfo(window, {
      enabled: true,
      reason: 'registered',
      hr: hresultHex(hr),
    });
    return true;
  } catch (error) {
    setOleWindowDebugInfo(window, {
      enabled: false,
      reason: 'enable-exception',
      detail: error instanceof Error ? error.message : String(error),
    });
    logOleDropError('enable:exception', `window=${window.id}`, error);
    return false;
  }
};

export {
  disableOleWindowFileDrop,
  enableOleWindowFileDrop,
  getOleWindowFileDropDebugInfo,
};
export type { OleDropEvent, OleDropPoint };
