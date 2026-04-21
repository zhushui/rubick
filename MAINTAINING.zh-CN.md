# Rubick Fork 维护与发版规范

## 适用范围

本文档用于约束当前 fork 的日常开发、分支管理、正式发版和 GitHub 仓库维护方式。

当前仓库采用的是：

- 短期开发分支
- 稳定 `master`
- 仅从 `master` 产生正式发行版

不再引入长期 `develop` 分支。

## 核心原则

- `master` 是默认分支，也是唯一正式发版来源分支。
- `master` 只保留已发布代码，或当前正准备立刻发布的那一个提交。
- 未准备发布的功能、重构、试验性修复，不提前合入 `master`。
- `package.json.version` 是正式版本号的唯一来源。
- GitHub Actions 会在 `master` 当前 HEAD 上自动创建对应 Tag，并在同一工作流中构建和更新 GitHub Release。
- 已公开发布的 Tag 不再重写；如果发现问题，必须通过新的版本号重新发布。
- 本地手工打包只能作为验证产物，不能视为正式发行版。

## 分支命名约定

所有日常开发都从最新 `master` 拉短分支，按用途命名：

- `feat/<topic>`
- `fix/<topic>`
- `chore/<topic>`
- `docs/<topic>`
- `refactor/<topic>`

不建议在 `master` 上直接开发，也不建议长期保留无主题的临时分支。

## 日常开发流程

推荐固定按下面顺序执行：

1. 切到最新 `master`
2. 拉取远端更新
3. 从 `master` 创建短分支
4. 在短分支完成开发、验证和提交
5. 推送分支并创建指向 `master` 的 Pull Request
6. 等待 `CI` 通过后再合并到 `master`

如果改动还没有准备好发布，就继续停留在短分支，不要合并到 `master`。

## 正式发版流程

当前 fork 的正式发版不再手工创建 Tag，而是由 GitHub Actions 在同一工作流中自动完成：

1. 确认要发布的改动已经通过 PR 合并到 `master`
2. 在合并前确认 `package.json.version` 已经设置为本次要发布的正式版本号
3. 等待 `master` 上的 `CI` 与发版工作流运行
4. 发版工作流会自动执行以下校验与动作：
   - 校验当前运行的提交就是 `origin/master` 当前 HEAD
   - 读取 `package.json.version` 并生成 `v${version}`
   - 如果同名 Tag 已存在但不指向当前 `master` HEAD，则立即失败
   - 仅在构建全部成功后创建正式 Tag
   - 在同一工作流里生成更新日志、上传产物并创建或更新 GitHub Release
5. 到 Release 页面核对：
   - Tag 与提交是否一致
   - 产物是否齐全
   - 更新摘要是否正确

## 版本纪律

- 合并到 `master` 的改动必须默认具备“可以立刻正式发布”的状态。
- 如果这次合并应该形成新的公开版本，必须在合并前就把 `package.json.version` 调整到目标版本。
- 如果 `master` 上出现了新的提交，但 `package.json.version` 仍对应旧 Tag，发版工作流会直接失败，提醒你先提升版本号。
- 正式版本号继续沿用 `v*` 规范，例如：
  - `v4.3.8-vite.1`
  - `v4.3.8-vite.2`

## 失败与重试约束

- 发版工作流在构建成功前不会创建 Tag，避免留下“Tag 已发但产物失败”的半成品版本。
- 如果构建期间 `master` 又推进到了新的提交，旧的发版工作流会终止，避免发行资源与源码不一致。
- 如果 Tag 已经创建，但 Release 上传或更新失败，可以对当前 `master` HEAD 手动重跑同一个发版工作流。
- 如果版本已经公开发布，不要删除后重打；应当修复问题、提升版本号并重新发布。

## 热修复流程

热修复也遵循同一套规则：

1. 从当前 `master` 拉出 `fix/*` 分支
2. 完成修复并验证
3. 视情况提升 `package.json.version`
4. 通过 PR 合并回 `master`
5. 由自动化创建新 Tag 并发布新的正式版本

## 禁止事项

以下行为不应作为正式维护流程的一部分：

- 直接把未完成改动推到 `master`
- 直接在 `master` 上累积“以后再说”的开发状态
- 在未确认版本号的情况下把 PR 合并到 `master`
- 从旧提交、功能分支或本地偏离远端的提交手工发布正式版
- 重写已经公开发布的 Tag
- 把本地手工打包结果当作正式发行版

## GitHub 仓库设置建议

### `master` 分支保护

建议在 GitHub 仓库设置中对 `master` 开启：

- Require a pull request before merging
- Require status checks to pass before merging
- Block force pushes
- Block branch deletion

当前 fork 以单维护者为主，因此：

- 不强制要求额外审批人数
- 不强制要求额外 Code Review
- 仅在工作流故障或紧急 hotfix 场景下，才考虑管理员人工绕过

### 其他建议

- 开启合并后自动删除 head branch
- 保持默认分支为 `master`
- 保持 Release 工作流只以 `master` 当前 HEAD 为准

## 对外口径

仓库首页、Release 页面和维护说明应保持以下口径一致：

- `master` 是稳定分支，也是唯一正式发版来源分支
- 正式版本号来自 `package.json.version`
- 正式 Tag 与 GitHub Release 由 GitHub Actions 自动生成
- 未打 Tag 的分支代码不代表正式发行版
- 已发布版本请以 GitHub Releases 与 Tag 为准
