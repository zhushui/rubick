## Summary

- What changed?
- Why was it needed?
- Branch name follows `feat/*`, `fix/*`, `chore/*`, `docs/*`, or `refactor/*`

## Release Readiness

- [ ] This branch has completed the intended code review
- [ ] `持续集成 (CI)` has passed for the latest branch commit
- [ ] Public release, if needed, will be triggered through the `正式发版 (Release)` workflow

## Verification

- [ ] `pnpm lint`
- [ ] `pnpm build`
- [ ] `pnpm package:dir`
- [ ] Manual smoke test for the affected flow

## Compatibility Notes

- Does this change touch plugin runtime compatibility?
- Does this change affect packaged builds on Windows/macOS/Linux?

## Documentation

- [ ] README updated when user-facing behavior changed
- [ ] Runtime/development docs updated when build or bridge contracts changed
- [ ] Branch/release policy docs updated when release discipline or maintenance flow changed
