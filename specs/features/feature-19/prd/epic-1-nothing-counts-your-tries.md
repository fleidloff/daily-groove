# PRD — Epic 1: Nothing counts your tries

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

The three attempt dots come off the guess card, and nothing takes their place.
Sam can miss as often as they like without the page keeping score; a solve
counts the same on the seventh try as on the first, and only a day that ends
unsolved costs the streak. The attempts themselves keep being written to
`localStorage`, untouched, for a stats view later.

## Problem

Three dots in a row read as three lives. They are par — the card has always let
you keep guessing — and the only place that ever said so was the dots' own
screen-reader label, which nobody sees. So the one visible signal on the card
tells Sam the puzzle has a budget, and Sam is the player who has abandoned three
theory courses because they felt like homework. A counter that implies failure
at four guesses is the same problem in miniature.

## Scope

- the dot row leaves the guess card
- the streak rule is stated and pinned: solved days count, nothing else does
- every player-facing string is re-read for copy that only worked while a count
  was on screen, and a guard keeps it from coming back
- attempts stay in storage exactly as they are

**Out of scope**
- **when Give up appears** — three misses, unchanged. The briefing removed the
  display, not the pacing.
- **any announcement of the streak reset** — no warning on the give-up button,
  no note in the solved panel. "Not a streak of guilt" is the persona's line
  about exactly this.
- **reporting the try count after the day ends** — the solved panel says nothing
  about how many guesses it took, then or later.
- **a stats view** — the data is kept so one becomes possible; nothing reads it
  back in this epic.
- **what the hints say** — feature-18 owns the hint content. This epic only
  removes copy that named a count.
- **the narrowing nudge at two misses** — help, not a budget, and unchanged.

## Requirements

- **R1** — No count of Sam's guesses appears anywhere on the puzzle page, in any
  state: before the first guess, mid-guess, after a solve, and after giving up.
  Not as dots, not as text, not as a screen-reader label or tooltip.
- **R2** — The row that held the dots is gone from the guess card, along with
  its spacing. Nothing replaces it, so the card is shorter by that row.
- **R3** — Every guess Sam checks is still recorded in the day's stored result,
  in order, with the same fields as today (`root`, `flavour`, `correct`,
  `rootMatched`, `flavourMatched`), and survives a reload.
- **R4** — A day counts as solved the moment Sam checks the correct pair,
  however many guesses came before it. The number of guesses affects nothing the
  player can see.
- **R5** — The streak counts solved days only, back from today, one calendar day
  at a time. A day that ends unsolved ends the streak, and all three ways of
  ending unsolved are the same day: given up on, guessed at but left unfinished,
  and never opened. Showing up is not itself a qualifying day.
- **R6** — Solving today after an unsolved yesterday puts the streak at 1. The
  streak is never restored retroactively.
- **R7** — Giving up reveals the answer as it does today and changes nothing
  about how the reset is communicated: the badge simply reads the new number the
  next time it renders.
- **R8** — Nothing Sam can read or hear names an attempt count, a par, or a
  number of tries, and that is guarded by walking the rendered page through
  every state it can be in — fresh, mid-guess, solved, revealed — and checking
  the visible text and the accessible names, rather than by scanning source for
  banned words.
- **R9** — Everything else Sam meets on the page behaves as before: the hint box
  and its escalating advice, the narrowing nudge, the confirmed and ruled-out
  chips, Give up after three misses, the lead sheet, and the solved panel.

## Behaviour details

The streak rule in full, for the four ways a day can end:

| How the day ended | Stored result | Counts toward streak |
| :-- | :-- | :-- |
| Solved, any number of guesses | `solved: true` | yes |
| Given up (answer revealed) | `solved: false`, `revealed: true` | no |
| Guessed, never solved, day passed | `solved: false` | no |
| Never opened | no result | no |

