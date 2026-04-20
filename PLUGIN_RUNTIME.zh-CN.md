# Rubick Fork 插件运行时与兼容性说明

## 先说结论

这次 fork 并没有把插件生态“一刀切”重来，而是做了两件事：

- 主应用与内置页面切到更安全的 bridge 模型
- 旧插件继续通过兼容 preload 运行，给迁移留出缓冲区

所以当前仓库同时存在两套运行时约束：

- 内置页面：更严格、更受控
- 历史插件：仍兼容，但不再建议继续扩张旧模式

## 当前运行时模型

### 内置页面

主窗口、设置页、插件市场、模板页、引导页等内置页面现在默认：

- `contextIsolation: true`
- `nodeIntegration: false`
- 通过 `window.rubick`、`window.market`、`window.tplBridge`、`window.detachBridge`、`window.guideBridge` 访问能力

### 历史插件

历史插件仍通过兼容 preload 运行，兼容层主要由 `src/preload/compat.ts` 负责。
兼容层会继续保留老插件常见依赖方式，例如：

- BrowserView 运行模式
- `window.rubick` 老接口外观
- 插件安装、升级、卸载仍走 npm 兼容链路

这保证了老插件不会因为主应用安全模型收紧而整体失效。

## 关键 bridge 能力

### 1. 本地配置存储

本地配置现在以 JSON 配置文件为主存储，并通过 bridge 暴露：

```ts
const config = window.rubick.getLocalConfig();

window.rubick.setLocalConfig({
  ...config,
  perf: {
    ...config.perf,
    common: {
      ...config.perf.common,
      darkMode: true,
    },
  },
});
```

适用场景：

- 主题
- 快捷键
- 本地启动项配置
- fork 级别的默认配置合并

### 2. 异步 `db` 访问

`db` 在新的 bridge 中优先按异步方式使用：

```ts
const doc = await window.rubick.db.get('rubick-localhost-config');

await window.rubick.db.put({
  _id: 'rubick-localhost-config',
  _rev: doc?._rev,
  data: {
    register: true,
    database: 'https://example.invalid/db',
    access_token: 'token',
  },
});
```

可用方法包括：

- `window.rubick.db.put`
- `window.rubick.db.get`
- `window.rubick.db.remove`
- `window.rubick.db.bulkDocs`
- `window.rubick.db.allDocs`
- `window.rubick.db.postAttachment`
- `window.rubick.db.getAttachment`
- `window.rubick.db.getAttachmentType`

### 3. 本地缓存型 `dbStorage`

兼容层仍保留 `dbStorage`，并补上了本地缓存兜底：

```ts
window.rubick.dbStorage.setItem('demo-key', { enabled: true });
const value = window.rubick.dbStorage.getItem('demo-key');
window.rubick.dbStorage.removeItem('demo-key');
```

这更适合兼容老插件，不建议把它当成新的核心数据层。

### 4. 文件选择与保存对话框

新代码优先使用异步接口：

```ts
const files = await window.rubick.showOpenDialogAsync({
  properties: ['openFile', 'openDirectory', 'multiSelections'],
});

const savePath = await window.rubick.showSaveDialogAsync({
  defaultPath: 'export.json',
});
```

同步接口与 callback 风格仍保留兼容，但不建议继续扩散。

### 5. Windows 宿主文件拖放桥接

如果插件或内置页面需要接入宿主文件/文件夹拖放，可以使用当前 bridge：

```ts
window.rubick.setHostFileDropEnabled(true);

window.rubick.onHostDrop(({ files }) => {
  console.log(files);
});

window.rubick.onHostDropTargetState(({ active, inside }) => {
  console.log(active, inside);
});

window.rubick.updateHostDropTarget({
  visible: true,
  bounds: { x: 0, y: 0, width: 320, height: 180 },
  message: 'Click or drag files/folders here',
  darkMode: false,
});

await window.rubick.reportHostDropFiles(['C:\\temp\\demo.txt']);
```

相关能力背后由主进程的宿主拖放、OLE 拖放与 overlay 逻辑承接，主要用于保证这条链路在新架构下仍能稳定工作。

### 6. 主菜单与历史菜单动作回传

主窗口内置页面可通过 `window.rubick.internal` 处理菜单行为：

```ts
window.rubick.internal.popupMainMenu({
  hideOnBlur: true,
  lang: 'zh-CN',
  hasPlugin: true,
});

window.rubick.internal.onMainMenuAction(({ action, value }) => {
  console.log(action, value);
});

window.rubick.internal.popupHistoryMenu({
  hideOnBlur: true,
  pluginName: 'demo',
});

window.rubick.internal.onHistoryMenuAction(({ action, value }) => {
  console.log(action, value);
});
```

### 7. 内置页面专用桥

`feature` 子应用额外暴露：

```ts
const localPlugins = window.market.getLocalPlugins();
await window.market.downloadPlugin(plugin);
await window.market.deletePlugin(plugin);
await window.market.dbDump(payload);
await window.market.dbImport(payload);
window.market.reRegister();
```

模板页额外暴露：

```ts
window.tplBridge.onChangeCurrent((delta) => {
  console.log(delta);
});

window.tplBridge.send('some-channel', payload);
```

分离窗口与引导页桥接能力：

```ts
window.detachBridge.sendMessage('some-type', payload);
window.detachBridge.sendService('close');
window.guideBridge.close();
```

## 旧插件兼容策略

### 保留了什么

- 旧插件继续通过 BrowserView 运行
- 插件安装、升级、卸载仍通过 npm 兼容链路执行
- 兼容 preload 继续提供 `window.rubick` 外观
- `onPluginEnter` / `onPluginReady` 做了粘性补发，避免事件先发后注册导致插件空白

### 不再鼓励什么

- 继续扩张 `window.require`
- 新代码依赖 `@electron/remote`
- 新页面继续使用同步 IPC 当主数据通道
- 在主应用 renderer 中默认暴露整套 Node/Electron 权限

## `pnpm` 与 npm 的边界

### 仓库层

- 开发依赖安装：`pnpm install`
- CI：`pnpm lint`、`pnpm build`、`pnpm package:dir`
- 正式发版：由 GitHub Actions 和 `electron-builder` 承接

### 运行时插件层

插件安装器仍会在插件工作目录内维护独立的 npm 安装环境，并固定：

- `packageManager: npm@10.9.4`
- `engines.node: >=20`

所以：

- 仓库维护者不要再用 `npm install` 管理仓库本身
- 插件作者也不需要因为仓库迁移到 `pnpm` 就立刻重写历史安装脚本

## 给插件开发者的迁移建议

推荐的迁移顺序：

1. 先把 `db` 调用改成 `await window.rubick.db.*`
2. 再把文件选择与保存改成 `showOpenDialogAsync` / `showSaveDialogAsync`
3. 逐步减少对 `window.require`、`@electron/remote` 和同步 IPC 的依赖
4. 如果插件需要接入宿主文件拖放，优先使用当前 host drop bridge
5. 新增页面优先以受控 bridge 为主，不要复制旧兼容模式

## 手工验证建议

如果你改动了插件运行时相关代码，至少手工验证下面这些场景：

- 已安装第三方插件能否正常打开
- `PluginEnter` / `PluginReady` 是否按预期触发
- 设置页与插件市场是否能正常访问 `db`
- 本地启动项的文件选择、拖放和保存是否正常
- Windows 文件拖放插件是否能收到真实宿主路径
