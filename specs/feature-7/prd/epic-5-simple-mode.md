# PRD — Epic 5: Simple mode

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

A toggle at the top of the guess card narrows the puzzle for a player who is not
ready for twelve roots and six modes: six roots, and a choice between major and
minor. The narrowing is a presentation and grading rule, not a different puzzle
— the same groove plays, and a solve counts the same.

## Problem

The full puzzle asks for one of twelve roots and one of four modes: forty-eight
pairs, of which one is right. For a player who can hear that a groove is dark
and rooted somewhere around D, that is a lot of precision to demand before
anything is confirmed. Nothing in the app offers a smaller first step, so the
choice is between guessing at full difficulty and not playing.

## Scope

- A toggle at the top of the guess card, switching between the full puzzle and
  simple mode.
- Six roots instead of twelve, drawn the way the mode options already are.
- Two mode options instead of four, and the grading rule behind them.
- Persistence of the toggle across days.

**Out of scope**
- **An expert mode.** Dropping the narrowing entirely, or shortening the attempt
  budget, is the other half of the `Difficulty levels` candidate in
  `specs/features.md` and stays there.
- **A separate streak, score or history for simple mode.** One day, one record.
- **Changing the groove.** Simple mode narrows what is asked about the day's
  groove; it never picks a different or easier one.
- **Changing the nudge or the reveal**, beyond what falls out of the narrower
  option sets.

## Requirements

- **R1** — The guess card carries a control that switches between the full
  puzzle and simple mode, at the top of the card, above both chip rows.
- **R2** — In simple mode the root row offers six roots instead of twelve.
- **R3** — Those six are drawn deterministically for the date and always include
  the day's correct root, the way the mode options already are. A fixed six
  would leave a groove rooted in E♭ unanswerable.
- **R4** — In simple mode the second row offers exactly two options, labelled
  `Major` and `Minor`. No mode name is on screen in simple mode, so the two
  words read as the families they are rather than colliding with the modes they
  replace.
- **R5** — A guess in simple mode is graded by the third: Ionian, Lydian and
  Mixolydian are major; Dorian, Phrygian and Aeolian are minor. Every groove is
  therefore answerable in simple mode.
- **R6** — The mapping from mode to major-or-minor is a pure function over the
  mode vocabulary and lives in `lib/theory/`, beside the vocabulary rather than
  inside the card.
- **R7** — The toggle's position persists across days and across reloads. It is
  a preference, stored separately from the day's results.
- **R8** — Switching mode does not change the day's groove, its answer, or the
  attempts already recorded. Attempts carry across a mid-day switch untouched: a
  miss is a miss, whatever it was aimed at, and one day is one record.
- **R8a** — The toggle stays operable for the whole day. It is never locked by
  having guessed, and switching is not itself an attempt.
  - *Narrowed by [feature-11 Epic 4](../../feature-11/prd/epic-4-the-simple-switch-settles.md):
    "the whole day" now means the whole **playable** day. Never locked by having
    guessed still holds; once the day ends — solved or given up on — the switch
    settles and stops responding.*
- **R9** — A day solved in simple mode is recorded as solved and counts toward
  the streak like any other solved day.
- **R10** — The nudge and the reveal behave as they do in the full puzzle, at
  the same thresholds: the nudge names the day's root at two misses, and the
  reveal is offered from three. Neither threshold is mode-dependent.
- **R11** — Both rows keep their existing semantics — single-select, labelled,
  keyboard-operable — in either mode.

## Behaviour details

**The collapse.** Six modes map onto two answers by their third:

| Mode | Third | Simple answer |
| :-- | :-- | :-- |
| Ionian | major | major |
| Lydian | major | major |
| Mixolydian | major | major |
| Dorian | minor | minor |
| Phrygian | minor | minor |
| Aeolian | minor | minor |

The mapping is total over the vocabulary Epic 4 settles, which is what makes R5
hold without a special case. It is also why Locrian's exclusion in Epic 4
matters here: a diminished fifth is neither of these two answers in any honest
reading.

**What the toggle changes, and what it does not.**

| | Full puzzle | Simple mode |
| :-- | :-- | :-- |
| Roots offered | 12 | 6, including the answer |
| Second row offered | 4 modes | 2 |
| Correct pair | root + exact mode | root + major-or-minor |
| Groove | today's | today's |
| Attempts | unlimited, 3 is par | unlimited, 3 is par |
| Nudge | at 2 misses | at 2 misses |
| Reveal | from 3 misses | from 3 misses |
| Counts for the streak | yes | yes |

