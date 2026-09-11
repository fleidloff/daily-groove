# 0019. A groove is sixteen bars of loop, shown as four

- **Status:** ✅ Accepted
- **Date:** 2026-08-31
- **Source:** [feature-9](../../specs/features/feature-9/briefing.md)

## Context

A four-bar render looped by the browser repeats *bit-identically*. The ear locks
onto the loop within two cycles, because the transients are literally the same
bytes — the single biggest reason the grooves did not sound like a band.

## Decision

A groove is rendered as four passes of its four-bar figure — sixteen bars, one
file, fresh humanize deviations and fresh round-robin alternates per pass, with
a fill in the last bar. The manifest carries `loopBars: 16` beside the musical
`bars: 4`, and the app still presents it as a four-bar loop with a repeat
indicator.

## Consequences

- The player is still asked about four bars of music, so nothing about the
  puzzle changes.
- File size went from ~225 KB to ~900 KB a groove. Only the day's groove is
  fetched, so it is a per-visit cost, not a bundle cost.
- `barRole` — which bar of a pass is a fill and which a variation — becomes a
  concept every template has to answer, and a feel with two passes has fewer
  marked bars than one with four. quick-18 spent a ticket on exactly that.
- A crash cymbal is banned: its tail crosses the loop point. `events.test.ts`
  asserts it.
- The loop seam is closed by folding the overhang bar onto bar 1 in `mix.ts`,
  so nothing may ring past the end.
