# 0032. Music theory is shared code in `src/lib/theory`

- **Status:** ✅ Accepted
- **Date:** 2026-09-02
- **Source:** [feature-20, epic 1](../../specs/features/feature-20/prd/)

## Context

The same domain existed twice: `scripts/grooves/theory/` held scales, pitches,
harmony and validity for the generator, and
`src/features/daily-groove/lib/theory/` held naming, degrees, staff and licks
for the app. They shared only the 32 lines of types in `src/lib/groove.ts`.
Anything needing both sides paid double — feature-11's real notes and
feature-16's licks both did.

## Decision

One body of theory in `src/lib/theory/`, imported by the app through `@/` and by
the generator by relative, extension-bearing path. `src/lib/` stays a leaf: it
imports nothing from the app, which is exactly what lets the generator read it
with no bundler and no alias in play. No compatibility shims — every call site
moved in one epic, and the epics ran in sequence.

## Consequences

- The twelve-mode vocabulary has one owner, so a mode added to `FLAVOURS` is
  added once.
- `src/lib/theory/` may never import from the app. That is zone 4, and
  `leaf.test.ts` stands behind it.
- The generator's whole crossing is five files — `theory/names.ts`,
  `theory/roots.ts`, `theory/scales.ts`, `groove.ts` and `hash.ts` — and
  `scripts/grooves/boundary.test.ts` scans the source to keep a path string
  from becoming a sixth.
- Proving the move changed nothing meant re-rendering the full catalogue to a
  scratch directory and hashing every MP3 against the lock, once, as the exit
  gate. `docs/music.md` treats a silent re-render as the worst failure this
  codebase has.
