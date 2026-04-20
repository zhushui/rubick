import localConfig from '@/main/common/initLocalConfig';

type UiohookModule = typeof import('uiohook-napi');

const DOUBLE_PRESS_SHORTCUTS = [
  'Ctrl+Ctrl',
  'Option+Option',
  'Shift+Shift',
  'Command+Command',
] as const;

let uiohookModule: UiohookModule | null | undefined;
let hasWarned = false;
let hasRegistered = false;

const getUiohookModule = (): UiohookModule | null => {
  if (uiohookModule !== undefined) {
    return uiohookModule;
  }

  try {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    uiohookModule = require('uiohook-napi');
  } catch (error) {
    uiohookModule = null;
    if (!hasWarned) {
      hasWarned = true;
      console.warn(
        '[rubick] uiohook-napi unavailable, double-press shortcuts disabled.',
        error
      );
    }
  }

  return uiohookModule;
};

const getModifierKeyMap = (module: UiohookModule) => ({
  Ctrl: module.UiohookKey.Ctrl,
  Shift: module.UiohookKey.Shift,
  Option: module.UiohookKey.Alt,
  Command: module.UiohookKey.Comma,
});

export const registerDoubleModifierShortcut = (
  callback: () => void
): boolean => {
  const hookModule = getUiohookModule();
  if (!hookModule) {
    return false;
  }

  if (hasRegistered) {
    return true;
  }

  let lastModifierPress = Date.now();

  hookModule.uIOhook.on('keydown', async (uioEvent) => {
    const config = await localConfig.getConfig();
    const shortcut = config?.perf?.shortCut?.showAndHidden;

    if (!DOUBLE_PRESS_SHORTCUTS.includes(shortcut)) {
      return;
    }

    const shortcutKey = shortcut
      .split('+')
      .pop() as keyof ReturnType<typeof getModifierKeyMap>;
    const modifierKeyCode = getModifierKeyMap(hookModule)[shortcutKey];
    if (!modifierKeyCode) {
      return;
    }

    if (uioEvent.keycode === modifierKeyCode) {
      const currentTime = Date.now();
      if (currentTime - lastModifierPress < 300) {
        callback();
      }
      lastModifierPress = currentTime;
    }
  });

  hookModule.uIOhook.start();
  hasRegistered = true;
  return true;
};
