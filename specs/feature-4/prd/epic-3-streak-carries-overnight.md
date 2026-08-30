# PRD — Epic 3: The streak carries overnight

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Fixes a streak that resets to zero every midnight. The run of consecutive
qualifying days is counted ending at today, or — when today has not been solved
yet — ending at yesterday, so a player who solved yesterday sees their streak
intact when they arrive this morning instead of being told they have none.

## Problem

`computeStreak` walks back from today and stops at the first day that is absent
or non-qualifying. Today is always the first day it looks at, and a day the
player has not yet solved never qualifies — so the streak reads 0 for every
visitor every morning, right up until they solve. A player who has solved five
days running is told "No streak yet" the moment they arrive on the sixth. The
number is at its most wrong exactly when it is most motivating, which makes it
worse than not showing one.

## Scope

- The rule `computeStreak` implements.
- The tests that pin that rule, including the "one missed day clears it" case
  the briefing asks about.

**Out of scope**
- The badge's wording and position — Epic 1. This epic changes only the number.
- Persisting the streak. It stays derived from the result set on every read, so
  it can never drift from the records.
- A longest-ever streak, a streak history, or any freeze/repair mechanic.
- Changing what makes a day qualify beyond what Q1 below settles.

## Requirements

- **R1** — The streak is the number of consecutive qualifying days ending at
  today when today qualifies, and ending at yesterday otherwise.
- **R2** — When neither today nor yesterday qualifies, the streak is 0.
- **R3** — A day qualifies only by being solved. The number of attempts it took
  does not matter; whether it was solved does.
- **R3a** — A calendar day with no record at all is not qualifying, and ends the
  run. One such day between two solved days clears the streak — this is the
  briefing's "1 day without trying clears the streak", and it is asserted, not
  assumed.
- **R3b** — A past day that was attempted but never solved is not qualifying
  either, and ends the run exactly as an absent day does. Showing up is not what
  the streak measures. Today is the sole exception, and only because the day is
  not over: an unsolved today shifts the anchor to yesterday rather than
  breaking the run.
- **R4** — Solving today increments the number the player was already seeing
  that day, with no reload.
- **R5** — The streak remains derived. Nothing about it is written to the result
  store, and no separate streak record exists.
- **R6** — Days are the viewer's local calendar days, as elsewhere in the
  feature. Parsing a stored ISO date anchors at local noon so a DST step cannot
  move a record onto the neighbouring day.

## Behaviour details

The rule in full, walking back from the anchor day:

| Records | Streak today |
| :-- | :-- |
| Nothing at all | 0 |
| Solved today only | 1 |
| Solved yesterday, today untouched | 1 |
| Solved yesterday, today attempted but unsolved | 1 |
| Solved yesterday and today | 2 |
| Solved Mon–Wed, today is Thursday, untouched | 3 |
| Solved Mon–Wed, today is Friday (Thursday missing) | 0 |
| Solved two days ago, nothing since | 0 |
| Solved two days ago, yesterday attempted but unsolved | 0 |

The anchor shift is the whole change: yesterday becomes the starting point when
today has nothing to say yet. Once today is solved the anchor moves to today and
the count includes it, which is what makes R4 fall out with no extra code.

## Acceptance criteria

- **AC1** (R1) — Given a record solving yesterday and no record for today, when
  the streak is computed, then it is 1.
- **AC2** (R1, R4) — Given a record solving yesterday, when today is then
  solved, then the streak is 2.
- **AC3** (R1) — Given records solving the last three days including today, then
  the streak is 3.
- **AC4** (R2, R3) — Given a record solving two days ago and nothing since, then
  the streak is 0.
- **AC5** (R3) — Given records solving Monday, Tuesday and Wednesday, and today
  is Friday with no Thursday record, then the streak is 0.
- **AC6** (R1, R3b) — Given a record solving yesterday and an unsolved record
  for today, then the streak is 1.
- **AC6a** (R3, R3b) — Given a record solving two days ago and an attempted but
  unsolved record for yesterday, then the streak is 0.
- **AC6b** (R3) — Given a record solving today on the fifth attempt, then the
  day qualifies and the streak counts it.
- **AC7** (R2) — Given no records at all, then the streak is 0.
- **AC8** (R5) — Given the streak is computed, then no write to the result store
  occurs.

Each is asserted against `lib/streak.ts` directly with dates as fixtures — it is
`lib/` logic, so it is tested as logic, with no fake timers and no rendering.

## Dependencies

Depends on nothing. `StreakBadge`'s `{ streak: number }` prop is the frozen
contract with Epic 1: this epic changes the value flowing through it, Epic 1
changes how it is worded and where it sits, and neither touches the other's
files.

## Assumptions

- The header does not render until the saved results have loaded, so there is no
  frame in which a real streak briefly displays as zero. The existing hydration
  gate already guarantees this.
- No migration is needed. The rule is a pure re-read of records already stored.
- A player who solves a day in a different timezone than they recorded it is out
  of scope; local calendar days are the model throughout the feature.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only.

### Cycle 1 — 2026-08-30

**Q1. Does a day the player attempted but never solved keep the streak alive?**
Answer: **A) No — only a solved day qualifies** — it is the rule the code
already implements and the one the briefing's other line describes, where
solving is what moves the number from 1 to 2; "without trying" reads as loose
phrasing for "without playing".
Applied to: R3, R3a, R3b, Behaviour details table, AC6, AC6a, AC6b