## Acceptance criteria

- **AC1** (R1) — Given the guess card, when it renders, then a mode-switching
  control is present above both chip rows.
- **AC2** (R2, R3) — Given simple mode on any date, when the root row renders,
  then it offers six roots, one of which is the day's correct root, and the same
  date offers the same six.
- **AC3** (R4) — Given simple mode, when the second row renders, then it offers
  exactly two options, labelled `Major` and `Minor`, and no mode name appears in
  either chip row.
- **AC4** (R5) — Given a Dorian groove in simple mode, when the player checks
  its root paired with the minor option, then the day is solved.
- **AC5** (R5) — Given a Mixolydian groove in simple mode, when the player
  checks its root paired with the minor option, then the guess is a miss.
- **AC6** (R5) — Given each of the six modes, when a correctly-rooted simple
  guess is graded, then exactly one of the two options is accepted.
- **AC7** (R7) — Given simple mode is on, when the page is reloaded the next
  day, then simple mode is still on.
- **AC8** (R8) — Given two attempts spent, when the toggle is switched, then the
  attempt count and the dot row are unchanged and no new attempt is recorded.
- **AC8a** (R8a) — Given a guess has been checked, when the player reaches for
  the toggle, then it is still operable.
  - *Narrowed by [feature-11 Epic 4](../../feature-11/prd/epic-4-the-simple-switch-settles.md):
    this holds while the day is still playable. On a finished day the toggle is
    disabled — see that epic's AC1 and AC2.*
- **AC9** (R9) — Given a day solved in simple mode, when the streak is computed,
  then that day counts toward it.
- **AC10** (R10) — Given two misses in simple mode, when the card renders, then
  the nudge names the day's root. Given a third miss, then the reveal is
  offered. Given the same miss counts in the full puzzle, then the nudge and the
  reveal appear at the same points.
- **AC11** (R11) — Given either mode, when a keyboard user traverses the card,
  then both rows are reachable, single-select and labelled.

## Dependencies

Starts after two epics, and this is the feature's only real ordering
constraint:

- **Epic 4** settles the mode vocabulary and retires the modes that do not map
  cleanly. R5's table is defined over exactly the six modes Epic 4 leaves
  standing, so this epic cannot fix its grading rule before that.
- **Epic 3** leaves `components/puzzle/GuessCard.tsx` with a reveal control and
  an auto-selected root. The toggle lands above both, so this epic rebases onto
  that version of the card rather than editing it in parallel.

It depends on **Epic 1** for nothing: the day's groove is whatever the rotation
yields, in either mode.

Per `docs/testing.md`, the collapse in `lib/theory/` is tested directly as a
plain function, and the toggle's behaviour is tested through the feature's
public surface.

## Assumptions

- The toggle is a two-state control, not a difficulty menu — the briefing calls
  it "a toggle on top of the guessing card".
- It persists under its own `localStorage` key, beside `daily-groove:v2:results`
  rather than inside it, because it is a preference and not a day's play.
- Its default is off. A returning player who has never touched it sees the full
  puzzle, exactly as today.
- The six roots use the same `buildOptions` the mode row uses, seeded by the
  same ISO date, so both rows are stable for the day and consistent with each
  other.
- The two simple-mode chips carry no parenthetical mapping. A player who wants
  to know which modes are major learns it by switching the toggle off.
- Simple mode does not change the feedback wording, which already reports which
  half of the pair was right without naming the mode.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only: never rewrite or prune
a past cycle, or the record stops being trustworthy.

### Cycle 1 — 2026-08-30

**Q1. What happens to attempts already spent when the toggle is switched
mid-day?**
Answer: **A) Attempts carry across, untouched** — the roadmap asks that
switching "does not lose or invent attempts", and one day is one record.
Applied to: R8, R8a, AC8, AC8a, Assumptions

**Q2. What are the two options in the second row called?**
Answer: **A) `Major` and `Minor`** — the briefing names them, and in simple mode
no mode names are on screen to be confused with.
Applied to: R4, AC3, Assumptions

**Q3. Does the nudge still fire at two misses in simple mode?**
Answer: **A) Same thresholds in both modes** — Epic 3 keeps these as pure
derivations over the miss count, and a mode-dependent threshold adds a branch to
logic the roadmap deliberately keeps unlatched.
Applied to: R10, AC10
