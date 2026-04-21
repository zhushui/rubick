# Rubick Fork 维护与发版规范

## 适用范围

本文档适用于当前 fork 的日常开发、提交合并、正式发版与 GitHub 仓库维护。

当前仓库采用的是：

- 短期开发分支
- 稳定 `master`
- 仅从 `master` 发正式版本

不使用长期 `develop` 分支。

## 核心原则

- `master` 是默认分支，也是稳定分支和正式发版来源分支。
- `master` 只保留已发布代码，或当前正准备立刻发布的那一个提交。
- 未准备发布的功能、重构、试验性修复，不提前合入 `master`。
- 正式版本只认 Git Tag、对应 commit 和 GitHub Actions 生成的 Release 产物。
- 已公开发布的 Tag 不再重写；发现问题后发布新版本号修复。

## 分支命名约定

日常开发必须从最新 `master` 拉短分支，按用途命名：

- `feat/<topic>`
- `fix/<topic>`
- `chore/<topic>`
- `docs/<topic>`
- `refactor/<topic>`

不建议直接在本地长期堆积未命名临时分支，也不要在 `master` 上直接开发。

## 日常开发流程

推荐固定按下面的顺序进行：

1. 从最新 `master` 拉取代码。
2. 创建短分支进行开发。
3. 在短分支提交并推送改动。
4. 创建指向 `master` 的 Pull Request。
5. 等待 `CI` 通过后再合并到 `master`。
6. 合并后确认 `master` 上的 `CI` 再跑一次且通过。

如果改动还没有准备好发布，就继续留在短分支中，不合并到 `master`。

## 正式发版流程

正式版本必须从当前 `origin/master` 的精确 HEAD 发出。

推荐按下面顺序执行：

1. 确认目标改动已经合并到 `master`。
2. 等待 `master` 上的 `CI` 通过。
3. 在当前 `origin/master` HEAD 上创建正式 Tag。
4. 推送 Tag。
5. 由 GitHub Actions 自动构建并发布 Release。
6. 到 Release 页面核对：
   - Tag 与 commit 是否一致
   - 构建产物是否齐全
   - 更新摘要是否正确

当前 fork 的正式版本 Tag 继续使用 `v*` 规范，例如：

- `v4.3.8-vite.1`
- `v4.3.8-vite.2`

## 禁止事项

以下行为不应作为正式维护流程的一部分：

- 直接把未完成改动推送到 `master`
- 从功能分支、旧提交或本地偏离远端的提交打正式 Tag
- 把本地手工打包产物当作正式发行版
- 重写已经公开发布的 Tag
- 绕过 `CI` 直接合并非紧急改动

如果已经发布的版本存在问题，应继续从当前 `master` 拉 `fix/*` 分支修复，合并后发布新的版本号。

## GitHub 仓库设置建议

### `master` 分支保护

建议在 GitHub 仓库设置中对 `master` 开启：

- Require a pull request before merging
- Require status checks to pass before merging
- Do not allow bypassing the above settings by default
- Block force pushes
- Block branch deletion

当前 fork 以单维护者为主，因此：

- 不强制要求额外审批人数
- 不强制要求 Code Review
- 允许管理员仅在工作流故障或紧急 hotfix 时人工绕过

### 默认分支

- 默认分支保持为 `master`
- Release 工作流默认以 `master` 为唯一正式发版来源

## 对外说明建议

仓库首页和发布页面应始终保持以下口径：

- `master` 是稳定分支
- 正式版本只从 `master` 当前 HEAD 打 Tag
- 未打 Tag 的分支代码不代表正式发行版
- 已发布版本请以 Release 页面和 Tag 为准
