# PRD — Epic 3: The payoff reads cleanly

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Three fixes to the solved box. The four-bar lead sheet stays one row of four bars
at every width instead of folding into a 2 × 2 block on a phone, bought with a
smaller type size and tighter padding below `sm`. And the line explaining the
mode drops its trailing clause: "major with a ♯4" rather than "major with a ♯4
— that's the note doing it".

## Problem

Sam reads the payoff on a phone, twenty minutes before dinner, with the loop
still playing. Four bars of harmony folded into two rows of two is not a lead
sheet — the bar lines stop running left to right, and the figure they are meant
to read as one pass through the changes reads as a grid. And the mode line pads
itself: the clause after the dash tells them nothing the clause before it did
not, which is the elbow-in-the-ribs that `docs/persona.md` calls homework.

## Scope

- One row of four bars at every supported width.
- The type size and padding that buys it.
- Removing the trailing clause from all twelve mode lines.
- Dropping the near-miss line on a solved day.

**Out of scope**
- **What the solved box says beyond that clause.** Feature-15 settled the
  lesson; this trims one phrase.
- **The Roman numerals.** They stay at every width — they are feature-15's
  lesson, and the degrees are what transfer to the instrument.
- **The staff notation below the sheet.** Feature-15's briefing flagged it as
  ugly and left it; still open, still not this.
- **The guess card** — Epics 1 and 2.
- **Which chords a groove plays.** Nothing about the harmony moves.

## Requirements

### The sheet

- **R1** — The lead sheet renders its four bars in one row at every supported
  width, down to 360px. It never folds to two rows.
- **R2** — Below `sm` the bars take a smaller type size and tighter horizontal
  padding than above it, which is what makes R1 fit.
- **R3** — The widest chord symbol the catalogue can produce renders in full at
  360px, in any of the four bars, without clipping, truncation or wrapping.
- **R4** — The Roman numeral under each bar renders at every width.
- **R5** — Above `sm` the sheet is unchanged from what feature-11 shipped.
- **R6** — Bar order is document order, and a numeral still changes no geometry:
  a long numeral cannot make its bar taller than its neighbour.
- **R7** — A bar whose numeral is missing or empty draws its symbol and nothing
  below it, as it does today.

### The near-miss line

- **R12** — On a solved day the box carries no near-miss line. The player found
  the answer; a sentence about the guess before it describes a state the win has
  already superseded, and reads as a comment from before the day ended.
- **R13** — On a day given up on the line is unchanged, in wording and in which
  guess it compares. That is the day it earns its place: Sam wants "to be told
  the answer eventually" because "failing without learning is worse than
  losing".
- **R14** — Nothing else about the line changes — not which attempt it compares
  on a given-up day, not its wording, not the single live region it shares with
  the character line.

### The mode line

- **R8** — No mode line contains a phrase that only points at what it has
  already said: neither "doing it" nor "the sound of it" appears in any of them.
  Each states what the mode is and stops. Ten of the twelve lose such a phrase;
  `Melodic minor` never had one.
- **R8a** — The rule bans those phrases, not trailing clauses. `Blues` keeps its
  em-dash clause — "that ♭5 between the 4 and the 5" — because that clause is
  the only place its line names its degree, so a rule shaped like "nothing after
  the last dash" would take R9 down with it in the same edit.
- **R9** — Every mode line still names every degree by which its mode differs
  from its family's plain scale.
- **R10** — Every mode line is still one clause, with no sentence break, at most
  72 characters. Removing the trailing clause moves every line further inside
  that budget, not outside it.
- **R11** — All twelve modes the shipped manifest carries still have a line.
  Nothing is left without one.

## Acceptance criteria

- **AC1** (R1) — Given a 360px viewport, when the solved box is rendered, then
  the four bars occupy one row.
- **AC2** (R2) — Given a width below `sm` and one above it, then the bars'
  type size and horizontal padding differ.
- **AC3** (R3) — Given a 360px viewport and the widest chord symbol the
  catalogue can produce, placed in the first bar and separately in the last,
  then it renders in full with no truncation class in play.
