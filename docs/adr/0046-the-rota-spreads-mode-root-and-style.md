# 0046. The rota spreads mode, root and style over three days

- **Status:** ✅ Accepted — amends [0016 — The rota plays every groove once before it repeats](0016-the-rota-plays-every-groove-once.md)
- **Date:** 2026-09-06
- **Source:** [quick-11](../../specs/quick/11-no-repeats-within-three-days.md)

## Context

A permutation of the catalogue plays every groove once, but says nothing about
what sits next to what. Three dorian days running, or three days in the same
style, reads as a broken rota even though every groove is distinct.

## Decision

Within any three consecutive days, no mode, no root and no style repeats. The
style has to be readable from the manifest for the constraint to have data, so
every entry in `GROOVES` carries its template.

## Consequences

- The rota stays a pure function of the date, with the constraints applied as a
  filter over the permutation rather than as stored state.
- Adding the style to the manifest is a manifest-only change and re-renders no
  audio.
- The constraint can only be satisfied while the catalogue is diverse enough in
  all three dimensions at once. A style that monopolises a mode makes it harder
  to satisfy, which is part of what
  [0040 — A feel carries two to four modes, and the sets may overlap](0040-a-feel-carries-two-to-four-modes.md) and quick-18 were fixing.
- A test walks a long run of consecutive days and looks for a violation, because
  the failure is statistical and would not show up in a single-date test.
