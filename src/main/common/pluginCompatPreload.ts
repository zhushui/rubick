import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { getPreloadPath } from './runtimePaths';

type PluginCompatPolicy = {
  legacySyncDb: boolean;
};

type EnsurePluginCompatPreloadOptions = {
  pluginName: string;
  pluginRoot: string;
  originalPreload?: string;
  injectTplBridge?: boolean;
};

const LEGACY_SYNC_DB_PLUGINS = new Set([
  'ai-copilot-plugin',
  'ip-config-rubick-plugin',
  'mossgpt-rubick',
  'rubick-color',
  'rubick-ctool',
  'rubick-doutu',
  'rubick-everything',
  'rubick-excalidraw',
  'rubick-host',
  'rubick-nat',
  'rubick-relax',
  'rubick-ui-picture-bed',
  'rubick-ui-plugin-wallhaven',
  'rubick-ui-plugin-mverything',
  'rubick-web-open',
  'rubick-xunfei-ocr',
]);
const COMPAT_SOURCE_EXTENSIONS = new Set([
  '.js',
  '.cjs',
  '.mjs',
  '.ts',
  '.vue',
  '.html',
]);
const MAX_COMPAT_SCAN_FILE_SIZE = 16 * 1024 * 1024;
const pluginCompatPolicyCache = new Map<string, PluginCompatPolicy>();

const LEGACY_SYNC_DB_PATTERNS = [
  /(?:window\.)?(?:rubick|utools)\.db\.(?:put|remove|bulkDocs)\([^)]*\)\.ok/,
  /(?:window\.)?(?:rubick|utools)\.db\.(?:get|allDocs)\([^)]*\)\s*\|\|/,
  /(?:window\.)?(?:rubick|utools)\.db\.(?:get|allDocs)\([^)]*\)\s*\.(?!then|catch|finally)/,
  /(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*(?:window\.)?(?:rubick|utools)\.db\.(?:get|allDocs)\(/,
  /[=(:,]\s*(?:window\.)?(?:rubick|utools)\.db\.(?:get|allDocs)\([^)]*\)\s*(?:[;,)]|$)/,
];

const collectPluginSourceFiles = (pluginRoot: string) => {
  const files: string[] = [];
  const stack = [pluginRoot];

  while (stack.length) {
    const currentPath = stack.pop();
    if (!currentPath) continue;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        entry.name === 'dist-electron'
      ) {
        continue;
      }

      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (!COMPAT_SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        continue;
      }

      try {
        const { size } = fs.statSync(fullPath);
        if (size <= MAX_COMPAT_SCAN_FILE_SIZE) {
          files.push(fullPath);
        }
      } catch {
        // ignore unreadable files during compat scanning
      }
    }
  }

  return files;
};

const detectLegacySyncDbUsage = (pluginName: string, pluginRoot: string) => {
  if (LEGACY_SYNC_DB_PLUGINS.has(pluginName)) {
    return true;
  }

  if (!pluginRoot || !fs.existsSync(pluginRoot)) {
    return false;
  }

  const sourceFiles = collectPluginSourceFiles(pluginRoot);
  for (const sourceFile of sourceFiles) {
    try {
      const content = fs.readFileSync(sourceFile, 'utf8');
      if (
        LEGACY_SYNC_DB_PATTERNS.some((pattern) => pattern.test(content))
      ) {
        return true;
      }
    } catch {
      // ignore unreadable source files during compat scanning
    }
  }

  return false;
};

const getPluginCompatPolicy = (pluginName: string, pluginRoot: string) => {
  const cacheKey = `${pluginName}:${pluginRoot}`;
  const cachedPolicy = pluginCompatPolicyCache.get(cacheKey);
  if (cachedPolicy) {
    return cachedPolicy;
  }

  const policy = {
    legacySyncDb: detectLegacySyncDbUsage(pluginName, pluginRoot),
  };
  pluginCompatPolicyCache.set(cacheKey, policy);
  return policy;
};

const buildLegacyGlobalAliasSource = () => `(() => {
  if (!window.rubick || typeof window.rubick !== 'object') {
    return;
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.rubick = window.rubick;
    if (typeof globalThis.utools === 'undefined') {
      globalThis.utools = window.rubick;
    }
  }

  if (typeof window.utools === 'undefined') {
    window.utools = window.rubick;
  }
})();
`;

const buildTplBridgeSource = () => `(() => {
  if (window.tplBridge && typeof window.tplBridge === 'object') {
    return;
  }

  const { ipcRenderer } = require('electron');

  const registerIpcListener = (channel, cb) => {
    if (typeof cb !== 'function') {
      return () => undefined;
    }

    const listener = (_event, payload) => cb(payload);
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  };

  window.tplBridge = {
    onChangeCurrent(cb) {
      return registerIpcListener('changeCurrent', cb);
    },
    send(channel, payload) {
      return ipcRenderer.send(channel, payload);
    },
  };
})();
`;