- **AC4** (R4) — Given a width below `sm`, then each bar's numeral is rendered.
- **AC5** (R5) — Given a width above `sm`, then the sheet's classes are those
  feature-11 shipped.
- **AC6** (R6) — Given four chords, then they render in bar order; and given one
  bar a long numeral, then its height matches its neighbours'.
- **AC7** (R7) — Given a bar with an empty numeral, then it draws its symbol and
  no numeral.
- **AC12** (R12) — Given a day solved after at least one wrong guess, when the
  box renders, then no near-miss line is present.
- **AC13** (R13) — Given a day given up on after wrong guesses, when the box
  renders, then the line is present and worded as it was before this change.
- **AC14** (R14) — Given a day given up on, when the box renders, then the
  character line and the near-miss line still share one live region.
- **AC8** (R8) — Given every mode line in turn, then none contains "doing it"
  and none contains "the sound of it".
- **AC8a** (R8a) — Given `Blues`, then its line still names its ♭5.
- **AC9** (R9) — Given every mode the manifest carries, then its line names each
  degree by which its intervals differ from its family's plain scale, recomputed
  from the intervals rather than from the table.
- **AC10** (R10) — Given every mode line, then it is one clause with no sentence
  break and at most 72 characters.
- **AC11** (R11) — Given the shipped manifest's modes, then every one has a
  line.

## Dependencies

**This narrows a requirement in a shipped feature.** Feature-15's Epic 4
specified the solved case deliberately: its **R1** gives the line to any
finished day with a wrong guess, its **R2** picks the last incorrect attempt as
"the one Sam last believed", and its **R11** derives the given-up wording from
the solved one. R12 inverts that — the given-up day becomes the only case.
Feature-15's PRD and specs stay as the record of what was built and verified;
the change belongs here.

**Needs nothing else, and hands nothing on.** It shares no file with the other two
epics: `components/solved/LeadSheet.tsx` and `lib/theory/character.ts`.

Feature-15's existing tests assert the current line strings and the sheet's
geometry. They move with the copy and the layout rather than being deleted —
their subjects are unchanged.

## Assumptions

- **The exact type size and padding are chosen by eye** at 360px against the
  widest symbol, not derived. The requirement is that four bars fit and stay
  legible; the numbers are what satisfies it. At 360px the sheet has about 272px
  to work with — `PageShell`'s `px-5` and `Card`'s `p-6` take 88px of the
  viewport — which is roughly 68px a bar before its own padding.
- **Below 360px the sheet is allowed to break.** 360px is the narrowest width
  the app supports, so a 320px device is out of scope here as it was for
  feature-16's check control.
- **The sheet is read, not tapped**, so it can take a smaller size than a
  control could. Nothing in it is a touch target.
- **The three authored-copy rules in `character.ts` still bind**, and the trim
  makes the third one more comfortably true rather than putting any at risk.
- **The `degrees` field is untouched.** Only the prose changes; the degrees
  remain recomputed from the intervals by the test, so the table still cannot
  assert itself.
- **No test asserts a literal mode-line string today**, so nothing outside
  `character.test.ts` has to move with the copy. The three cases that reference
  the box's prose match on `/the plain minor scale/i` and `/♭7/`, both of which
  survive the trim.
- **"Moves further inside the budget" needs no assertion of its own.** The trim
  only deletes characters, so a trimmed line is shorter by construction, and
  asserting it would need a second copy of the old strings — a table asserting a
  table, which is the thing `character.ts`'s first authored-copy rule exists to
  prevent. The existing 72-character case catches any rewrite that adds length
  back.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there.

### Cycle 1 — 2026-09-02

**Q1. What is the narrowest width the sheet has to fit?**
Answer: **A) 360px, matching what feature-16 already assumed** — the narrowest
width in common use, and it keeps one number across two features instead of
two. A 320px break is accepted, as it already was for the check control.
Applied to: R1, R3, AC1, AC3, Assumptions
