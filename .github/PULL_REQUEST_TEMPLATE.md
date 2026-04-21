## Summary

- What changed?
- Why was it needed?
- Branch name follows `feat/*`, `fix/*`, `chore/*`, `docs/*`, or `refactor/*`

## Release Readiness

- [ ] This PR is ready to be released immediately after merging into `master`
- [ ] `package.json.version` has been confirmed or bumped for the version that should be released from this merge

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
