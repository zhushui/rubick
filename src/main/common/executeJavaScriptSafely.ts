import { WebContents } from 'electron';

const executeJavaScriptSafely = (
  webContents: WebContents | null | undefined,
  code: string
) => {
  if (!webContents || webContents.isDestroyed()) {
    return Promise.resolve(undefined);
  }

  return webContents.executeJavaScript(code).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);

    if (
      process.env.NODE_ENV === 'development' &&
      !message.includes('Script failed to execute')
    ) {
      console.warn('[rubick] executeJavaScript skipped:', error);
    }
    return undefined;
  });
};

export default executeJavaScriptSafely;
