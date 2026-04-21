# Rubick Fork 开发说明

## 仓库定位

当前仓库是上游项目 [rubickCenter/rubick](https://github.com/rubickCenter/rubick) 的公开维护 fork。

这个 fork 保留 `Rubick` 品牌、插件生态兼容目标和原有产品定位，但工程演进、打包修复、GitHub 自动化与后续维护节奏以当前仓库为准。

如果你是第一次接手这个 fork，可以先记住一句话：

- 这里已经不再是原来的 `Vue CLI + yarn/npm + public 预构建产物` 结构，而是 `pnpm workspace + Vite + tsup + Electron 41` 的新基线。

## 环境基线

- Node.js `>=20`
- 当前 CI 验证基线：Node `24`
- `pnpm@10`
- Electron `41`

## 快速开始

```bash
pnpm install
pnpm dev
```

需要注意：

- `pnpm install` 会先通过 `scripts/ensure-electron.cjs` 补齐 Electron 运行时，再执行 `electron-builder install-app-deps` 重建 Electron 侧原生依赖。
- 如果你清空了 `node_modules`、Electron 缓存，或者切换了 Node 版本，先重新执行一次 `pnpm install`。
- 仓库开发统一使用 `pnpm`，不要混用 `npm install` 或 `yarn` 管理仓库依赖。

## 当前开发拓扑

`pnpm dev` 会同时启动以下进程：

- 主窗口 renderer：`http://127.0.0.1:5173`
- `feature` 子应用：`http://127.0.0.1:5174`
- `tpl` 子应用：`http://127.0.0.1:5175`
- `detach` 子应用：`http://127.0.0.1:5176`
- `guide` 子应用：`http://127.0.0.1:5177`
- 主进程输出：`dist/main/index.cjs`
- preload 输出：`dist/preload/*.cjs`

现在的开发结构是显式拆开的：

- `Vite` 负责主窗口和内置子应用页面
- `tsup` 负责 Electron main / preload
- Electron 进程在端口和构建产物都准备好后再启动

## 常用命令

```bash
pnpm build
pnpm lint
pnpm package:dir
pnpm package
```

- `pnpm build`：构建主窗口 renderer、四个内置子应用、主进程和 preload
- `pnpm lint`：执行当前 ESLint 规则校验
- `pnpm package:dir`：执行 unpacked smoke package，与 CI 中的打包烟测保持一致
- `pnpm package`：执行正式打包

## 分支与发版约束

当前 fork 不使用长期 `develop` 分支，而是采用短分支直入 `master` 的维护方式：

- `master` 是默认分支、稳定分支，也是唯一正式发版来源分支
- 日常开发从最新 `master` 拉 `feat/*`、`fix/*`、`chore/*`、`docs/*`、`refactor/*`
- 未准备发布的改动不要提前合入 `master`
- `package.json.version` 是正式版本号的唯一来源
- PR 合并到 `master` 后，GitHub Actions 会自动创建对应 Tag，并在同一工作流里构建和更新 GitHub Release
- 如果同名版本 Tag 已存在但不指向当前 `master` HEAD，发版工作流会失败并要求先提升版本号
- 已公开发布的 Tag 不再重写

维护细则见：

- [维护与发版规范](./MAINTAINING.zh-CN.md)

## 目录说明

- `src/renderer`：主窗口 renderer
- `src/main`：Electron 主进程
- `src/preload`：主窗口、内置页面和插件兼容层 preload
- `feature` / `tpl` / `detach` / `guide`：四个独立的 Vite 子应用
- `dist/renderer`：主窗口打包产物
- `dist/apps/*`：内置子应用打包产物
- `dist/main`：主进程打包产物
- `dist/preload`：preload 打包产物

以下目录和配置已不再作为当前源码结构的一部分：

- `public/feature`
- `public/tpl`
- `public/detach`
- `public/guide`
- `dist_electron`
- 根目录及子应用中的 `vue.config.js` / `babel.config.js`

## 当前 fork 已完成的关键工程变化

### 1. 构建链迁移

- 根工程与子应用已经迁移到 `pnpm workspace`
- 主窗口与四个内置页面使用 `Vite`
- Electron main / preload 使用 `tsup`
- 历史 `yarn.lock`、`package-lock.json`、`public/*` 预构建产物和 Vue CLI 配置已系统清理

### 2. Electron 运行时重构

- 内置页面默认使用 `contextIsolation: true`
- 内置页面默认关闭 `nodeIntegration`
- 受控 API 统一收敛到 bridge 对象
- 历史插件仍可通过兼容 preload 运行，避免一次性打断现有插件生态

### 3. 打包一致性校正

- 运行时资源路径不再依赖 `process.cwd()`，而是从 `__dirname` 回溯真实 app root
- 生产构建统一使用相对资源路径，避免 `file://` 场景下脚本和样式丢失
- `feature` 子应用的 CSP 与 Lottie 打包方式已按新构建链整理
- `lottie-web` 切换到更轻量的构建入口，减少体积并简化打包行为

### 4. 配置与运行时行为变化

- 用户配置以本地 JSON 文件为主存储
- 插件与设置页的大量 `db` 调用改为异步桥接
- Windows 宿主文件拖放在新架构下补齐了适配链路
- 主窗口搜索匹配、结果排序、历史记录和菜单交互都做了增强

## 兼容性边界

### 仓库开发与运行时插件安装不是同一层约束

- 仓库开发：统一使用 `pnpm`
- 运行时插件安装：仍通过 npm 兼容适配层执行

这是有意保留的双层设计：

- 仓库层保证现代化工程与稳定 CI
- 运行时层继续兼容现有插件安装、升级与卸载方式

### 安全模型变化

- 主应用与内置页面不再默认暴露整套 Node/Electron 权限
- 历史插件仍可在兼容 preload 下运行
- 新页面或新插件开发，优先使用 bridge API，不要再默认依赖 `window.require`、`@electron/remote` 或同步 IPC

## 当前值得优先熟悉的文件

- `package.json`
- `vite.root.config.ts`
- `vite.shared.ts`
- `tsup.main.config.ts`
- `tsup.preload.config.ts`
- `src/main/common/runtimePaths.ts`
- `src/main/common/api.ts`
- `src/preload/shared/createRubickBridge.ts`
- `src/preload/main.ts`
- `src/preload/feature.ts`
- `src/preload/compat.ts`
- `src/common/utils/localConfigStore.ts`

## 提交前建议的自检清单

在当前 fork 中，推荐至少执行下面这组校验：

```bash
pnpm lint
pnpm build
pnpm package:dir
```

手工烟测建议覆盖：

- 主窗口搜索是否正常
- 托盘是否显示
- 插件市场是否可打开
- 设置页是否可打开
- 本地启动项文件选择与拖放是否正常
- 打包后资源是否能在 `win-unpacked` 中正常加载
- Windows 宿主文件拖放是否工作

## 与上游同步时的建议

- 先判断上游改动是业务层修复，还是旧工程结构下的修复
- 如果上游改动依赖历史 Vue CLI / public 预构建流程，不要机械 cherry-pick
- 同步时优先保留当前 fork 已建立的 bridge、Vite、tsup 与安全模型边界
- 如果要引入新的内置页面能力，优先扩展 preload bridge 与主进程 API，不要回退到 renderer 直接访问 Node/Electron
