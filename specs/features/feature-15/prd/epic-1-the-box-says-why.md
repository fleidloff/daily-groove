# PRD — Epic 1: The box says why it is that mode

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

The box at the end of a finished day gains one line saying what makes the day's
mode sound the way it does — *"major with a ♭7 — that's the note doing it"* —
and loses the sentence that occupies that spot today, `solved in one try ·
streak now 4`. It also pins the degree-naming function Epics 2 and 4 read. This
is the thinnest complete version of the feature: after it, a solved day teaches
something.

## Problem

The panel names the answer and draws its notes. It never says what made the
groove sound that way, so Sam — who "learned by ear and by tab, never by
theory", and "could not name the mode if asked" — closes the day knowing only
whether the guess was right. Naming the mode back at them is not the same as
saying what to listen for, and that gap is what "keeps them repeating the same
three shapes".

The one line of prose in the box is meanwhile spent on the score, which the
header pill and the dot row already carry. The box repeats the game in the one
place that could be teaching instead.

## Scope

- A per-mode character table and its prose, in the feature's `lib/theory/`.
- A degree-naming function, beside `notes.ts`.
- `SolvedPanel`'s subline: the lesson replaces the score.

**Out of scope**
- **Degrees drawn under the staff** — Epic 2, against this epic's function.
- **Roman numerals under the lead sheet** — Epic 3.
- **Any comparison with what was guessed** — Epic 4.
- **Where the box sits on the page** — Epic 5.
- **A track reference** — dropped from this feature; a candidate in
  `specs/features.md`.
- **Any sound.** Hearing a mode is feature-c's; this is what you read.
- **Translation.** English strings like every other; feature-b collects them.

## Requirements

- **R1** — On a finished day the box carries one line of prose saying what makes
  the day's mode sound as it does. It occupies the position the
  tries-and-streak sentence occupies today, beside the answer.
- **R2** — The line is written for someone who plays and does not read. It names
  the degree in the app's own notation — "major with a ♭7" — and uses no word Sam
  would have to look up: not "characteristic", not "tonality", not "minor
  seventh", no Roman numerals. Sam is lost by "naked theory vocabulary", so a
  line that needs a glossary has re-created the gap it exists to close.
- **R2a** — The line is one clause. Not a sentence about what the degree does to
  the sound, not two sentences, not a second line for the modes that could carry
  one: "major with a ♭7" is the whole shape of it, which is how the briefing
  writes it and what keeps R9's two-line ceiling reachable on a phone.
- **R2b** — The clause names **every** degree that separates the mode from the
  plain major or minor scale, not just the most audible one. Lydian dominant is
  "major with a ♯4 and a ♭7"; a line naming one of the two describes a different
  mode from the one playing, and Sam's gap is hearing what a mode actually *is*.
- **R2c** — Which of the two the mode is measured against is decided by its
  third, the way `familyOf` already grades every mode in
  `lib/theory/families.ts`. A mode with a major third is read against the major
  scale, one with a minor third against the minor scale, and the table does not
  get a second opinion about which baseline a mode has.
- **R3** — Every mode the rotation can play has a line, enforced by a test that
  derives the mode list from the shipped manifest rather than from a list written
  by hand. `lib/theory/families.ts` has this exact problem and its test solves it
  this way, because a hardcoded list passes on precisely the day a thirteenth
  mode is minted.
- **R3a** — A mode that reaches the panel without a line renders the panel
  without the line rather than throwing. `lib/theory/changes.ts` settled this
  trade-off — "four blank bars beat the day's payoff crashing" — and R3's test is
  what stops the gap shipping.
- **R4** — The blues scale gets a line like every other answer and is not
  described as a mode. Its line names the ♭5 sitting between the 4 and the 5.
- **R5** — Neither the attempt count nor the streak appears in the box.
- **R5a** — The tries wording is dropped, not rehoused. The dot row's own label
  already reads `Solved`, and Sam wants "one thing per day, not a streak of
  guilt": a count restated in prose is the scorekeeping the box is being cleared
  of.
- **R5b** — The streak needs no new home: `StreakBadge` renders it in the page
  header on every load.
- **R6** — The day's outcome stays legible on the page without the box: the dot
  row reads `Solved`, the feedback line still says the day was got, the streak
  pill still shows the run. This removes a repetition, not information.
- **R7** — A day given up on shows the same line, with the same wording. What
  makes a mode sound like itself does not depend on whether Sam found it, and
  feature-7 established that the solution is what the player asked for.
- **R7a** — With the score gone, the only remaining difference between the solved
  and the revealed box is the phrase `given up · the day is over`. The panel
  keeps at most one branch for it; if the phrase moves, the `revealed` prop
  leaves `SolvedPanel` entirely.
