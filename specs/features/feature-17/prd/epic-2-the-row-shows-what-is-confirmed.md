# PRD — Epic 2: The row shows what is confirmed

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

A press of *Check* that gets half the pair right locks that half in: every other
option in its row goes dim and unpickable, and the row stays that way for the
rest of the day. Together with the
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

- Locking a row once a checked guess confirms its half.
- The lock surviving every later guess.
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

- **R1** — When a checked guess has the right root and the wrong mode, every
  root except that one becomes unavailable from then on — dim and unpickable.
  When it has the right mode and the wrong root, every other mode does.
- **R1a** — There is no glyph. The row collapsing to a single live chip is what
  says the half is settled, which needs no new mark and no vocabulary the player
  has to learn.
- **R2** — A row locks only after *Check* is pressed. Selecting a chip, or
  tapping it to hear it, locks nothing.
- **R3** — The lock survives every later guess, right or wrong, for the rest of
  the day. It records what has been established, not what the most recent check
  said.
- **R4** — The confirmed chip itself stays live and stays selected. It is the
  half the player is meant to keep, and it is still what the next *Check* is
  built on.
- **R5** — The lock is derived from the day's attempts, so it survives a reload
  exactly as the attempts do.
- **R6** — In simple mode the `Major` / `Minor` row locks the same way, which
  leaves one live family chip. That is most of the answer, and it is a different
  bargain from one of four modes — accepted, because the family was guessed
  rather than given.
- **R7** — The confirmed chip is never itself ruled out. Locking a row makes
  every *other* option unavailable, so the two states never land on one chip.
- **R8** — On a solved or revealed day the row locked during play still reads as
  locked under the card's own end-of-day lock.
- **R9** — A locked-out chip is still audible, exactly as a ruled-out one is:
  unpickable and still sounding. Only the end-of-day lock is silent, and the two
  must not be collapsed.
- **R9a** — Feature-16's `♪` is untouched. It stays row-wide and on every chip
  while the tap sounds are on, locked-out chips included, because a chip that is
  out still sounds.
- **R9b** — Locking a row moves no label, reflows nothing and changes no chip's
  size. It reuses the state the ruled-out row already uses, so it adds no
  geometry to get wrong.
- **R9c** — Epic 1's four-live-root floor does not apply to a lock. The floor
  bounds the app's own eliminations; locking in is the player's own deduction, so
  a confirmed root may leave a single live root.

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

**Why a lock and not a glyph.** A mark has to be learned: the player has to work
out that `✓` means "this half is settled" rather than "this is selected" or
"this sounds". A row with one live chip left needs no such step — the only thing
you can still press is the thing that was right. It also costs nothing new,
because the dim-and-unpickable state already exists for the ruled-out row, so
there is no glyph slot to find, no second adornment on an already narrow chip,
and no layout to get wrong at 360px.

**The root row is where that has to be paid for, and it is tight.** At 360px,
`PageShell`'s `px-5` and `Card`'s `p-6` leave 272px; the root row is four
columns with 7px gaps, so a chip is about 63px wide, and `Chip`'s own
`px-[15px]` leaves roughly 33px of content — against roughly 47px for a
two-character label like `C♯` plus two inline glyphs. That is the arithmetic a
second glyph would have had to survive, and it is one more reason the lock is
the better answer: it adds nothing to the chip at all, so the width question
never arises and the row's column count — which Epic 1's R6 protects — is
untouched.

**Why stickiness is the whole requirement.** R3 is the difference between this
epic and the feedback line that already exists. A mark describing only the last
check would be a second rendering of a sentence already on screen; a mark that
accumulates is a new thing the card can do. It is also the requirement most
likely to be built wrong, because the natural implementation — read the most
recent attempt — passes a demo and fails on the fourth guess.

## Acceptance criteria

- **AC1** (R1) — Given a checked guess with the right root and wrong mode, when
  the root row is inspected, then every root except that one is dim and cannot
  be selected.
- **AC2** (R1) — Given a checked guess with the right mode and wrong root, then
  every other mode is dim and cannot be selected.
- **AC3** (R1a) — Given a confirmed half, when the card is inspected, then no
  glyph has been added to any chip beyond the `♪` feature-16 already puts there.
- **AC4** (R2) — Given a chip selected but not checked, then nothing locks; and
  given the same chip tapped to hear it, then still nothing.
- **AC5** (R3) — Given a confirmed root, when two further wrong guesses are
  checked, then the root row is still locked to that root.
- **AC6** (R4) — Given a locked root row, then the confirmed chip is still
  selected and still selectable.
- **AC7** (R5) — Given a day with a confirmed half, when the page is reloaded,
  then the row is still locked.
- **AC8** (R6) — Given simple mode and a checked guess whose family was right,
  then the other family chip is dim and cannot be selected.
- **AC9** (R7) — Given any sequence of checked guesses, then the confirmed chip
  is never itself among the unavailable ones.
- **AC10** (R8) — Given a revealed day whose play confirmed a root, then that
  row still reads as locked.
- **AC10a** (R9) — Given a locked-out root on a playable day, when it is tapped,
  then it sounds and no selection changes; and given the day has ended, then
  nothing sounds.
- **AC10b** (R9a) — Given a confirmed row with the tap sounds on, then every
  chip in it still carries the `♪`, the locked-out ones included.
- **AC10c** (R9b) — Given a chip that becomes confirmed, then no other chip in
  the row moves and every chip keeps the same height.
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

- **The lock is derived, never stored.** `Attempt` already carries `rootMatched`
  and `flavourMatched` per checked pair, so both the lock and Epic 1's dimming
  read the same list, and neither needs a field of its own.
- **The lock and the ruled-out dimming are one visual state.** A player cannot
  tell whether a dim chip was eliminated by the app, spent by their own wrong
  guess, or locked out because the answer is settled — and does not need to.
  What all three mean is the same: not this one, not any more.
- **Locking reuses the state the ruled-out row already has**, so it introduces
  no adornment, no positioning, no second slot and no accessible-name question.
  The `♪` is the only glyph on a chip, exactly as feature-16 left it.
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

### Cycle 3 — 2026-09-02

**Superseding Q1 and Q2 below: the check mark is gone.** Reviewing the built
feature, the glyph did not earn its place — a mark has to be learned, where a row
with one live chip left explains itself. A confirmed half now locks its row
instead: every other option becomes unavailable, in the dim-and-unpickable state
the ruled-out row already uses.

Q1's answer (both marks, `♪` before the label and the check after) and Q2's
answer (the check positioned out of the content flow) are therefore moot. They
are kept below as the record of what was asked and decided at the time, not as
current requirements. What survives from them is the reasoning that made the
lock attractive: the root chip has about 33px of content at 360px against 47px
for a label plus two glyphs, so a second mark was always going to be tight.
Applied to: R1, R1a, R4, R7, R9, R9a, R9b, R9c (rewritten), AC1–AC10c
(rewritten), Summary, Scope, Behaviour details, Assumptions

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
