# 0031. Six modules in one repo, not services

- **Status:** ✅ Accepted
- **Date:** 2026-09-02
- **Source:** [feature-20](../../specs/features/feature-20/briefing.md) · [docs/architecture.md](../architecture.md#the-arrows-inside-a-slice)

## Context

Every feature so far had landed in `src/features/daily-groove/`, so the
parallelism the slice shape promises never fired. The concerns were real but
existed only in the head of whoever was reading the diff, and a dispatched
worker had nothing telling it what its concern may reach.

## Decision

Name the six modules that are already real — catalogue, theory, audio, puzzle,
coaching, shell — and write the arrows between them down as a map, with a lint
zone or a structural test behind each one that can carry it. Not
microservices: there is nothing to split at runtime, and no behaviour changes.

## Consequences

- The modules are not the folders. `puzzle` spans three folders and four hooks,
  `audio` reaches outside `lib/audio/` for three, `catalogue` straddles
  `scripts/` and `data/`.
- Only one module has a door, because a door can only ever be one folder's
  `index.ts` ([0033 — Coaching has one door, and the card feeds itself](0033-coaching-has-one-door.md)). The map is how a reader groups
  the code; a door is what an import rule can check; the two do not line up, and
  that is not a defect.
- Four rows of the map read "review only", and naming which four is the
  difference between a scope and an oversight.
- The map describes the tree, not the other way round. A map that has drifted
  from the import graph is worse than no map, because it is believed.
- No second `features/` slice was created. A slice for its own sake is just a
  folder; it waits for a screen that isn't the puzzle.