- **R8** — The panel stays a single `role="status"` region. The line is
  announced as part of the panel; it gets no live region of its own, which would
  announce the payoff twice.
- **R9** — The line stays one line of prose: at a 360px viewport it wraps to no
  more than two visual lines. The session is "twenty minutes before dinner" on a
  phone, and a paragraph in the payoff is the homework Sam abandoned three
  courses to avoid.
- **R10** — `lib/theory/` exposes a function naming an answer's scale degrees in
  order — Mixolydian → `1 2 3 4 5 6 ♭7`, blues → `1 ♭3 4 ♭5 5 ♭7`. **This
  signature is the contract Epics 2 and 4 build against.**
- **R10a** — One label per note, in the same order and count as `scaleNotes`
  returns: six for the blues scale, seven for a mode.
- **R10b** — The labels are derived from `FLAVOUR_INTERVALS`, never counted out
  as `1..7`. The blues scale is the reason: six degrees, and its ♭5 and 5 share a
  letter, which is why `notes.ts` already carries `FLAVOUR_LETTER_STEPS`.
- **R10c** — An unknown flavour throws, as `scaleNotes` does for the same input.
  R3a's tolerance belongs to the panel, not to the library.

## Behaviour details

The panel's header region is a `Row` holding the answer as a heading and the
score as muted text. The heading is unchanged — it still names `E♭ Blues` — and
the muted text beside it becomes the line. Both drawings below are untouched.

The character table and the degree namer stay separate: the table is written
prose keyed by mode, the namer is arithmetic over `FLAVOUR_INTERVALS`. Epic 4
needs the second and not the first.

## Acceptance criteria

- **AC1** (R1) — Given a solved Mixolydian day, when the box renders, then it
  shows the answer and a line naming the ♭7.
- **AC2** (R5, R5a) — Given a day solved in one try with a streak of four, when
  the box renders, then neither "one try" nor "streak" appears in it.
- **AC3** (R7) — Given a day given up on, when the box renders, then it shows the
  same line as a solved day in that mode.
- **AC4** (R3) — Given the modes derived from the shipped manifest, then every
  one has a character line. The test reads the manifest; a hardcoded list fails
  this criterion by construction.
- **AC5** (R4) — Given a blues day, when the box renders, then the line names the
  ♭5 and does not call blues a mode.
- **AC6** (R10, R10a) — Given each flavour in `FLAVOUR_INTERVALS`, when the
  degree namer runs, then it returns one label per note in order, matching
  `scaleNotes`' count — six for blues, seven for the modes.
- **AC7** (R10c) — Given an unknown flavour, when the degree namer runs, then it
  throws.
- **AC8** (R3a) — Given a mode with no character line, when the box renders, then
  the panel renders without the line and does not throw.
- **AC9** (R8) — Given a finished day, when the page is inspected, then exactly
  one `role="status"` region exists in the panel.
- **AC10** (R9) — Given the longest line in the table, when rendered at 360px,
  then it occupies no more than two visual lines.
- **AC11** (R6) — Given a solved day, then the dot row still reads `Solved` and
  the streak pill still shows the streak.
- **AC12** (R2b, R2c) — Given every mode in the table, then the degrees its line
  names are exactly the degrees by which its intervals differ from its family's
  plain scale — derived from `FLAVOUR_INTERVALS` and `familyOf`, not from the
  prose. A line that names one of two differing degrees fails this criterion.
- **AC13** (R2a) — Given every line in the table, then none contains a sentence
  break.

## Dependencies

Needs nothing. Hands two contracts forward:

- **the degree namer** — `(answer) → string[]`, read by Epic 2 for the row under
  the staff and Epic 4 for naming the note that differs.
- **the box's line slot** — the region beside the answer, which Epic 4 adds a
  second line to.

## Assumptions

- The heading keeps naming the answer; this adds a line beside it.
- The line uses the existing `inverted-muted` tone. No new token or colour.
- The table lives in the feature's `lib/theory/`, not `src/lib/` — the generator
  has no use for it, and `src/lib/` is a leaf shared with `scripts/`.
- Twelve lines of prose are written once and reviewed as content. A thirteenth
  mode fails R3's test and its line is written then.


## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only: never rewrite or prune a
past cycle, or the record stops being trustworthy.

### Cycle 1 — 2026-09-01

**Q1. How much does the line say?**
Answer: **A) One clause naming the note** — the briefing writes it exactly that
way, and R9's two-line ceiling at 360px is the binding constraint; the note is
the part that transfers to another key.
Applied to: R2a, AC13

**Q2. Modes with more than one telling note — how many does the line name?**
Answer: **A) Every degree that separates it from the plain major or minor
scale** — a line naming one of two differing degrees describes a different mode
from the one playing.
Applied to: R2b, R2c, AC12
