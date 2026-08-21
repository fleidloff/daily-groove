# PRD — Epic 1: Play today's groove and take a guess (walking skeleton)

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

The thinnest end-to-end Daily Groove: a player opens the app, hears today's
groove, guesses its scale from a set of options, and sees whether they were
right. This epic also pins the three contracts the rest of the feature builds on
— the seed-groove shape, the audio-playback utility, and the `DailyResult`
record.

## Problem

There is no app yet — an empty Next.js scaffold. Before any of the richer
guessing or progress features can exist, we need one real, playable slice that
proves the loop works: pick a groove for the day, play it, take a guess, score
it. Everything else in the roadmap thickens this slice.

## Scope

- The `daily-groove` feature slice under `src/features/daily-groove` and its
  route under `src/app`, including the basic app layout/shell.
- A small bundled seed set of grooves: one pre-rendered audio file per groove
  plus scoring metadata (scale, chord, progression).
- Deterministic daily selection of one groove from the calendar date.
- Browser playback of the selected groove's audio file, with play/replay.
- A single guess dimension: the **scale**, via a constrained multiple-choice
  picker, scored on submit with the answer revealed.

**Out of scope**
- Guessing chord and chord progression, and choosing which attributes to guess —
  Epic 2.
- Persisting results, streaks, history, "already played today" — Epic 3. This
  epic scores a single in-memory session; a reload starts fresh.
- Creating or authoring grooves — out of the whole feature per the briefing.
- Accounts/login — future.

## Requirements

- **R1** — On opening the app the player sees the Daily Groove layout: today's
  puzzle with a play control and the scale picker.
- **R2** — The player can play and replay today's groove any number of times
  before and after guessing, via a visible play/replay control.
- **R3** — The day's groove is chosen by a deterministic function of the
  calendar date across the entire seed set — a fixed per-date pick, not a
  sequential walk. The same date always yields the same groove for every player
  (stable across reloads), and because it is a hash-style pick over the whole
  set it never runs out as days advance (it may revisit a groove out of order).
- **R4** — The player guesses the scale by selecting one option from a
  constrained multiple-choice picker; only one option can be selected. Scale
  answers are **absolute** — root plus quality, e.g. "C minor", "A dorian".
- **R5** — On submit, the app scores the scale guess and shows the result —
  correct or incorrect — with the correct scale revealed.
- **R6** — Scoring produces a `DailyResult` in the shape
  `{ date, guesses, correctness }` (see Dependencies), held in memory for the
  session.
- **R7** — If the groove's audio fails to load or play, the player sees a clear
  error with a retry affordance; the rest of the UI stays usable.
- **R8** — Before submitting, the player cannot see the correct answer; after
  submitting, the picker locks and the answer is shown.

## Acceptance criteria

- **AC1** (R3) — Given a fixed calendar date, when the app selects the groove,
  then it returns the same groove across repeated calls/reloads; a far-future
  date still resolves to a valid groove from the set (selection never exhausts).
- **AC2** (R4, R5) — Given today's groove, when the player selects the correct
  scale and submits, then the result shows "correct" and reveals the scale.
- **AC3** (R5, R8) — Given today's groove, when the player selects a wrong scale
  and submits, then the result shows "incorrect", reveals the correct scale, and
  the picker is locked.
- **AC4** (R2) — Given the puzzle, when the player presses play multiple times,
  then the groove audio plays each time without affecting the guess state.
- **AC5** (R7) — Given an audio file that fails to load, when the player opens
  the puzzle, then an error with retry is shown and the picker still renders.

## Dependencies

Hands the following contracts to Epics 2 and 3 — name-stable so they can build
in parallel:

- **Seed groove shape** — `{ id, audioSrc, scale, chord, progression }`, where
  `scale` (and later `chord`, `progression`) are **absolute** values —
  root + quality, e.g. `scale: "C minor"`.
- **`DailyResult`** — `{ date: ISO-date-string, guesses: {...}, correctness:
  {...} }`. Epic 1 populates only the `scale` slots; Epics 2 and 3 extend and
  persist the same record.
- **Audio-playback utility** — a small `lib/` wrapper the UI calls to play the
  current groove, so no component touches the audio element directly.

## Decisions

Carried from the roadmap's resolved questions:

- **Deterministic daily puzzle** — one groove per calendar date, shared and
  stable across reloads. This is the basis streaks later depend on.
- **Constrained pickers** — guesses are multiple-choice, not free-text or an
  instrument control.
- **Pre-rendered audio files** — each seed groove ships as a bundled audio asset
  played through the audio utility, not synthesized.

Settled during the interview:

- **Absolute answers (root + quality)** — the scale (and later chord and
  progression) is identified by its full value, e.g. "C minor", not just the
  quality. Distractor pickers must therefore be built from absolute values.
- **One guess per attribute** — the player submits once and the answer is
  revealed; no multiple attempts or hints.
- **Deterministic-per-date pick across the whole set** — the day's groove is a
  hash-style function of the date over the entire seed set, so it never exhausts
  and needs no cycling/wrap logic.

## Assumptions

- Each scale picker shows the correct absolute answer plus a fixed, small number
  (~4–6 total) of distractors sampled from the space of valid scale values. The
  option set is deterministic per day, so a reload shows the same options.
- The seed audio files are provided as content; this epic bundles whatever files
  exist and does not generate them.
- Test runner is Vitest + React Testing Library, colocated per docs/testing.md.

## Question log

### Cycle 1

- **Q1. Answer granularity → B) Root + quality (absolute).** Full absolute
  answers rather than type/quality-only. Shaped R4 (absolute scale answers), the
  seed-shape note in Dependencies, and the distractor assumption.
- **Q2. Attempts per guess → A) One guess, then reveal.** Confirmed the
  single-guess model already in R4/R5/R8; recorded as a decision.
- **Q3. Past the last seed groove → C) Deterministic-per-date pick across the
  whole set.** Selection is a per-date pick over the entire set, not a
  sequential walk, so it never runs out. Reshaped R3 and AC1; removed the
  cycling/exhaustion framing.
