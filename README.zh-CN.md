[English](./README.md) | 简体中文

<div align="center">
  <img align="center" width="200" src="./public/logo.png" />
</div>

<div align="center">
  <h1>Rubick</h1>
  <img alt="累计下载量" src="https://img.shields.io/github/downloads/zhushui/rubick/total" />
  <a href="https://github.com/zhushui/rubick/releases"><img alt="最新版本" src="https://img.shields.io/github/package-json/v/zhushui/rubick" /></a>
  <a href="https://github.com/zhushui/rubick/actions/workflows/main.yml"><img alt="CI 状态" src="https://img.shields.io/github/actions/workflow/status/zhushui/rubick/main.yml?label=ci" /></a>
  <a href="https://github.com/zhushui/rubick/blob/master/LICENSE"><img alt="许可证" src="https://img.shields.io/github/license/zhushui/rubick" /></a>
  <a href="https://github.com/zhushui/rubick/stargazers"><img alt="GitHub Stars" src="https://img.shields.io/github/stars/zhushui/rubick?style=social" /></a>
</div>

<div align="center">
  <img align="center" src="https://picx.zhimg.com/80/v2-f8fe09ef125dac5fdcbef3fe00f92b21_720w.png" />
</div>

这个仓库是上游项目 [rubickCenter/rubick](https://github.com/rubickCenter/rubick) 的公开维护 fork。当前 fork 保留 `Rubick` 品牌和插件生态兼容目标，但工程演进、发布节奏、自动化流程和二次开发维护以本仓库为准。

## 当前定位

- 公开维护 fork，而不是一次性的临时分支
- 持续兼容上游插件安装链路与运行时行为
- 重点维护工程现代化、运行时安全边界、打包一致性和插件兼容层

## 当前 fork 的主要变化

- 工程现代化：
  迁移到 `pnpm workspace`、多入口 `Vite` 和 `tsup`，并清理历史 Vue CLI 残留与旧锁文件
- 更安全的 Electron 运行时：
  主应用与内置页面改为桥接访问受控 API，默认启用 `contextIsolation: true` 和 `nodeIntegration: false`
- 迁移后的打包链路梳理：
  修正运行时资源路径、相对资源加载、子应用 CSP 和 Lottie 打包方式，使其与新构建链一致
- 面向用户的交互与兼容修复：
  包含插件兼容预加载、主窗口交互细节、本地启动项处理和 Windows 宿主文件集成适配

## 兼容性与边界

- 仓库开发、CI 和发版统一使用 `pnpm`
- 运行时插件安装仍保持 npm 兼容，由 Rubick 插件安装适配层承接
- 内置页面默认采用更严格的安全模型
- 历史插件仍可通过兼容 preload 继续运行，新开发建议优先使用桥接 API

## 下载

- [当前 fork Releases](https://github.com/zhushui/rubick/releases)

## 分支与发版规则

- `master` 保持为默认分支、稳定分支和公开发行主线
- 日常开发从最新 `master` 拉短分支，例如 `feat/*`、`fix/*`、`chore/*`、`docs/*`、`refactor/*`
- 业务分支上的 Pull Request 负责代码审查与 `持续集成 (CI)`
- 正式发版通过手动触发 `正式发版 (Release)` 工作流完成
- 工作流会自动创建 `release/v<version>` 分支、统一改写版本号、构建产物、生成正式 Tag，并在成功后推进 `master`
- 失败时会自动清理 Tag 与 Draft Release，但保留 `release/*` 分支用于排障
- 已发布版本请以 GitHub Releases 和 Tag 为准

## 文档

- [开发说明](./DEVELOPMENT.zh-CN.md)
- [维护与发版规范](./MAINTAINING.zh-CN.md)
- [插件运行时兼容说明](./PLUGIN_RUNTIME.zh-CN.md)

## 仓库开发

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm package:dir
pnpm package
```

- Node 基线：`>=20`
- 当前 CI 与发版工作流基线：Node `24`
- `pnpm install` 会自动补齐 Electron 运行时并重建 Electron 相关原生依赖
- `pnpm package:dir` 是当前 fork 在 CI 中使用的 smoke package 命令

## 如何使用

安装 Rubick 后，按 `Alt/Option + R` 可快速唤起主窗口。你可以在主输入框中直接搜索应用、插件、文件和文件夹。

如果默认能力不够，可以点击左侧 Rubick logo 进入插件市场安装所需插件。

## 上游相关资源

当前 fork 仍然复用上游插件生态与相关资源：

- [Rubick 插件仓库](https://gitee.com/rubick-center)
- [Rubick 插件数据库](https://gitcode.net/rubickcenter/rubick-database)
- [Rubick Plugin CLI](https://github.com/rubickCenter/rubick-plugin-cli)

## 反馈与贡献

- fork 相关问题、维护建议和改进请求，请优先提交到本仓库的 [Issues](https://github.com/zhushui/rubick/issues) 或 Pull Requests
- 业务分支的 PR 主要承担代码审查与基础 CI，不代表会立刻正式发版
- 准备公开发布时，请使用 `正式发版 (Release)` 工作流，而不是手工改 Tag 或直接在 `master` 上累积待发布改动
- 如果问题在上游原版 Rubick 中也能稳定复现，仍建议同步反馈到上游
- 欢迎提交文档改进、插件兼容修复、打包修复和测试增强相关贡献

## License

本项目仍基于 MIT 协议开源，详见 [LICENSE](./LICENSE)。
