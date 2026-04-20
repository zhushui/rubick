type NodeKeySenderModule = typeof import('node-key-sender');

let keyboardSenderModule: NodeKeySenderModule | null | undefined;
let hasWarned = false;

const getKeyboardSender = (): NodeKeySenderModule | null => {
  if (keyboardSenderModule !== undefined) {
    return keyboardSenderModule;
  }

  try {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    keyboardSenderModule = require('node-key-sender');
  } catch (error) {
    keyboardSenderModule = null;
    if (!hasWarned) {
      hasWarned = true;
      console.warn(
        '[rubick] node-key-sender unavailable, keyboard simulation disabled.',
        error
      );
    }
  }

  return keyboardSenderModule;
};

export const simulateKeyboardTap = (
  key: string,
  modifier: string[] = []
): boolean => {
  const keyboardSender = getKeyboardSender();
  if (!keyboardSender) {
    return false;
  }

  const keys = [key.toLowerCase()];
  if (modifier.length > 0) {
    keyboardSender.sendCombination(modifier.concat(keys));
    return true;
  }

  keyboardSender.sendKeys(keys);
  return true;
};
