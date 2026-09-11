# 0025. The test suite runs in tiers

- **Status:** ✅ Accepted
- **Date:** 2026-09-01
- **Source:** [feature-14](../../specs/features/feature-14/briefing.md)

## Context

The generator's render tests were 83% of `npm test`'s wall clock, and most
features never touch `scripts/`. Every feature was taking longer than the last,
and the test run was the largest single reason.

## Decision

The audio-render tests are a separate project, `npm run test:gen`, outside the
default run. The generator tier runs when an epic touches `scripts/`.

## Consequences

- The app suite is fast enough to run on every change, which is what the TDD
  loop in the build skills depends on.
- The generator tier can be forgotten. It is `prebuild`'s `grooves:verify` and
  the epic's own discipline that catch it, not the default `npm test`.
- The 30 s `testTimeout` patch could come off once the two projects stopped
  competing for cores.
- Path routing decides which tier runs, so `scripts/tiers.test.ts` exists to
  pin it — and `scripts/grooves/boundary.test.ts` to stop a routing path string
  from quietly becoming a dependency.
