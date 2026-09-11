# 0033. Coaching has one door, and the card feeds itself

- **Status:** ✅ Accepted
- **Date:** 2026-09-02
- **Source:** [feature-20, epics 2 and 3](../../specs/features/feature-20/prd/)

## Context

`GroovePuzzle.tsx` was the serialization point of the whole repo: 9 of the last
40 commits, 395 lines, 25 imports and 28 props drilled into `GuessCard`. It had
been cut along hooks once already, in feature-14, and grown back. Meanwhile
`lib/presentation/` was nine modules and climbing, and it was where features
kept landing.

## Decision

`lib/presentation/` gets one entry point — attempts and settings in, view model
out — and `GuessCard` calls it directly through a hook instead of receiving the
view model as props. The composer may not reach past the door. A module
boundary only the parent may cross is not a boundary.

## Consequences

- `GroovePuzzle.tsx` stops being a prop bus, so two tracks can edit the card and
  the page at once.
- `GuessCard` is no longer testable without the puzzle session standing up
  behind it. That was the explicit trade for "feeds itself".
- The view model speaks domain shapes, not `ChipOptionState`, so
  `lib/presentation/` holds no UI types and a `ChipGroup` change stays a
  component-level change.
- The door is enforced by `src/features/daily-groove/structure.test.ts`, which
  rejects an import from the composer into a module inside
  `lib/presentation/`.
- The other four folders got no door: their import counts have been flat or come
  back down, so a regrowth there is caught by review alone — which is what
  failed the two previous times the composer was cut. Adding a door later is one
  `index.ts` and one entry in the guard's ignore list.