Three of the four already hold: `isQualifying` is `solved` alone, and the walk
back stops at the first day that fails it. The given-up day does not. Today's
result only becomes the anchor when it qualifies, so a solved run met by a
given-up today still reads as the run's length — `computeStreak([Wed solved,
Thu solved, Fri revealed], Fri)` returns 2, which feature-7 epic 3 asserted on
purpose as a grace for the day still in progress.

R5 and R7 change that: revealing the answer anchors the count on today, so the
badge reads 0 as soon as Sam gives up. The grace stays for a day with guesses
but no ending — that day is not over yet. `isQualifying` is untouched, and two
cases in `streak.test.ts` invert.

## Acceptance criteria

- **AC1** (R1, R2) — Given the puzzle is open and no guess has been made, when
  the card renders, then no element carries a dot state and no text or
  accessible label mentions attempts, par, or a number of tries.
- **AC2** (R1) — Given Sam has missed twice, when the card re-renders, then
  there is still no count of those misses anywhere on the page.
- **AC3** (R1) — Given the day is solved, and given the day was given up on,
  when each panel renders, then neither reports how many guesses it took.
- **AC4** (R3) — Given Sam has checked four wrong pairs and then the right one,
  when the page is reloaded, then all five attempts come back from
  `localStorage` in order with their original flags.
- **AC5** (R4) — Given Sam checks the correct pair on the seventh guess, when the
  day is recorded, then it is `solved: true` and the streak is one higher than
  it was yesterday.
- **AC6** (R5) — Given a solved run of days ending yesterday, when today is
  given up on, then the streak reads 0.
- **AC7** (R5) — Given yesterday has no stored result at all, when today is
  solved, then the streak reads 1.
- **AC8** (R5) — Given yesterday was guessed at but never solved and never given
  up, when today is solved, then the streak reads 1.
- **AC9** (R7) — Given Sam gives up, when the answer is revealed, then no text
  anywhere mentions the streak ending, and the badge shows the recomputed value.
- **AC10** (R8) — Given the page is rendered fresh, mid-guess, solved and
  revealed in turn, when the visible text and the accessible names of each state
  are read, then none contains "attempt", "par", or a count of tries — and the
  same test fails if such copy is reintroduced anywhere those states can reach.
- **AC11** (R9) — Given three misses, when the card renders, then Give up is
  offered, and the narrowing nudge, hint line and chip states are unchanged from
  before this epic.
- **AC12** (R2) — Given the feature's structural test runs, when it reads the
  puzzle component list, then `AttemptDots` is absent and the test passes.

## Dependencies

Nothing must exist first. What this epic hands on:

- `lib/presentation/feedback.ts` loses `dotStates`, `DotState` and `DOT_COUNT`;
  anything importing them (`GroovePuzzle`, `GuessCard`, the test harness's
  `dotStates()` helper) loses them too.
- `GuessCard` loses its `dots` prop. That is the contract change any later work
  on the card builds against.
- `Attempt` and `DailyResult` are unchanged — a stats feature later reads the
  attempt list as it is stored today.

## Assumptions

- `docs/coding-guidelines.md` mentions `AttemptDots` in its component list and
  its test list; both get updated with the removal, because a guideline naming a
  file that no longer exists is worse than no guideline.
- The copy sweep is expected to find little. The dots' own label — "N of 3
  attempts spent · 3 is par, not a limit — you can keep guessing" — is the only
  budget copy found so far, and it leaves with the component. The sweep and the
  guard are still in scope: the briefing asked for the sweep, and the guard is
  what makes its result durable.
- The guard's banned wording is "attempt", "par" and a digit followed by
  "tries" / "guesses", case-insensitive. It is a starting list, extended if the
  sweep turns up a phrasing it misses.
- The guard rides in the existing puzzle test harness, which already drives the
  page through those four states, so it needs no new fixture.
- The coaching ladder stays keyed to miss count. It escalates advice as Sam
  keeps missing, which is help rather than a budget, and it never states the
  number.
- `HowToPlay` needs no change — its four steps never mentioned attempts.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there.

### Cycle 1 — 2026-09-03

**Q1. A day Sam guessed at but never solved and never gave up on — does it keep the streak alive?**
Answer: **A) No — any day that ends unsolved ends the streak** — the briefing's
first line is that a puzzle counts when you solve it, so there is one rule and
no second class of day.
Applied to: R5, R6, AC8, Behaviour details

**Q2. How does the guard against attempt-count copy work?**
Answer: **A) Assert on rendered output** — [docs/testing.md](../../../docs/testing.md)
asks for rendered behaviour, and it catches a count however it arrives rather
than only where someone remembered to scan.
Applied to: R8, AC10, Assumptions
