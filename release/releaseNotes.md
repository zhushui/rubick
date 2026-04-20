# Rubick Fork Release Notes

本版本来自当前公开维护 fork，保留 `Rubick` 品牌与插件生态兼容目标。

## 重点更新

- 构建链迁移到 `pnpm workspace + Vite + tsup`
- 重构 Electron main / preload bridge，收紧内置页面安全模型
- 梳理迁移后的打包资源路径、内置页面加载链路与 feature 子应用打包配置
- 优化本地启动项体验、搜索匹配与结果排序、菜单交互，以及 Windows 宿主文件拖放在新架构下的适配
- 补齐 CI、CodeQL 与基于 Tag 的 GitHub Release 流程

## 兼容性说明

- 仓库开发与 CI 使用 `pnpm`
- 运行时插件安装仍保持 npm 兼容
- 内置页面默认使用更严格的 `contextIsolation` 与 bridge API
- 旧插件仍通过兼容 preload 继续运行

## 维护说明

- 这是 fork 的默认 release notes 模板
- 正式发版前，请按当次 tag 的真实改动更新本文件
