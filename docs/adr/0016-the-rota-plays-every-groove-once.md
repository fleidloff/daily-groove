# 0016. The rota plays every groove once before it repeats

- **Status:** ✅ Accepted — amends [0003 — The day's groove is a function of the date](0003-the-days-groove-is-a-function-of-the-date.md)
- **Date:** 2026-08-30
- **Source:** [feature-7](../../specs/features/feature-7/briefing.md)

## Context

A per-date hash over the catalogue is uniform, not exhaustive: it will hand out
the same groove twice in a week while others go unplayed for a month.

## Decision

The selection becomes a seeded permutation of the whole catalogue, walked in
order. Every groove plays once before any repeats.

## Consequences

- Still a pure function of the date and still needs no state, so nothing about
  [0001 — Progress lives in the browser only](0001-progress-lives-in-the-browser-only.md) changes.
- Minting a groove changes the permutation's length and so reshuffles every
  unplayed date, which is what `ROTA_EPOCH` and
  [0041 — A played date keeps its groove; `ROTA_EPOCH` reshuffles the rest](0041-a-played-date-keeps-its-groove.md) exist to make safe.
- Refined again by [0046 — The rota spreads mode, root and style over three days](0046-the-rota-spreads-mode-root-and-style.md), which added
  constraints on top of the permutation rather than replacing it.