const buildLegacySyncDbSource = (pluginName: string) => `(() => {
  if (!window.rubick || typeof window.rubick !== 'object') {
    return;
  }

  const fs = require('node:fs');
  const path = require('node:path');
  const { ipcRenderer } = require('electron');

  const emptyStore = () => ({ counter: 0, docs: {} });
  const userDataPath = ipcRenderer.sendSync('msg-trigger', {
    type: 'getPath',
    data: { name: 'userData' },
  });
  const storePath = path.join(
    typeof userDataPath === 'string' && userDataPath
      ? userDataPath
      : process.cwd(),
    'plugin-legacy-db',
    ${JSON.stringify(pluginName)} + '.json'
  );

  const clone = (value) =>
    value === undefined ? undefined : JSON.parse(JSON.stringify(value));

  const normalizeStore = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return emptyStore();
    }

    const docs =
      value.docs && typeof value.docs === 'object' && !Array.isArray(value.docs)
        ? value.docs
        : {};
    const counter = Number.isFinite(Number(value.counter))
      ? Number(value.counter)
      : 0;

    return { counter, docs };
  };

  const readStore = () => {
    try {
      if (!fs.existsSync(storePath)) {
        return emptyStore();
      }

      const raw = fs.readFileSync(storePath, 'utf8');
      return normalizeStore(raw ? JSON.parse(raw) : null);
    } catch {
      return emptyStore();
    }
  };

  const writeStore = (store) => {
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.writeFileSync(storePath, JSON.stringify(store), 'utf8');
    return store;
  };

  const nextRev = (store) => {
    store.counter += 1;
    return 'legacy-' + store.counter;
  };

  const toDocId = (doc) => {
    const value = typeof doc === 'string' ? doc : doc && doc._id;
    return typeof value === 'string' && value ? value : '';
  };

  const buildError = (name, message) => ({
    error: true,
    name,
    message,
  });

  const withThenable = (value) => {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
      return value;
    }

    if (typeof value.then === 'function') {
      return value;
    }

    Object.defineProperties(value, {
      then: {
        configurable: true,
        enumerable: false,
        value(onFulfilled, onRejected) {
          return Promise.resolve(value).then(onFulfilled, onRejected);
        },
      },
      catch: {
        configurable: true,
        enumerable: false,
        value(onRejected) {
          return Promise.resolve(value).catch(onRejected);
        },
      },
      finally: {
        configurable: true,
        enumerable: false,
        value(onFinally) {
          return Promise.resolve(value).finally(onFinally);
        },
      },
    });

    return value;
  };

  const saveDoc = (store, inputDoc) => {
    const doc = clone(inputDoc);
    const id = toDocId(doc);

    if (!id) {
      return buildError('bad_request', 'doc _id error');
    }

    const rev = nextRev(store);
    const previous =
      store.docs[id] && typeof store.docs[id] === 'object' ? store.docs[id] : {};

    store.docs[id] = {
      ...previous,
      ...doc,
      _id: id,
      _rev: rev,
    };

    return {
      ok: true,
      id,
      rev,
    };
  };

  const existingDb =
    window.rubick.db && typeof window.rubick.db === 'object'
      ? window.rubick.db
      : {};

  window.rubick.db = {
    ...existingDb,
    get(id) {
      const store = readStore();
      const doc = store.docs[String(id)];
      return doc ? withThenable(clone(doc)) : null;
    },
    put(doc) {
      const store = readStore();
      const result = saveDoc(store, doc);
      if (!result.error) {
        writeStore(store);
      }
      return withThenable(result);
    },
    remove(doc) {
      const store = readStore();
      const id = toDocId(doc);

      if (!id) {
        return buildError('bad_request', 'doc _id error');
      }

      if (!Object.prototype.hasOwnProperty.call(store.docs, id)) {
        return buildError('not_found', 'missing');
      }

      delete store.docs[id];
      const rev = nextRev(store);
      writeStore(store);
      return withThenable({
        ok: true,
        id,
        rev,
      });
    },
    bulkDocs(docs) {
      if (!Array.isArray(docs)) {
        return buildError('bad_request', 'not array');
      }

      const store = readStore();
      const results = docs.map((doc) => saveDoc(store, doc));
      if (!results.some((result) => result && result.error)) {
        writeStore(store);
      }
      return withThenable(results);
    },
    allDocs(key) {
      const store = readStore();
      const docs = Object.entries(store.docs)
        .filter(([id]) => {
          if (Array.isArray(key)) {
            return key.map(String).includes(id);
          }

          if (!key) {
            return true;
          }

          return id.startsWith(String(key));
        })
        .map(([, doc]) => clone(doc))
        .sort((left, right) =>
          String(left?._id || '').localeCompare(String(right?._id || ''))
        );

      return withThenable(docs);
    },
  };
})();
`;

const buildPluginCompatPreloadSource = (
  options: EnsurePluginCompatPreloadOptions,
  policy: PluginCompatPolicy
) => {
  const sourceParts = [
    `require(${JSON.stringify(getPreloadPath('compat'))});\n`,
    buildLegacyGlobalAliasSource(),
  ];

  if (options.injectTplBridge) {
    sourceParts.push(buildTplBridgeSource());
  }

  if (policy.legacySyncDb) {
    sourceParts.push(buildLegacySyncDbSource(options.pluginName));
  }

  if (options.originalPreload) {
    sourceParts.push(`require(${JSON.stringify(options.originalPreload)});\n`);
  }

  return sourceParts.join('');
};

const ensurePluginCompatPreload = (
  options: EnsurePluginCompatPreloadOptions
) => {
  const compatDir = path.join(app.getPath('userData'), 'plugin-compat-preloads');
  const variantName = options.injectTplBridge ? 'tpl' : 'ui';
  const compatPath = path.join(
    compatDir,
    `${options.pluginName}-${variantName}.cjs`
  );
  const compatPolicy = getPluginCompatPolicy(
    options.pluginName,
    options.pluginRoot
  );
  const compatSource = buildPluginCompatPreloadSource(options, compatPolicy);

  try {
    fs.mkdirSync(compatDir, { recursive: true });
    const previousSource = fs.existsSync(compatPath)
      ? fs.readFileSync(compatPath, 'utf8')
      : '';

    if (previousSource !== compatSource) {
      fs.writeFileSync(compatPath, compatSource, 'utf8');
    }

    return compatPath;
  } catch {
    return options.originalPreload || getPreloadPath('compat');
  }
};

export { ensurePluginCompatPreload };
