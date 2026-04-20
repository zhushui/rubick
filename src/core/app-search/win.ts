import fs from 'fs';
import path from 'path';
import os from 'os';
import { shell } from 'electron';
import { pathToFileURL } from 'url';

const startMenuRoots = [
  'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs',
  path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
];

const iconDir = path.join(os.tmpdir(), 'ProcessIcon');
const iconExtractor = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('extract-file-icon');
  } catch {
    return null;
  }
})();

let cachedAppList: any[] | null = null;

const normalizeAscii = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '');

const splitSearchTokens = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[()[\]{}]/g, ' ')
    .split(/[\s._\-+/\\]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

const getSearchAliases = (value: string) => {
  const aliases = new Set<string>();
  const source = value.trim();

  if (!source) {
    return [];
  }

  aliases.add(source);

  const compact = normalizeAscii(source);
  if (compact) {
    aliases.add(compact);
  }

  const asciiTokens = splitSearchTokens(source)
    .map((segment) => normalizeAscii(segment))
    .filter(Boolean);

  asciiTokens.forEach((segment) => aliases.add(segment));

  if (asciiTokens.length > 1) {
    const initials = asciiTokens.map((segment) => segment[0]).join('');
    const acronymWithTail = `${asciiTokens
      .slice(0, -1)
      .map((segment) => segment[0])
      .join('')}${asciiTokens[asciiTokens.length - 1]}`;
    const fullHeadWithInitials = `${asciiTokens[0]}${asciiTokens
      .slice(1)
      .map((segment) => segment[0])
      .join('')}`;

    initials && aliases.add(initials);
    acronymWithTail && aliases.add(acronymWithTail);
    fullHeadWithInitials && aliases.add(fullHeadWithInitials);
  }

  return Array.from(aliases);
};

const SEARCH_TERM_PRIORITY = {
  displayName: 4,
  displayAlias: 3,
  executableName: 2,
  executableAlias: 1,
};

const createSearchTerms = (displayName: string, executableName: string) => {
  const terms = new Map<
    string,
    {
      value: string;
      source: keyof typeof SEARCH_TERM_PRIORITY;
    }
  >();

  const appendTerm = (
    value: string,
    source: keyof typeof SEARCH_TERM_PRIORITY
  ) => {
    const nextValue = String(value || '').trim();
    if (!nextValue) {
      return;
    }

    const normalizedValue = normalizeAscii(nextValue) || nextValue.toLowerCase();
    const currentValue = terms.get(normalizedValue);

    if (
      !currentValue ||
      SEARCH_TERM_PRIORITY[source] > SEARCH_TERM_PRIORITY[currentValue.source]
    ) {
      terms.set(normalizedValue, {
        value: nextValue,
        source,
      });
    }
  };

  appendTerm(displayName, 'displayName');
  getSearchAliases(displayName).forEach((alias) =>
    appendTerm(alias, 'displayAlias')
  );

  appendTerm(executableName, 'executableName');
  getSearchAliases(executableName).forEach((alias) =>
    appendTerm(alias, 'executableAlias')
  );

  return Array.from(terms.values());
};

const ensureIconDir = () => {
  if (!fs.existsSync(iconDir)) {
    fs.mkdirSync(iconDir, { recursive: true });
  }
};

const getShortcutPaths = (rootPath: string, target: string[] = []) => {
  if (!fs.existsSync(rootPath)) {
    return target;
  }

  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(rootPath, { withFileTypes: true });
  } catch (error) {
    console.warn('[rubick-main:app-search:read-dir]', rootPath, error);
    return target;
  }

  entries.forEach((entry) => {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      getShortcutPaths(entryPath, target);
      return;
    }

    if (path.extname(entry.name).toLowerCase() === '.lnk') {
      target.push(entryPath);
    }
  });

  return target;
};

const getIconUrl = (targetPath: string, appName: string) => {
  if (!iconExtractor) {
    return '';
  }

  try {
    ensureIconDir();
    const rawIconBuffer = iconExtractor(targetPath, 32);
    if (!rawIconBuffer || !rawIconBuffer.length) {
      return '';
    }

    const iconBuffer = Buffer.isBuffer(rawIconBuffer)
      ? rawIconBuffer
      : Buffer.from(rawIconBuffer, 'base64');

    const iconPath = path.join(iconDir, `${encodeURIComponent(appName)}.png`);
    fs.writeFileSync(iconPath, iconBuffer);
    return pathToFileURL(iconPath).toString();
  } catch (error) {
    console.warn('[rubick-main:app-search:icon]', targetPath, error);
    return '';
  }
};

const toAppInfo = (shortcutPath: string) => {
  const appName = path.basename(shortcutPath, path.extname(shortcutPath));
  if (!appName) {
    return null;
  }

  let shortcutInfo: Electron.ShortcutDetails;
  try {
    shortcutInfo = shell.readShortcutLink(shortcutPath);
  } catch (error) {
    console.warn('[rubick-main:app-search:shortcut]', shortcutPath, error);
    return null;
  }

  const targetPath = shortcutInfo?.target?.trim();
  if (!targetPath || targetPath.toLowerCase().includes('unin')) {
    return null;
  }

  const targetBaseName = path.basename(targetPath, path.extname(targetPath));
  const searchTerms = createSearchTerms(appName, targetBaseName);
  const keyWords = searchTerms.map((term) => term.value);

  return {
    value: 'plugin',
    desc: targetPath,
    type: 'app',
    icon: getIconUrl(targetPath, appName),
    pluginType: 'app',
    action: `start "dummyclient" "${targetPath}"`,
    keyWords: Array.from(new Set(keyWords)),
    searchTerms,
    targetName: targetBaseName,
    name: appName,
    displayName: appName,
    names: Array.from(new Set(keyWords)),
  };
};

export default () => {
  if (cachedAppList) {
    return cachedAppList;
  }

  const shortcutPaths = startMenuRoots.flatMap((rootPath) => getShortcutPaths(rootPath));
  cachedAppList = shortcutPaths
    .map((shortcutPath) => toAppInfo(shortcutPath))
    .filter(Boolean);

  return cachedAppList;
};
