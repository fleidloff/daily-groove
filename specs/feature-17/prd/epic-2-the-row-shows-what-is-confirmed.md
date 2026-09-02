# PRD — Epic 2: The row shows what is confirmed

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

A press of *Check* that gets half the pair right leaves a check mark on the chip
it got right, and that mark stays for the rest of the day. Together with the
dimming from Epic 1 the row holds both halves of what the player knows: what is
out, and what is settled. Two lines of copy come with it — the caption under the
play control goes back to setting the task when the tap sounds are off, and the
feedback line drops the instruction the mark now gives.

## Problem

The feedback line already says "Right home note, wrong colour" — and then the
next guess replaces it. Four attempts in, Sam is holding in their head a fact
the card was told and forgot, which is exactly the memory load a two-minute
game on a phone should not create. Separately, switching the tap sounds off
currently costs the card its one line about what to listen for, replacing it
with a description of the switch the player just flipped themselves.

## Scope

- A check mark on a root or mode that a checked guess confirmed.
- The mark surviving every later guess.
- How the mark shares a chip with feature-16's `♪`.
- The sounds-off caption going back to the task.
- The feedback line losing its now-redundant instruction.

**Out of scope**
- **Which chips are live and the dim treatment** — Epic 1. A chip is never both
  confirmed and ruled out: a confirmed chip is part of the answer, so nothing
  can eliminate it.
- **Marking anything before *Check* is pressed.** A selection is not a guess,
  and feature-16's rule that tapping a chip is never a guess is unchanged.
- **Re-opening a finished day.** A mark on a solved or revealed day is a record,
  not a control.
- **Changing what the feedback line diagnoses.** It loses an instruction, not
  its reading of the guess.
- **The solved box, the lead sheet and the mode-character copy** — Epic 3.

## Requirements

### The mark

- **R1** — When a checked guess has the right root and the wrong mode, the root
  chip carries a check mark from then on. When it has the right mode and the
  wrong root, the mode chip does.
- **R2** — A mark appears only after *Check* is pressed. Selecting a chip, or
  tapping it to hear it, never marks anything.
- **R3** — The mark survives every later guess, right or wrong, for the rest of
  the day. It is a record of what has been established, not a description of the
  most recent check.
- **R4** — A marked chip is still selectable. Confirming the root does not stop
  the player choosing it again as half of the next guess — it is the half they
  are meant to keep.
- **R5** — Marks are derived from the day's attempts, so they survive a reload
  exactly as the attempts do.
- **R6** — In simple mode the `Major` / `Minor` row is marked the same way. A
  right family was guessed, not given.
- **R7** — No chip is ever both marked and ruled out.
- **R8** — On a solved or revealed day the marks earned during play remain
  visible under the card's lock.
- **R9** — The mark is decoration. A chip's accessible name stays its label
  alone, as feature-16's `♪` already does.
- **R9a** — A confirmed chip carries both marks, not one: feature-16's `♪`
  stays where it is, before the label, and the check mark goes after it. A chip
  that has been confirmed is still an audible chip and does not stop saying so.
- **R9b** — The check mark sits in the chip's own padding rather than in its
  content flow, so it costs no layout width. Adding it moves no label, reflows
  no row and cannot make one chip taller than its neighbour.
- **R9c** — Both marks and the longest label a row can offer render on one line
  at 360px, with no wrapping and no clipping. The root row is the tight case: at
  four columns a chip is about 63px there, and only the `♪` and the label are in
  the flow.

### The two lines of copy

- **R10** — With the tap sounds switched off, the caption under the play control
  reads "Find the note that feels like home — Play along with your instrument."
  — the sounds-on sentence without its tap clause.
- **R11** — With the tap sounds on, the caption is unchanged from what
  feature-16 shipped.
- **R12** — Flipping the switch swaps between them immediately, in both
  directions.
- **R13** — The feedback line for a right-root-wrong-mode guess keeps its
  diagnosis and drops its instruction: the sentence telling the player to keep
  the root goes, because the mark on the chip now says it.

## Behaviour details

**Where the mark and the `♪` meet.** Feature-16 put a row-wide `♪` on both chip
rows, gated on the tap-sounds preference, rendered before the label. The check
mark takes a second slot after the label, so a confirmed chip wears both and
nothing has to be given up — `Chip` renders one adornment today and gains a
trailing one.

**The root row is where that has to be paid for, and it is tight.** At 360px,
`PageShell`'s `px-5` and `Card`'s `p-6` leave 272px; the root row is four
columns with 7px gaps, so a chip is about 63px wide, and `Chip`'s own
`px-[15px]` leaves roughly 33px of content. A two-character label like `C♯`
plus two inline glyphs and their margins wants around 47px of that — so both
marks cannot both sit in the content flow.

Which is why the check mark does not. It is positioned in the padding the chip
already reserves, the way `LeadSheet` positions each Roman numeral in air its
bar has already set aside, "so a numeral changes no geometry and a long one
cannot make its bar taller than its neighbour". The inline flow keeps only the
`♪` and the label, which fits at every label length in both rows, and the
solution holds without touching the row's column count — which Epic 1's R6
protects.

