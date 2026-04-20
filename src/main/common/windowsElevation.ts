let isUserAnAdmin: (() => boolean) | undefined;

if (process.platform === 'win32') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const koffi = require('koffi');
    const shell32 = koffi.load('shell32.dll');
    isUserAnAdmin = shell32.func('bool __stdcall IsUserAnAdmin()');
  } catch {
    isUserAnAdmin = undefined;
  }
}

const getWindowsElevationState = () => {
  if (process.platform !== 'win32') {
    return {
      platform: process.platform,
      supported: false,
      elevated: false,
    };
  }

  try {
    return {
      platform: process.platform,
      supported: typeof isUserAnAdmin === 'function',
      elevated: Boolean(isUserAnAdmin?.()),
    };
  } catch {
    return {
      platform: process.platform,
      supported: typeof isUserAnAdmin === 'function',
      elevated: false,
    };
  }
};

export { getWindowsElevationState };
