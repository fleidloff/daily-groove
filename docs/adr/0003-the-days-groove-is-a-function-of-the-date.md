# 0003. The day's groove is a function of the date

- **Status:** ✅ Accepted
- **Date:** 2026-08-21
- **Source:** [feature-1, epic 1 Q3](../../specs/features/feature-1/prd/)

## Context

Everyone has to get the same puzzle on the same day, with no server to tell them
which one it is. The first shape considered was a sequential walk through the
seeded grooves, which runs out.

## Decision

The day's groove is a deterministic per-date pick over the whole catalogue,
computed in the browser from the date.

## Consequences

- The rota never runs out and needs no state, which is what keeps
  [0001 — Progress lives in the browser only](0001-progress-lives-in-the-browser-only.md) viable.
- `src/lib/hash.ts` becomes load-bearing in two directions at once — it seeds
  the generator and picks the player's groove — and therefore unchangeable
  ([0020 — Only a groove's identity is frozen; its audio may always re-render](0020-only-identity-is-frozen.md)).
- Adding grooves changes the mapping for every date, which is what
  `ROTA_EPOCH` and [0041 — A played date keeps its groove; `ROTA_EPOCH` reshuffles the rest](0041-a-played-date-keeps-its-groove.md) later had to answer.
- Refined twice since, by [0016 — The rota plays every groove once before it repeats](0016-the-rota-plays-every-groove-once.md) and
  [0046 — The rota spreads mode, root and style over three days](0046-the-rota-spreads-mode-root-and-style.md).

## Alternatives considered

- **A sequential walk from a start date** — simpler, and exhausts the seed set.
