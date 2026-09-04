# PRD — Epic 3: Remember my progress (browser persistence, streak & history)

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Results stop vanishing on reload. Each day's play is saved in the browser;
returning the same day shows the already-played state instead of re-asking, and
returning on later days shows a streak and a history of past days. Storage sits
behind a small interface so a future login-backed store can replace it.

## Problem

The briefing asks that "progress should be remembered — for now, only in
browser". Epics 1 and 2 score a single session and forget everything on reload.
This epic makes the daily ritual stick: a reason to come back tomorrow, and no
lost results.

## Scope

- Persist each day's `DailyResult` in the browser (localStorage), keyed by date,
  including which attributes were attempted and how each scored.
- An "already played today" state that blocks re-guessing and shows the stored
  result (the groove can still be replayed).
- A streak count and a simple history view of past days and their results.
- A storage interface in the feature's `lib/` so localStorage can later be
  swapped for a login-backed store without touching the UI.

**Out of scope**
- Accounts, login, and server sync — future. The interface leaves room; no
  backend is built here.
- Cross-device or cross-browser sync — persistence is per-browser only.
- Changing how a puzzle is played or scored — that's Epics 1 and 2.

## Requirements

- **R1** — When the player completes a day's puzzle, the `DailyResult` is saved
  to browser storage, keyed by its date.
- **R2** — On opening the app for a date that already has a saved result, the
  player sees the already-played state with their stored result, and cannot
  re-guess that day; they can still replay the groove.
- **R3** — The app shows a current streak: the run of consecutive days up to
  today where the saved result **qualifies**. A day qualifies when at least one
  attempted attribute was guessed correctly. A played day with zero correct
  attempted attributes does not qualify and breaks the streak, even though it is
  still saved and shown in history.
- **R4** — The app shows a history of past played days with each day's result.
- **R5** — On first run, with no saved results, the player sees a clean empty
  state (zero streak, empty history) and can play normally.
- **R6** — All persistence goes through a storage interface in `lib/`; the UI
  never reads or writes localStorage directly.
- **R7** — Saved results survive reloads and browser restarts (until the user
  clears browser storage).

## Behaviour details

The streak counts back from today over consecutive calendar days, stopping at
the first day that does not qualify. A day qualifies when its saved result has
at least one attempted attribute correct. Two things break the run: a **gap**
(a calendar day with no saved result) and a **non-qualifying played day** (saved
but with zero correct attempted attributes). Both are treated the same for the
streak; the non-qualifying day still appears in history with its result.

## Acceptance criteria

- **AC1** (R1, R7) — Given a completed puzzle, when the player reloads, then the
  stored result for today is shown and not re-asked.
- **AC2** (R2) — Given today already has a saved result, when the player opens
  the app, then guessing is disabled, the result is shown, and replay still
  works.
- **AC3** (R3) — Given consecutive days up to today each with at least one
  attempted attribute correct, when the app loads, then the streak equals that
  run of days.
- **AC4** (R3) — Given a gap day with no result, when the app loads, then the
  streak reflects the break rather than counting through the gap.
- **AC7** (R3) — Given a played day whose saved result has zero correct attempted
  attributes, when the app loads, then that day does not count toward the streak
  (the run stops there) but still appears in history.
- **AC5** (R5) — Given no saved results, when the app loads, then streak is zero
  and history is empty, and the player can play today normally.
- **AC6** (R4) — Given several past played days, when the player views history,
  then each appears with its recorded result.

## Dependencies

- **Requires (from Epics 1 & 2):** the finalized per-attribute `DailyResult`
  shape `{ date, guesses, correctness }`. Epic 3 can start against this contract
  before Epic 2's UI is finished.
- Provides no downstream contract within this feature.

## Decisions

Carried from the roadmap's resolved questions:

- **Browser-only persistence for now** — localStorage, keyed by date, behind a
  `lib/` interface that a future login-backed store can replace.
- **Player picks which attributes to guess** (from Epic 2) — a saved result may
  cover only some attributes, which is why the streak-success rule matters.
- **Streak qualifies on ≥1 attempted attribute correct** — a day keeps the
  streak alive if the player got at least one attempted attribute right. Chosen
  over "played at all" (too lenient to signal skill) and "all attempted correct"
  / "full solve" (which would punish the opt-in-more-attributes design by making
  ambition riskier).

## Assumptions

- History shows all past played days (most recent first); no pagination until it
  proves necessary.
- A broken streak resets to reflect only the current consecutive run (0 when
  today is unplayed, 1 once today qualifies).
- Stored results are keyed by the same ISO date used for daily selection, so a
  stored day maps unambiguously to its groove.

## Question log

### Cycle 1

- **Q1. Streak-success rule → C) At least one attempted attribute correct.** A
  day qualifies for the streak when the player got ≥1 attempted attribute right.
  Shaped R3, the Behaviour details, and AC3/AC4/AC7 (added a case for a played
  but non-qualifying day).
