# 0006. Grooves are pre-rendered MP3s from an offline generator

- **Status:** ✅ Accepted
- **Date:** 2026-08-29
- **Source:** [feature-3](../../specs/features/feature-3/briefing.md)

## Context

The app needs a groove a day that sounds like music. Two ways: synthesise in the
browser at page load, or render files ahead of time and ship them.

## Decision

A Node generator under `scripts/grooves/` renders each groove to an MP3 at
development time. The files and a manifest of their answers are committed. The
app only plays audio; it never makes it.

## Consequences

- What the player hears can be auditioned before anyone hears it, which is what
  makes a listening sign-off possible at all
  ([0008 — How a groove sounds is settled by ear](0008-how-a-groove-sounds-is-settled-by-ear.md)).
- The browser downloads one MP3 for the day, so groove length is a per-visit
  cost and not a bundle cost.
- The generator and the app both need the music theory, which is the pressure
  that eventually produced
  [0032 — Music theory is shared code in `src/lib/theory`](0032-music-theory-is-shared-code.md).
- Every change to how grooves sound is a re-render and a commit of binary
  files, and the catalogue's audio is therefore part of the repo's weight.
- A groove cannot be personalised, generated on demand, or vary per player.

## Alternatives considered

- **Synthesise in the browser** — no files to ship, and no way to hear a groove
  before the player does.
