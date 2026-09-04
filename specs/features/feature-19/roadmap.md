# Roadmap — Attempts out of the way

Source: [briefing.md](briefing.md)

## Overview

The three attempt dots read as three lives. They are par, not a limit, and the
label saying so was the only place that ever explained it. This feature takes
the dots off the card, keeps the attempts in `localStorage` for stats later,
pins the rule the dots were confusing — a solve is a solve however many tries it
took, and only giving up or skipping a day breaks the streak — and re-reads
every hint and label for copy that only made sense while a count was on screen.

One epic. The first pass split the removal from the copy sweep, but the three
answered questions took every decision out of the sweep: the give-up offer stays
at three misses, the streak says nothing new, and nothing replaces the dot row.
What is left of the sweep is a read-through of the same two files the removal
edits, so splitting it buys a merge conflict and nothing else.

## Epics

### Epic 1 — Nothing counts your tries

**Visible when done:** Sam guesses wrong twice and nothing on the page counts
it. No dots, no "2 of 3 attempts spent", no sense of lives running out — just
the hint, the chips and Check. Solving on the seventh try gives the same streak
as solving on the first, and a day given up on or never opened leaves the streak
at zero. Give up still appears after three misses, as it does today.
**Depends on:** none
**Parallel with:** none — it is the only epic

**Scope**
- delete `components/puzzle/AttemptDots.tsx` and its test, and the row in
  `GuessCard` that holds it — the row and its spacing go, nothing takes its
  place
- drop `dotStates`, `DotState` and `DOT_COUNT` from `lib/presentation/feedback.ts`,
  and the `dots` memo and prop path through `GroovePuzzle` → `GuessCard`
- keep recording `attempts` in the stored `DailyResult` exactly as today —
  every guess, in order, with its `rootMatched` / `flavourMatched` flags
- pin the streak rule with tests: qualifying is `solved`, a revealed day and a
  missing day both break the chain, and attempt count never enters it
- read every player-facing string for copy that only worked with a counter on
  screen — `lib/presentation/` (`feedback.ts`, `coachingMoves.ts`, `moves.ts`,
  `nearMiss.ts`, `verdict.ts`), the puzzle components, `HowToPlay`, `StreakBadge`,
  the solved panel — and rewrite or drop what it finds
- add a guard test asserting no player-facing copy names an attempt count or a
  par, so the wording cannot drift back
- update the places that name the component: `structure.test.ts`'s puzzle
  component list and the three mentions in `docs/coding-guidelines.md`

**Out of scope**
- the give-up threshold — three misses, unchanged, and `REVEAL_AFTER_MISSES`
  keeps its name
- the streak badge's behaviour and wording; the reset stays silent
- new hint content — feature-18 owns what the hints say
- the coaching ladder's progression: it is keyed to miss count, but it escalates
  advice rather than spending a budget
- reporting the try count anywhere after the puzzle ends, solved panel included

**Validation**
- demo: open the puzzle, miss twice — no dot row anywhere on the card; miss a
  third time and Give up appears as before; solve on the fifth try and the
  streak badge goes up by one
- `GuessCard` and `GroovePuzzle` tests assert no `data-dot-state` element and no
  "attempts spent" text in any state: fresh, mid-guess, solved, revealed
- `lib/persistence/streak.test.ts` covers solved-late, revealed and skipped-day
- `useProgress` / store tests assert the full attempt list still round-trips
  through `localStorage` after a reload
- the copy guard test fails if "attempt", "par" or a try count reappears in
  player-facing strings
- `structure.test.ts` passes with the component gone; full `npm test`, types,
  lint and build clean

## Dependency map

Single epic, no dependencies.

## Execution waves

- **Wave 1:** Epic 1

## Settled

The first pass asked three questions; all three came back on the recommended
option, and they are folded in above:

- **Give up stays at three misses.** The briefing removed the display, not the
  pacing.
- **The streak reset stays silent.** The briefing states the rule; it does not
  ask to announce it.
- **Nothing replaces the dot row.** The row and its spacing go.

## Assumptions

- **The streak rule holds in code except for the given-up day.**
  `lib/persistence/streak.ts` qualifies a day on `solved` alone and walks back
  one calendar day at a time, so tries never counted and a day with no result
  breaks the chain. The anchor is the exception: it shifts to yesterday whenever
  today does not qualify, so a given-up today still reads as yesterday's run,
  which feature-7 epic 3 asserted deliberately as a grace for the unfinished
  day. The epic reverses it for a revealed day, keeps the grace for a day still
  in progress, and pins the rest with tests.
- **The copy sweep may find little.** `AttemptDots`' own label — "N of 3
  attempts spent · 3 is par, not a limit" — is the only budget copy found so
  far, and it leaves with the component. The sweep is still in scope because the
  briefing asked for it, and the guard test is what makes the result durable.
- `Attempt` and `DailyResult` keep their current shape. Stats later will want
  the attempt list, and narrowing it now to save a few bytes would throw away
  exactly what the briefing said to keep.
- The narrowing nudge stays at two misses. It is help, not a budget, and the
  briefing did not mention it.
