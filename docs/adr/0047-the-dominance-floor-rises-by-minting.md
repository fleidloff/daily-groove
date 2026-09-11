# 0047. The dominance floor rises by minting, not by widening the ratio

- **Status:** ✅ Accepted
- **Date:** 2026-09-06
- **Source:** [quick-12](../../specs/quick/12-raise-the-dominance-floor.md)

## Context

`DOMINANCE_RATIO` guards against one mode swallowing the catalogue. Its floor
was `lydian-dominant` at one groove, offered by `open-ballad` alone, which
shipped two — so every new style pushed the commonest mode up while the floor
stayed put, and the ratio had already been widened 5 → 6 during feature-25.

## Decision

Raise the floor by minting more grooves in the thin style, rather than widening
the guard again. The guard is a guard against one mode swallowing the catalogue,
not a coverage target.

## Consequences

- Asked directly, the persona's answer was "I can't feel a ratio. I can feel a
  repeat" — so the guard is a safety rail and the minting is the actual fix.
- Minting changes the catalogue length, which reshuffles the rota, so this bumps
  `ROTA_EPOCH` ([0041 — A played date keeps its groove; `ROTA_EPOCH` reshuffles the rest](0041-a-played-date-keeps-its-groove.md)).
- `DOMINANCE_RATIO` is duplicated in three test files and they have to stay in
  step: `scripts/grooves/catalogue.test.ts`,
  `scripts/grooves/manifest.test.ts` and
  `src/features/daily-groove/data/grooves.generated.test.ts`.
- Every new groove has to pass all seven gate checks and get a listening
  sign-off ([0008 — How a groove sounds is settled by ear](0008-how-a-groove-sounds-is-settled-by-ear.md)), so raising the
  floor costs ears, not a constant.
- The uuid freeze tables gain the new grooves, in both copies.
