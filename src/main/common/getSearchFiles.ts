import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { getStaticAssetPath } from './runtimePaths';

const getSearchFiles = (argv = process.argv, cwd = process.cwd()) => {
  const files = argv.slice(2);
  let result: any = [];
  if (files.length > 0) {
    result = files
      .map((item) => {
        if (path.isAbsolute(item)) {
          return { path: item };
        }
        const tempPath = path.join(cwd, item);
        if (fs.existsSync(tempPath)) {
          return { path: tempPath };
        }
        return null;
      })
      .filter((item) => item !== null);
  }
  return result;
};

const putFileToRubick = (webContents, files) => {
  webContents.executeJavaScript(
    `window.searchFocus(${JSON.stringify(files)}, false)`
  );
};

const copyFileOutsideOfElectronAsar = function (
  sourceInAsarArchive,
  destOutsideAsarArchive
) {
  if (fs.existsSync(sourceInAsarArchive)) {
    if (fs.statSync(sourceInAsarArchive).isFile()) {
      const file = destOutsideAsarArchive;
      const dir = path.dirname(file);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(file, fs.readFileSync(sourceInAsarArchive));
    } else if (fs.statSync(sourceInAsarArchive).isDirectory()) {
      fs.readdirSync(sourceInAsarArchive).forEach((fileOrFolderName) => {
        copyFileOutsideOfElectronAsar(
          `${sourceInAsarArchive}/${fileOrFolderName}`,
          `${destOutsideAsarArchive}/${fileOrFolderName}`
        );
      });
    }
  }
};

const macBeforeOpen = () => {
  const dest = `${os.homedir}/Library/Services/rubick.workflow`;
  if (fs.existsSync(dest)) {
    return true;
  }
  try {
    copyFileOutsideOfElectronAsar(getStaticAssetPath('rubick.workflow'), dest);
  } catch (error) {
    console.log(error);
  }
  return false;
};

export { getSearchFiles, putFileToRubick, macBeforeOpen };
