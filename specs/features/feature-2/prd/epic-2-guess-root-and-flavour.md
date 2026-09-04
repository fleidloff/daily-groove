# PRD — Epic 2: Guess the root and the flavour

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md) · Design: [Daily Groove.dc.html](../Daily%20Groove%20webapp%20design/Daily%20Groove.dc.html)

## Summary

Replaces feature-1's subset-guessing flow with the game the design actually
encodes: pick one root from twelve and one flavour from four, then check the
pair. This epic carries the domain rewrite — new types, store, scoring and
per-day option sets — because that is what makes the new game visible, and it
pins the domain contract Epics 3–5 build against.

## Problem

Feature-1 lets the player opt into any subset of scale, chord and progression and
submit once. The design has no such concept: it presents two chip rows and a
single "Check G Dorian" button, and the whole visual language of the guessing
card assumes that shape. The two models cannot both exist, so the old one is
retired here.

## Scope

- `Root` and `Flavour` types, their chip sets, and derivation of each groove's
  answer from its existing `scale` field.
- Per-day narrowing of the flavour options.
- New store shape and pair-based scoring.
- Generic `Chip`, `ChipGroup` and `Button` primitives, and the guessing card
  built from them.
- Retiring the subset-guessing model and its components.

**Out of scope**
- Attempt dots, targeted feedback copy, and the nudge — Epic 3. This epic gives a
  single plain correct/incorrect response.
- The designed solved panel — Epic 4.
- Persisting attempts across reloads — Epic 5. A reload restarts the day.
- Guessing chord or progression: they remain data, revealed in Epic 4, never
  guessable.

## Requirements

- **R1** — The guessing card presents two labelled groups: "Root" and "Flavour".
- **R2** — The root group offers all twelve chromatic notes, every day, as
  equal-width chips.
- **R3** — The flavour group offers four options, drawn deterministically from the
  day's date, and always including the correct one. The pool is the set of
  flavours the seed grooves actually use.
- **R4** — The same calendar day always yields the same four flavour options, for
  every player and across reloads.
- **R5** — Each group is single-select. Choosing a different chip in a group
  replaces the current selection.
- **R6** — The day's answer is derived from the groove's existing `scale` field:
  `"G mixolydian"` yields root `G` and flavour `Mixolydian`. Seed values are
  lowercase; chips display the design's capitalisation.
- **R7** — The check control is disabled until both a root and a flavour are
  selected. Until then it reads "Pick a root and a flavour".
- **R8** — Once both are selected, the control reads "Check " followed by the
  chosen pair, e.g. "Check G Dorian".
- **R9** — A guess is correct only when both the root and the flavour match the
  day's answer. A half-right pair is incorrect.
- **R10** — On checking, the player is told whether the pair was right or wrong.
- **R11** — After a wrong check both chips stay selected, and the check control is
  disabled until the player changes the root or the flavour. The same pair can
  never be submitted twice in a row.
- **R12** — Once the day is solved, the chips stop accepting input and the control
  reads its solved treatment.
- **R13** — Chips render idle, selected, disabled, hover and focus-visible states
  in both palettes, and the whole flow is operable by keyboard and screen reader.
- **R14** — `Chip`, `ChipGroup` and `Button` live in `src/components`, are
  prop-driven, and carry no musical or domain vocabulary.
- **R15** — Both chip rows wrap and reflow without overflowing at 375px.

## Behaviour details

The flavour narrowing reuses feature-1's `buildOptions(correct, pool, seed)`,
which already returns the correct answer plus deterministic distractors, four by
default. Seeding it with the day's ISO date satisfies R3 and R4 together.

The old model is removed rather than adapted: `Attribute`, `AttributeSelector`,
`AttributePicker`, `scoreSelected` and the per-attribute `DailyResult` shape all
go, along with their colocated tests. `buildOptions`, `hashString`, `isoDate` and
`selectGrooveForDate` survive unchanged.

## Acceptance criteria

- **AC1** (R2, R3) — Given today's puzzle, when the card renders, then twelve root
  chips and exactly four flavour chips are offered.
- **AC2** (R3) — Given any calendar day, when the flavour options are built, then
  the day's correct flavour is among them.
- **AC3** (R4) — Given a fixed date, when the options are built repeatedly, then
  the same four flavours come back in the same order.
- **AC4** (R6) — Given a groove whose scale is `"A dorian"`, when the answer is
  derived, then the root is `A` and the flavour is `Dorian`.
- **AC5** (R5) — Given a root is selected, when the player picks a different root,
  then only the new one is selected.
- **AC6** (R7, R8) — Given nothing is selected, when the card renders, then the
  control is disabled and reads "Pick a root and a flavour"; when both are
  selected, it is enabled and names the pair.
- **AC7** (R9) — Given the answer is G Dorian, when the player checks G Mixolydian
  or C Dorian, then the result is incorrect.
- **AC8** (R9, R10) — Given the answer is G Dorian, when the player checks G
  Dorian, then the result is correct.
- **AC9** (R11) — Given a wrong check of G Mixolydian, when the result is shown,
  then both chips are still selected and the check control is disabled; when the
  player picks a different flavour, the control becomes enabled again.
- **AC10** (R12) — Given the day is solved, when the player clicks a chip, then the
  selection does not change.
- **AC11** (R13) — Given a keyboard-only player, when they tab to a chip group,
  then they can select a chip and reach the check control without a pointer.
- **AC12** (R14) — Given the repository, when `Chip`, `ChipGroup` and `Button` are
  inspected, then none references roots, flavours, grooves or any other domain term.
- **AC13** (R15) — Given a 375px viewport, when both chip rows render, then they
  wrap and nothing overflows horizontally.

## Dependencies

Needs Epic 1's token names and primitive APIs — the contract, not the finished
code, so this epic can start alongside it.

Hands the domain contract to Epics 3–5, to be frozen before Wave 3 starts:

- `Root`, `Flavour`, and an `Attempt` of `{ root, flavour, correct }`.
- The store's shape: selected root, selected flavour, the attempt list, solved.
- The scoring signature: an answer plus a pair yields a correctness verdict, with
  the half-match information Epic 3 needs for its feedback branches.

## Assumptions

- Clicking the selected chip again does not deselect it; selection is replaced,
  never emptied, once made.
- The flavour pool is derived from the seed data at module load rather than
  hard-coded, so adding a groove with a new flavour widens the pool automatically.
- The design's fixed-width root chips and content-width flavour chips are kept;
  with four flavours the second row simply sits lighter than the canvas' eight.
- Root chips show sharps as the canvas does (C♯, F♯) with flats where the canvas
  uses them (E♭, A♭, B♭); the seed data uses only naturals, so no enharmonic
  matching is needed yet.
- While the check control is disabled after a wrong guess it keeps naming the
  chosen pair rather than reverting to the prompt; the feedback line carries the
  explanation, so the button does not have to.

## Question log

### Cycle 1 — 2026-08-29

**Q1. After a wrong check, what happens to the selection?**
Answer: **A) The selection stays, and the control disables until the player
changes the root or the flavour** — keeps the design's persistent chips while
making it impossible to spend a second attempt on a pair already known to be
wrong.
Applied to: R11, AC9, Assumptions
