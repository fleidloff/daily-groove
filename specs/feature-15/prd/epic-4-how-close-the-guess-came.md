# PRD — Epic 4: How close the guess actually came

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

The box says what separated the guess from the answer. Guess Dorian on a
Mixolydian day and it reads *"you said Dorian — one note apart: its 3rd is flat,
this one's natural"*. A near miss and a wild stab stop looking identical, which
is the correction Sam can carry to tomorrow.

## Problem

Sam guessed Dorian. The answer was Mixolydian. Nobody said those are **one note
apart** — that only the third separates them — so the day's most useful lesson
went unsaid while every guess sat in storage with its score already computed.
`Attempt` records the root, the flavour and which of them matched, for every
guess; the box reads none of it.

Without this, the box teaches the answer but never the mistake, and the mistake
is the part Sam made. "Failing without learning is worse than losing."

## Scope

- Comparing the last incorrect guess with the answer, in `lib/theory/`.
- One further line in the box, under Epic 1's.

**Out of scope**
- **Any change to scoring, to the dot row, or to the mid-puzzle feedback line.**
  This reads attempts after the day has ended; nothing about grading changes.
- **Statistics across days** — which modes Sam habitually misses is a different
  feature and needs storage this one does not touch.
- **A per-guess breakdown.** One line about one guess, not a table of all of
  them.
- **The character line itself** — Epic 1.

## Requirements

- **R1** — On a finished day where at least one guess was wrong, the box carries
  a line naming what separated that guess from the answer.
- **R2** — The guess compared is the last incorrect attempt: the one still on
  screen, and the one Sam last believed.
- **R3** — Where the mode was wrong, the line names the degrees that differ
  between the guessed mode and the answer's, using Epic 1's degree names.
- **R3a** — Both modes are in `FLAVOUR_INTERVALS`; the difference is a set
  operation over degrees, computed by a plain function in `lib/theory/` and
  tested directly.
- **R4** — Where the mode was right and only the root was wrong, the line says
  so: the colour was found and the home note was not. `Attempt` already stores
  `rootMatched` and `flavourMatched` separately, so the two axes are never
  conflated into one distance.
- **R5** — A day played in simple mode gets no near-miss line. A simple-mode
  guess is scored against `familyOf(answer)`, so the stored `flavour` is `Major`
  or `Minor` — a family with no intervals to compare. The game asked a different
  question there, and answering it with mode distance answers something Sam never
  guessed.
- **R5a** — `FLAVOUR_INTERVALS` is never reached with a family. This is the
  requirement that keeps `UnknownFlavourError` off the payoff panel on every
  simple-mode day, so it is asserted directly rather than left implied by R5.
- **R6** — Nothing to say is a valid outcome, and the line is absent rather than
  empty: a first-guess solve has no wrong attempt, and a day given up on without
  guessing has none either.
- **R7** — A distant miss is worded differently from a near one. One or two
  differing degrees are named; three or more are not listed at all, and the line
  says plainly that the two are a long way apart. A line naming three degrees is
  a table written as prose, and the reason a near miss is worth saying out loud
  is that a near miss is memorable — "a win in two minutes" leaves no room for
  the rest.
- **R7a** — The threshold is a count of differing degrees, not of semitones, so
  it reads the same in every key.
- **R7b** — The blues scale against a seven-note mode will usually exceed the
  threshold: its six degrees differ from Dorian's seven at three places. The
  plain wording is therefore the normal outcome for a blues day, not an edge
  case, and it must read as a sentence someone wrote rather than a fallback.
- **R8** — The line is one line, in the same plain language as Epic 1's, and
  wraps to no more than two visual lines at 360px. Two lessons in the box are
  still one screen.
- **R9** — The line sits below Epic 1's character line, in the same region, and
  is announced as part of the panel's single `role="status"` — not as a second
  live region.
- **R10** — The line never scolds. Sam missed by one note; the sentence states
  the difference and stops. Nothing in the box grades the attempt, which is the
  same reason the score left it in Epic 1.
