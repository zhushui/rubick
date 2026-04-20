[English](./README.md) | 简体中文

<div align="center">
  <img align="center" width="200" src="./public/logo.png" />
</div>

<div align="center">
  <h1>Rubick</h1>
  <img alt="累计下载量" src="https://img.shields.io/github/downloads/zhushui/rubick/total" />
  <a href="https://github.com/zhushui/rubick/releases"><img alt="最新版本" src="https://img.shields.io/github/package-json/v/zhushui/rubick" /></a>
  <a href="https://github.com/zhushui/rubick/actions/workflows/main.yml"><img alt="CI 状态" src="https://img.shields.io/github/actions/workflow/status/zhushui/rubick/main.yml?label=ci" /></a>
  <a href="https://github.com/zhushui/rubick/blob/main/LICENSE"><img alt="许可证" src="https://img.shields.io/github/license/zhushui/rubick" /></a>
  <a href="https://github.com/zhushui/rubick/stargazers"><img alt="GitHub Stars" src="https://img.shields.io/github/stars/zhushui/rubick?style=social" /></a>
</div>

<div align="center">
  <img align="center" src="https://picx.zhimg.com/80/v2-f8fe09ef125dac5fdcbef3fe00f92b21_720w.png" />
</div>

这个仓库是上游项目 [rubickCenter/rubick](https://github.com/rubickCenter/rubick) 的公开维护 fork。当前 fork 保留 `Rubick` 品牌和插件生态兼容目标，但工程演进、发布节奏、自动化流程和二次开发维护以本仓库为准。

## 当前定位

- 公开维护 fork，不是一次性的临时分支。
- 兼容上游仍然重要，尤其是插件安装链路与插件运行时行为。
- 当前维护重点是：`Vite + tsup + pnpm` 工程迁移、Electron 运行时安全边界、打包一致性校正，以及 Windows 集成在新架构下的适配。

## 当前 fork 的主要变化

- 工程现代化：
  迁移到 `pnpm workspace`、多入口 `Vite`、`tsup` 构建 main/preload，并清理历史 Vue CLI 产物和旧锁文件。
- 更安全的 Electron 运行时：
  主应用与内置页面改为桥接访问受控 API，默认启用 `contextIsolation: true` 和 `nodeIntegration: false`。
- 迁移后的打包链路整理：
  修正运行时资源路径、相对资源加载，并梳理 feature 子应用 CSP 与 Lottie 打包配置，使其和新构建链保持一致。
- 用户可见层面的整理：
  本地启动项文件选择与拖放体验优化，应用与插件搜索匹配及结果排序优化，历史与菜单交互优化，以及 Windows 宿主文件拖放链路在新架构下的适配。

## 兼容性与边界

- 仓库开发、CI、发布统一使用 `pnpm`。
- 运行时插件安装仍保持 npm 兼容，由 Rubick 的插件安装适配层承接。
- 主应用内置页面已经采用更严格的安全模型。
- 旧插件仍可通过兼容 preload 继续运行，但新开发建议优先使用桥接 API。

详细说明见：

- [开发说明](./DEVELOPMENT.zh-CN.md)
- [插件运行时兼容说明](./PLUGIN_RUNTIME.zh-CN.md)

## 下载

- [当前 fork Releases](https://github.com/zhushui/rubick/releases)

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
- 当前 CI 验证基线：Node `24`
- `pnpm install` 会自动补齐 Electron 运行时并重建 Electron 相关原生依赖。
- `pnpm package:dir` 是当前 fork 在 CI 中使用的 smoke package 命令。

## 如何使用

安装 Rubick 后，按 `Alt/Option + R` 可快速唤起主程序。
你可以直接在主输入框中搜索应用、插件、文件与文件夹。

如果默认能力不够，可以点击左侧 Rubick logo 进入插件市场，安装所需插件。

## 上游相关资源

当前 fork 仍然复用上游插件生态与相关资源：

- [Rubick 插件仓库](https://gitee.com/rubick-center)
- [Rubick 插件数据库](https://gitcode.net/rubickcenter/rubick-database)
- [Rubick Plugin CLI](https://github.com/rubickCenter/rubick-plugin-cli)

## 反馈与贡献

- fork 相关问题、维护建议和改进请求，请优先提交到本仓库的 [Issues](https://github.com/zhushui/rubick/issues) 或 Pull Requests。
- 如果问题在上游原版 Rubick 中也能稳定复现，仍然建议同步标注或反馈到上游。
- 欢迎提交文档改进、插件兼容修复、打包修复和测试增强相关贡献。

## License

本项目仍基于 MIT 协议开源，详见 [LICENSE](./LICENSE)。
