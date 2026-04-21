English | [简体中文](./README.zh-CN.md)

<div align="center">
  <img align="center" width="200" src="./public/logo.png" />
</div>

<div align="center">
  <h1>Rubick</h1>
  <img alt="downloads" src="https://img.shields.io/github/downloads/zhushui/rubick/total" />
  <a href="https://github.com/zhushui/rubick/releases"><img alt="latest release" src="https://img.shields.io/github/package-json/v/zhushui/rubick" /></a>
  <a href="https://github.com/zhushui/rubick/actions/workflows/main.yml"><img alt="ci status" src="https://img.shields.io/github/actions/workflow/status/zhushui/rubick/main.yml?label=ci" /></a>
  <a href="https://github.com/zhushui/rubick/blob/master/LICENSE"><img alt="license" src="https://img.shields.io/github/license/zhushui/rubick" /></a>
  <a href="https://github.com/zhushui/rubick/stargazers"><img alt="github stars" src="https://img.shields.io/github/stars/zhushui/rubick?style=social" /></a>
</div>

<div align="center">
  <img align="center" src="https://picx.zhimg.com/80/v2-f8fe09ef125dac5fdcbef3fe00f92b21_720w.png" />
</div>

This repository is a maintained public fork of [rubickCenter/rubick](https://github.com/rubickCenter/rubick). It keeps the Rubick identity and plugin ecosystem compatibility, while this fork focuses on build modernization, tighter runtime boundaries, packaged-build consistency, and long-term maintainability.

## Fork Status

- Public maintained fork with its own release cadence and GitHub Actions automation
- Ongoing compatibility with upstream plugin installation and runtime behavior
- Current focus on the `Vite + tsup + pnpm` toolchain, preload bridge hardening, packaged-build consistency, and plugin/runtime compatibility

## Highlights In This Fork

- Modernized build chain:
  `pnpm workspace`, multi-entry `Vite`, `tsup` for Electron main/preload, and cleanup of legacy Vue CLI artifacts
- Safer Electron runtime:
  internal pages now use bridge-based access with `contextIsolation: true` and `nodeIntegration: false`
- Packaging alignment after the migration:
  runtime path resolution, relative asset loading, feature-app CSP handling, and Lottie bundling were adjusted to match the new build pipeline
- User-facing compatibility fixes:
  plugin compatibility preload, main-window interaction fixes, local launcher handling, and Windows host-file integration updates

## Compatibility Boundaries

- Repository development, CI, and release automation use `pnpm`
- Runtime plugin installation remains npm-compatible through Rubick's installer adapter
- Internal pages now default to a stricter Electron security model
- Existing plugins can continue running through the compatibility preload, while new development should prefer the documented bridge APIs

## Downloads

- [Fork releases](https://github.com/zhushui/rubick/releases)

## Branch And Release Policy

- `master` remains the default branch, the stable branch, and the public release line
- Daily work should start from the latest `master` and use short-lived branches such as `feat/*`, `fix/*`, `chore/*`, `docs/*`, and `refactor/*`
- Pull requests on business branches are used for code review and the `持续集成 (CI)` workflow
- Formal releases are produced by manually triggering the `正式发版 (Release)` workflow
- The release workflow automatically creates `release/v<version>`, updates version files, builds release artifacts, creates the tag, and promotes `master` only after release preparation succeeds
- On failure, the workflow cleans up draft release state and tags while keeping the generated `release/*` branch for troubleshooting
- Published versions must be tracked through GitHub Releases and tags

## Documentation

- [Development Guide (zh-CN)](./DEVELOPMENT.zh-CN.md)
- [Maintenance And Release Policy (zh-CN)](./MAINTAINING.zh-CN.md)
- [Plugin Runtime Compatibility (zh-CN)](./PLUGIN_RUNTIME.zh-CN.md)
- [Upstream Rubick docs](https://rubickCenter.github.io/docs/)
- [Upstream project](https://github.com/rubickCenter/rubick)

## Development

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm package:dir
pnpm package
```

- Node baseline: `>=20`
- Verified baseline in CI and release automation: Node `24`
- `pnpm install` ensures Electron binaries are available and rebuilds native dependencies for Electron
- `pnpm package:dir` is the smoke-package command used in CI

## How To Use Rubick

After installing Rubick, press `Alt/Option + R` to open the main window quickly. You can search applications, plugins, files, and folders directly from the main input box.

If the built-in features are not enough, click the Rubick logo on the left to open the plugin market and install the plugins you need.

## Upstream Resources

This fork still benefits from the upstream plugin ecosystem and related resources:

- [Rubick plugin repositories](https://gitee.com/rubick-center)
- [Rubick plugin database](https://gitcode.net/rubickcenter/rubick-database)
- [Rubick Plugin CLI](https://github.com/rubickCenter/rubick-plugin-cli)

## Feedback And Contribution

- Please use this fork's [Issues](https://github.com/zhushui/rubick/issues) and Pull Requests for fork-specific bugs, maintenance requests, and improvements
- Business-branch pull requests are mainly for code review and base CI, not for immediate public release by themselves
- When a reviewed branch is ready for a public version, use the `正式发版 (Release)` workflow instead of manually managing tags or accumulating pending release code on `master`
- If an issue can be reproduced on upstream Rubick as well, it is still helpful to link or report it upstream
- Documentation, runtime compatibility fixes, packaging fixes, and test improvements are especially welcome

## License

This project remains under the MIT License. See [LICENSE](./LICENSE) for details.