- **R11** — A day given up on gets the line, with the same wording as a solved
  day. Sam wants "to be told the answer eventually" because "failing without
  learning is worse than losing" — the day Sam gave up is the day knowing how
  close the last guess came is worth the most. Nothing in the line refers to
  having given up; Epic 1's R7 governs that phrase and this adds no second
  mention of it.

## Behaviour details

Two axes, four cases, and only two of them produce a note-level line:

| last incorrect guess | line |
| :-- | :-- |
| wrong mode (full mode row) | the degrees that differ (R3) |
| right mode, wrong root | the colour was right, the home note was not (R4) |
| any guess in simple mode | no line (R5) |
| no incorrect guess at all | no line (R6) |

Dorian `[0,2,3,5,7,9,10]` against Mixolydian `[0,2,4,5,7,9,10]` differ at one
degree — the third — which is the case the epic exists for. Phrygian against
Lydian differ at five, which is the case R7 covers.

## Acceptance criteria

- **AC1** (R1, R3) — Given a Mixolydian day whose last wrong guess was Dorian,
  when the box renders, then the line names Dorian and identifies the third as the
  single difference.
- **AC2** (R2) — Given three wrong guesses, when the box renders, then the line
  names the third one.
- **AC3** (R4) — Given a guess with the right mode and the wrong root, when the
  box renders, then the line says the mode was right and does not list any
  degrees.
- **AC4** (R5, R5a) — Given a day played and guessed in simple mode, when the box
  renders, then there is no near-miss line, and the interval tables are never
  called with `Major` or `Minor`.
- **AC5** (R6) — Given a day solved on the first guess, when the box renders, then
  no near-miss line is present.
- **AC6** (R6) — Given a day given up on with no guesses spent, when the box
  renders, then no near-miss line is present.
- **AC7** (R7) — Given a guess whose mode differs from the answer's at three or
  more degrees, when the box renders, then the line says the two are a long way
  apart and names no degree.
- **AC7a** (R7) — Given a guess differing at exactly two degrees, then both are
  named.
- **AC8** (R3a) — Given every pair of modes the catalogue can play, when the
  comparison runs, then it returns the differing degrees and does not throw —
  including the blues scale against a seven-note mode, where the two differ in
  length.
- **AC9** (R9) — Given a finished day with both lines present, when the page is
  inspected, then exactly one `role="status"` region exists in the panel.
- **AC10** (R8) — Given the longest line the comparison can produce, when
  rendered at 360px, then it occupies no more than two visual lines.
- **AC11** (R11) — Given a day given up on after three wrong guesses, when the
  box renders, then the line is present and worded as it is on a solved day.
- **AC12** (R7b) — Given a blues day whose last wrong guess was a seven-note
  mode, then the line uses the plain wording.

## Dependencies

**Needs Epic 1** for two things: the degree namer, so both lines name a degree
the same way, and the box's line slot, which this adds a second line to. Both
are pinned in Epic 1 and this epic can be built against them in parallel with
Epic 2.

Hands nothing forward.

## Assumptions

- A guess that missed both root and mode is treated as a wrong-mode guess: the
  mode difference is the transferable half, and the root is already handed over
  by the nudge two guesses in.
- The comparison is by degree, not by pitch class: two modes differing at the
  third differ at the third in every key, which is what makes the line worth
  remembering.
- Where the answer is the blues scale, its six degrees are compared against the
  guess's seven by degree name, and the length difference is itself part of what
  the line can say.


## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only: never rewrite or prune a
past cycle, or the record stops being trustworthy.

### Cycle 1 — 2026-09-01

**Q1. How far apart is too far to list the degrees?**
Answer: **A) Two — one or two differing degrees are named, three or more get the
plain wording** — a line naming three degrees is a table in prose, and the value
of the near-miss line is that a near miss is memorable.
Applied to: R7, R7a, R7b, AC7, AC7a, AC12

**Q2. Does the line appear on a day that was given up on?**
Answer: **A) Yes, the same line as on a solved day** — "failing without learning
is worse than losing", and a day given up on is the day the near miss is worth
the most.
Applied to: R11, AC11
