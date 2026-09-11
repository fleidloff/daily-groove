# 0049. A comp figure may span more than one bar

- **Status:** ✅ Accepted
- **Date:** 2026-09-08
- **Source:** [quick-15](../../specs/quick/15-multi-bar-comp-patterns.md)

## Context

Every pattern pool held one bar of sixteenth-grid steps, capped at `0…15` by
`assertSteps`. A bossa's clave alternates over two bars, so the piano repeated
one bar against a figure that did not — audibly wrong, and unfixable inside a
one-bar pool.

## Decision

A comp figure is one flat list of sixteenth steps that may run past 15:
`bar = step >> 4`, `within = step & 15`, and the figure's length is
`(max >> 4) + 1`. The field stays `patterns.comp` and the type stays
`number[][]` — a pool of figures, one drawn per groove, exactly as before. Every
bar of a figure must sound: a bar with no steps is rejected at load, naming the
template and the bar.

## Consequences

- Rejecting an empty bar is a musical rule, not a parser convenience. The puzzle
  asks the player to name the chord and the comp is what states its quality, so
  a resting bar is a bar with no answer in it. It also makes the derived length
  unambiguous.
- Backward compatible by construction: every existing figure sits under 16 and
  decodes to one bar, so only bossa's six grooves re-rendered.
- Keeping bossa's pool at four entries keeps the draw index identical, so the
  rhythm stream does not shift — the constraint
  [0020 — Only a groove's identity is frozen; its audio may always re-render](0020-only-identity-is-frozen.md) puts on every generator change.
- `compIndex` has to be read per bar rather than built once for the figure, or
  `COMP_ACCENTS` restarts each bar instead of cycling the whole phrase.
- Bass keeps the one-bar limit. The fork is now explicit: a multi-bar phrase
  drawn per groove goes in `patterns`, and one that never varies goes in
  `figures`.
