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

This repository is a maintained public fork of [rubickCenter/rubick](https://github.com/rubickCenter/rubick).
It keeps the Rubick product identity and plugin ecosystem compatibility, while this fork focuses on build modernization, tighter runtime boundaries, packaged-build consistency, and long-term maintainability.

## Fork Status

- Public maintained fork with its own release cadence and GitHub Actions workflows.
- Upstream compatibility remains important, especially for plugin installation and runtime behavior.
- Current maintenance focus: `Vite + tsup + pnpm` migration, preload bridge hardening, packaged-build consistency, and Windows integration compatibility under the new architecture.

## Highlights In This Fork

- Modernized build chain:
  `pnpm workspace`, multi-entry `Vite`, `tsup` for Electron main/preload, and cleanup of legacy Vue CLI build artifacts.
- Safer Electron runtime:
  internal pages now use bridge-based access with `contextIsolation: true` and `nodeIntegration: false`, while existing plugins still run through a compatibility preload.
- Packaging alignment after the migration:
  runtime path resolution, relative asset loading, feature-app CSP handling, and Lottie bundling have all been adjusted to match the new build pipeline.
- User-facing polish:
  local-start file selection and drag/drop polish, clearer app/plugin matching and result ordering, improved history/menu behavior, and Windows host-file integration under the new runtime.

## Compatibility Boundaries

- Repository development, CI, and release automation use `pnpm` only.
- Runtime plugin installation is still npm-compatible through Rubick's plugin installer adapter.
- Internal app pages now default to a stricter Electron security model.
- Existing plugins can continue running through the compatibility preload, but new development should prefer the bridge APIs documented in [PLUGIN_RUNTIME.zh-CN.md](./PLUGIN_RUNTIME.zh-CN.md).

## Downloads

- [Fork releases](https://github.com/zhushui/rubick/releases)

## Branch And Release Policy

- `master` remains the default branch, the stable branch, and the only source branch for formal releases.
- Daily work should start from the latest `master` and use short-lived branches such as `feat/*`, `fix/*`, `chore/*`, `docs/*`, and `refactor/*`.
- Formal release tags must be created from the exact current `origin/master` HEAD.
- Unreleased branch code is not a formal release. Published versions must be traced through GitHub Releases and tags.

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
- Verified baseline in CI: Node `24`
- `pnpm install` also ensures Electron binaries are available and rebuilds native dependencies for Electron.
- `pnpm package:dir` is the smoke-package command used in CI before full releases.

## How To Use Rubick

After installing Rubick, press `Alt/Option + R` to open the main window quickly.
You can search applications, plugins, files, and folders directly from the main input box.

If the built-in features are not enough, click the Rubick logo on the left to open the plugin market and install the plugins you need.

## Upstream Resources

This fork still benefits from the upstream plugin ecosystem and related resources:

- [Rubick plugin repositories](https://gitee.com/rubick-center)
- [Rubick plugin database](https://gitcode.net/rubickcenter/rubick-database)
- [Rubick Plugin CLI](https://github.com/rubickCenter/rubick-plugin-cli)

## Feedback And Contribution

- Please use this fork's [Issues](https://github.com/zhushui/rubick/issues) and Pull Requests for fork-specific bugs, maintenance requests, and improvements.
- Use short-lived branches and open Pull Requests targeting `master` instead of accumulating unreleased work directly on `master`.
- If an issue can be reproduced on upstream Rubick as well, it is still helpful to link or report it upstream.
- Documentation, runtime compatibility fixes, packaging fixes, and test improvements are especially welcome.

## License

This project remains under the MIT License. See [LICENSE](./LICENSE) for details.
