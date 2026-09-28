---
name: running-tests
description: Run the quality checks (typecheck, lint, unit tests, build) for valorant-impact-lab. Use before opening or updating a PR, or when CI fails.
---

# Running tests and quality checks

## Prerequisites

- Node is managed by nvm and is NOT on PATH in non-interactive shells. Always prefix commands with:
  `source ~/.nvm/nvm.sh`
- Package manager is **pnpm** (lockfile: `pnpm-lock.yaml`). Do not use npm/yarn.
- Install deps (no-op if already installed): `pnpm install --frozen-lockfile`

## Full check (same order as CI / README "Quality Checks")

```bash
cd ~/repos/valorant-impact-lab && source ~/.nvm/nvm.sh
pnpm typecheck   # tsc --noEmit
pnpm lint        # biome check .
pnpm test        # vitest run  (6 files / 26 tests, <1s)
pnpm build       # next build  (~30s)
```

All four must pass before a PR is considered done.

## Scoped runs while iterating

```bash
pnpm exec vitest run src/lib/valorant/__tests__/round-analysis.test.ts   # one file
pnpm exec vitest run -t "clutch"                                          # name filter
pnpm exec vitest                                                          # watch mode
pnpm exec biome check src/lib/valorant/foo.ts                             # lint one file
pnpm format                                                               # biome check --write . (auto-fix)
```

Tests live in `src/lib/valorant/__tests__/*.test.ts` and are configured by `vitest.config.ts`.
They are pure unit tests: no network, no env vars required.

## Notes

- `pnpm build` does not fetch external APIs; it does not need `HENRIKDEV_API_KEY`.
- Lint/format rules come from `biome.json`. Run `pnpm format` before `pnpm lint` if lint reports fixable issues.
