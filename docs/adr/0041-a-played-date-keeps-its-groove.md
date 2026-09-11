# 0041. A played date keeps its groove; `ROTA_EPOCH` reshuffles the rest

- **Status:** ✅ Accepted
- **Date:** 2026-09-05
- **Source:** [feature-25, epic 6](../../specs/features/feature-25/prd/) · [docs/music.md](../music.md#what-must-never-change)

## Context

Minting grooves changes the catalogue length, which changes the permutation in
[0016 — The rota plays every groove once before it repeats](0016-the-rota-plays-every-groove-once.md) and so remaps every date. Appending new
grooves to an order players already know is the alternative, and it means the
new styles only ever appear at the end.

## Decision

`ROTA_EPOCH` is the one value in the rota that is *meant* to move: every release
that mints grooves bumps it by one, and the whole catalogue reshuffles. A date
the player has already played keeps its groove, pinned from the stored result —
so `lib/puzzle/dailyGroove.ts` is the only resolver of the day's groove, and it
composes the rota with the stored pin.

## Consequences

- A bump re-renders nothing and reassigns no answer a player holds. It changes a
  seed string, not `hashString`, so `src/lib/hash.ts` and its fixed table are
  untouched — a reshuffle rather than a re-release.
- Unplayed past dates do move. Opening yesterday after a bump shows a different
  groove than it would have.
- Every resolution of a date goes through `dailyGroove.ts`. The one caller that
  deliberately uses the unpinned `selectGrooveForDate` is the dev preview, which
  previews the rota rather than what a player with saved results would see.
- Forgetting the bump is silent: the new grooves simply sit at the end of the
  order. `docs/music.md` carries the rule for that reason.
