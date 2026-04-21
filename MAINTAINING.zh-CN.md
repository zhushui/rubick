# Rubick Fork 维护与发版规范

## 适用范围

本文档用于约束当前 fork 的日常开发、代码审查、正式发版和 GitHub 仓库维护方式。

当前仓库采用的是：

- 短期开发分支
- 稳定 `master`
- 手动触发正式发版工作流
- 自动创建短期 `release/*` 分支
- 仅在正式发布成功后才推进 `master`

这套流程的目标是尽量保证：

- 日常开发与正式发版解耦
- 代码审查只在业务分支完成一次
- `master` 尽量只保留已经成功发布的版本

## 核心原则

- `master` 是默认分支，也是稳定分支和公开发行版本的主线分支。
- 日常功能开发、缺陷修复和重构不直接在 `master` 上进行。
- 正式版本号仍由 `package.json.version` 及子应用包版本统一表示，但这些版本文件会在正式发版工作流中自动改写。
- 正式 Tag 与 GitHub Release 由 `正式发版 (Release)` 工作流统一创建和管理。
- 自动生成的 `release/*` 分支不承担业务开发职责，只用于版本封装、正式构建、发布与失败排障。
- 正式发版失败时会自动清理 Tag 与 Draft Release；`release/*` 分支默认保留，便于排障和重试。
- 已公开发布的正式 Tag 不重写；如果发现问题，应发布新的版本号。

## 分支命名约定

所有日常开发都从最新 `master` 拉短分支，按用途命名：

- `feat/<topic>`
- `fix/<topic>`
- `chore/<topic>`
- `docs/<topic>`
- `refactor/<topic>`

正式发版时，GitHub Actions 会自动创建：

- `release/v<version>`

例如：

- `release/v4.3.8-vite.2`

## 日常开发与代码审查流程

推荐固定按下面顺序执行：

1. 切到最新 `master`
2. 拉取远端更新
3. 从 `master` 创建短分支
4. 在短分支完成开发、验证和提交
5. 创建用于代码审查的 Pull Request
6. 等待 `持续集成 (CI)` 成功，并完成人工代码审查

这里的重点是：

- 业务分支上的 Pull Request 负责代码审查和基础 CI
- 审查通过不等于立刻正式发版
- `master` 不再作为“审完就直接合”的唯一动作入口

## 正式发版流程

当前 fork 的正式发版由手动触发的 `正式发版 (Release)` 工作流完成。

维护者需要手动输入两个参数：

- `source_branch`
- `version`

例如：

- `source_branch = feat/plugin-compat-and-interaction-fixes`
- `version = 4.3.8-vite.2`

工作流会自动执行以下步骤：

1. 校验 `source_branch` 存在
2. 校验版本号格式合法
3. 校验同名正式 Tag 不存在
4. 校验 `source_branch` 当前 HEAD 已经有成功的 `持续集成 (CI)` 记录
5. 自动创建 `release/v<version>` 分支
6. 自动改写这些版本文件：
   - `package.json`
   - `feature/package.json`
   - `tpl/package.json`
   - `detach/package.json`
   - `guide/package.json`
7. 校验自动生成的 release 分支只修改了允许机器修改的版本文件
8. 运行正式构建矩阵并上传产物
9. 创建正式 Tag
10. 创建 Draft Release 并上传所有安装包与更新元数据
11. 仅在前面全部成功后，将 `master` 快进到本次发布提交
12. 将 Draft Release 转为正式发布
13. 成功后自动删除 `release/v<version>` 分支

## 代码审查与 CI 不重复的边界

为了避免在 release 分支上重复做已经完成的审查，这套流程明确区分：

### `持续集成 (CI)` 负责

- 业务分支或 PR 上的基础校验
- `pnpm lint`
- `pnpm build`
- `pnpm package:dir`
- 与代码审查配套的基础质量门槛

### `正式发版 (Release)` 负责

- 校验源分支最新提交已经通过 CI
- 自动创建 `release/*` 分支
- 自动改写版本号文件
- 正式构建矩阵与打包产物上传
- Draft Release 创建与正式发布
- 成功推进 `master`
- 失败清理与必要回滚

也就是说：

- 人工代码审查只在业务分支完成一次
- release 分支不再重复做人审
- release 工作流只做正式发版专属动作

## 失败场景与补偿策略

### 构建前或构建中失败

- `master` 不变
- 正式 Tag 不保留
- Draft Release 不保留
- 自动创建的 `release/*` 分支保留，用于排障

### Draft Release 创建后、推进 `master` 前失败

- 自动删除本次 Tag
- 自动删除 Draft Release
- `master` 不变
- `release/*` 分支保留

### 推进 `master` 后、正式发布前失败

- 自动删除本次 Tag
- 自动删除 Draft Release
- 自动将 `master` 回滚到发版前的稳定提交
- `release/*` 分支保留

这里需要特别注意：

- 如果要允许自动回滚 `master`，发布机器人必须具备对 `master` 的特殊推送权限或绕过能力

## GitHub Secrets 要求

当前正式发版流程至少需要配置：

- `RELEASE_BOT_TOKEN`

这个令牌需要能完成：

- 创建和删除 `release/*` 分支
- 创建和删除 Tag
- 创建、删除和更新 GitHub Release
- 推进 `master`
- 在失败时回滚 `master`

推荐长期方案是使用 GitHub App 或专门的 bot 账号；如果先用个人 PAT，也应明确仅用于发版机器人。

## `master` 分支保护建议

建议在 GitHub 仓库设置中对 `master` 开启：

- Require a pull request before merging
- Require status checks to pass before merging
- Block branch deletion

还建议补上：

- Restrict who can push to matching branches
- 只允许发版机器人和维护者本人作为例外

如果你希望自动回滚 `master` 也能成功，还需要：

- 允许发版机器人在必要时覆盖 `master`
- 或为机器人配置足够的 bypass 权限

## 对外口径

仓库首页、Release 页面和维护说明应保持以下口径一致：

- `master` 是稳定分支，也是公开发行主线
- 业务分支的 PR 用于代码审查与 CI
- 正式版本由 `正式发版 (Release)` 工作流从已审查分支生成
- 自动生成的 `release/*` 分支只承担版本封装与正式发版职责
- 已发布版本请以 GitHub Releases 与 Tag 为准