**Why stickiness is the whole requirement.** R3 is the difference between this
epic and the feedback line that already exists. A mark describing only the last
check would be a second rendering of a sentence already on screen; a mark that
accumulates is a new thing the card can do. It is also the requirement most
likely to be built wrong, because the natural implementation — read the most
recent attempt — passes a demo and fails on the fourth guess.

## Acceptance criteria

- **AC1** (R1) — Given a checked guess with the right root and wrong mode, when
  the row is inspected, then that root chip carries a check mark.
- **AC2** (R1) — Given a checked guess with the right mode and wrong root, then
  that mode chip carries one.
- **AC3** (R2) — Given a chip selected but not checked, then no mark appears;
  and given the same chip tapped to hear it, then still none.
- **AC4** (R3) — Given a confirmed root, when two further wrong guesses are
  checked with different roots, then the first root's mark is still there.
- **AC5** (R4) — Given a marked root chip, when it is selected, then it selects
  normally.
- **AC6** (R5) — Given a day with a confirmed half, when the page is reloaded,
  then the mark is still there.
- **AC7** (R6) — Given simple mode and a checked guess whose family was right,
  then that family chip carries a mark.
- **AC8** (R7) — Given any sequence of checked guesses, then no chip is
  simultaneously marked and dimmed.
- **AC9** (R8) — Given a revealed day whose play confirmed a root, then that
  chip still shows its mark.
- **AC10** (R9) — Given a marked chip, when its accessible name is read, then it
  is the label alone.
- **AC10a** (R9a) — Given a confirmed chip with the tap sounds on, then it shows
  the `♪` before its label and the check mark after it.
- **AC10b** (R9b) — Given a chip that becomes confirmed, then no other chip in
  the row moves and every chip in the row keeps the same height.
- **AC10c** (R9c) — Given a 360px viewport and the longest label each row can
  offer, when a chip on it is confirmed, then both marks and the label render in
  full on one line.
- **AC11** (R10, R11) — Given the tap sounds off, then the caption reads the
  task sentence without the tap clause; and given them on, then it reads
  feature-16's full sentence.
- **AC12** (R12) — Given the sounds off, when the switch is turned back on, then
  the caption returns to the full sentence without a reload.
- **AC13** (R13) — Given a right-root-wrong-mode guess, when the feedback line
  is read, then it diagnoses the guess and does not instruct the player to keep
  the root.

## Dependencies

**Needs from Epic 1, as a contract:** *per-option state on `ChipGroup`* — the
ability to vary a chip's state and its mark within a row, where `disabled` and
`adornment` are row-wide today. Epic 1 ships it because it ships first; this
epic is its second consumer.

**Changes a criterion in a finished feature.** Feature-16's **AC11a** asserts
the current sounds-off caption ("Tap sounds are off — switch them back on under
Simple mode."). R10 replaces that wording, so the criterion moves rather than
the string alone. Both wordings are mirrored in `testing/puzzleHarness.tsx`,
which is where every assertion about them reads from.

## Assumptions

- **The mark is derived, never stored.** `Attempt` already carries `rootMatched`
  and `flavourMatched` per checked pair, so both the mark and Epic 1's dimming
  read the same list, and neither needs a field of its own.
- **The check mark sits vertically centred in the chip's trailing padding**,
  where an inline trailing mark would have been, and takes the chip's own ink
  through `currentColor` so it stays legible in both `Chip` tones without
  naming a palette token.
- **The check mark is hidden from assistive technology**, as the `♪` already is,
  which is what keeps R9's accessible-name rule true.
- **The two marks mean different things and are not interchangeable.** The `♪`
  is a promise about what a tap does; the check mark is a record of what a check
  established. That is why they can coexist on one chip and why neither can
  stand in for the other.
- **A mark on the selected chip inherits the chip's ink.** `Chip`'s adornment
  already takes `currentColor` for exactly this reason, so an accent-filled
  selected chip carries a legible mark without naming a palette token.
- **A solved day's winning pair keeps whatever marks it earned.** The solved box
  is the payoff; the marks are the working.
- **The feedback line's diagnosis wording is otherwise untouched.** Only the
  instruction sentence goes.
- **Nothing is done about brute force.** The mark makes it more legible — lock
  the root, then cycle the modes — but the feedback line already allowed it and
  the dots mark par rather than lives, so the path was always open. Epic 1's
  narrowing is what makes listening the faster route.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there.

### Cycle 1 — 2026-09-02

**Q1. How do the check mark and the `♪` share a chip?**
Answer: **B) Both marks, the `♪` before the label and the check after it** —
nothing is given up, and the two marks say different things: one is a promise
about a tap, the other a record of a check.
Applied to: R9a, R9b, AC10a, AC10b, Behaviour details, Assumptions. It also
opened Q2 below, because the root row has no inline room for the second mark.

### Cycle 2 — 2026-09-02

**Q2. The second mark does not fit inline on a root chip. Where does it go?**
Answer: **A) positioned in the chip's own padding rather than in its content
flow, so it costs no layout width** — the pattern `LeadSheet` already uses for
the same problem, and it holds at any label length without changing the row's
column count.
Applied to: R9b, R9c, AC10b, AC10c, Behaviour details, Assumptions
