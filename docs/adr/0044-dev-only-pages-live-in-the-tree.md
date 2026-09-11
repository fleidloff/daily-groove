# 0044. Dev-only pages live in the tree and not in the build

- **Status:** ✅ Accepted
- **Date:** 2026-09-05
- **Source:** [quick-7](../../specs/quick/7-dev-groove-preview.md)

## Context

Verifying upcoming grooves meant waiting for their day or editing the date. What
was needed was a page listing the whole catalogue in rota order — useful to
whoever builds the app, and not something a player should find.

## Decision

A route file suffixed `.dev.tsx` is compiled under `next dev` and absent from a
production build. `src/app/dev/grooves/page.dev.tsx` is the first: every groove
in the catalogue, ordered by date, playable, with each lick variation
triggerable in time over the running loop.

## Consequences

- The suffix is the whole mechanism, so adding a dev-only screen costs nothing
  and shipping one by accident is a build-config change rather than a slip.
- The preview reads the *unpinned* `selectGrooveForDate`, because it previews the
  rota rather than what a player with saved results would see — the one
  deliberate exception to
  [0041 — A played date keeps its groove; `ROTA_EPOCH` reshuffles the rest](0041-a-played-date-keeps-its-groove.md).
- `components/dev/` is in the shell module but is no region of the page, and
  `docs/architecture.md` says so rather than filing it somewhere it does not
  belong.
- A test asserts the route is reachable in dev and absent from a production
  build, because nothing else would notice.
