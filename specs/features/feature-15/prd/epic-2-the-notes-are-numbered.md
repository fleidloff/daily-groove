# PRD — Epic 2: The notes are numbered

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

The staff in the box gains a row of degree numbers — `1 2 3 4 5 6 ♭7` — written
below the staff, under the notes they belong to. The scale then reads as a
pattern that moves to any key rather than seven facts about one. The notation itself does not change: this is a row of
numbers added to a drawing feature-11 finished.

## Problem

Sam learned by ear and by tab, never by theory. `E♭ F G A♭ B♭ C D♭` is seven
things to memorise in one key; `1 2 3 4 5 6 ♭7` is one shape that works in all
twelve and can be found on the neck without reading. The staff gives the first
and not the second — and Sam wants "to get better at hearing, not at reading".

There is a smaller problem the same row exposes. The note names are not on
screen at all: `ScaleStaff` takes them as `label` and spends them on
`aria-label`, so a sighted player reads noteheads and nothing else. A player who
cannot name a notehead at sight — which is the persona, by definition — gets no
names from the box today.

## Scope

- A degree label under each notehead in `ScaleStaff`.
- The accessible label naming degrees alongside notes.
- Whether the note names themselves become visible (Q1).

**Out of scope**
- **Any change to noteheads, clef, ledger lines, accidentals or spacing.**
  Feature-11 Epic 2 finished the drawing; this adds a row under it.
- **Rhythm, beams, key or time signature.** Still a picture of a scale: nothing
  is beamed, dotted or barred into time.
- **Not out of scope any more, and added after this PRD was settled:** the notes
  are drawn as quarter notes — a filled head with a stem, up on the right below
  the middle line and down on the left on it and above; the clef is Bravura's G
  clef, the standard engraved glyph, shipped as path coordinates rather than as a
  font; and the staff closes on a thin-and-thick final bar. A stem is not
  rhythm: it is what makes a notehead read as a note to a player who does not
  read fluently, which is the persona.
- **The lead sheet's numerals** — Epic 3, and a different notation: scale degrees
  are arabic, the changes are Roman.
- **Deriving the degrees.** Epic 1 owns the function; this draws what it is
  handed.
- **Interval names** — "minor seventh", "tritone". Numbers only.

## Requirements

- **R1** — Each notehead carries its scale degree, drawn **below** the staff and
  horizontally aligned to the notehead it belongs to: the notes are read first
  and the numbers are what they mean.
- **R1a** — Alignment is to the notehead's own x, computed from the geometry the
  noteheads already use, so a number cannot drift out of step with its note.
- **R1b** — The row belongs to the staff, not to the panel. It sits directly
  below the staff's own drawing, closer to the notes it labels than to the
  panel's bottom edge — otherwise the numbers read as a caption to the box rather
  than to the scale.
- **R1c** — The row's y is fixed: the same on every day, whatever the scale. It
  is derived once from the lowest position the rotation can draw, so it clears
  every scale's noteheads and their accidentals rather than being pushed around by
  the day's answer. That bound is knowable: `staffNotes` places a root at its own
  letter's first occurrence at or above middle C, so the lowest notehead any
  scale can reach is C4 — step 0, one ledger line below the bottom line, on a
  scale rooted on C.
- **R1d** — A number is never drawn over a notehead. It may cross a ledger line
  or a low note's accidental, and where it does the number is painted over
  them: a ruled line crossed by a numeral still reads as both, while a number
  behind a notehead reads as neither.
- **R1e** — The box is therefore the same height on every day. A row whose y rose
  and fell with the scale would change the panel's height from one day to the
  next for no reason the player could see.
- **R2** — The count of labels is whatever the degree namer returns: six for the
  blues scale, seven for a mode. Nothing counts `1..7`.
- **R3** — `ScaleStaff` derives nothing. It takes the labels as a prop, in note
  order, and draws them. It never sees the answer, the flavour or the interval
  table.
- **R4** — The degrees take their ink from `currentColor` like the rest of the
  drawing, so they stay legible on the box's inverted accent surface in both
  palettes without naming a token.
- **R5** — The numbers read as a caption to the notes, not a second voice
  competing with them. The staff stays the primary drawing.
- **R6** — The accessible label names degree and note together, in order, so a
  screen reader gets the pairing a sighted reader gets from the alignment. The
  numbers are not a sighted-only layer.
- **R6a** — The note names are not drawn on screen. The notation and the numbers
  are already two views of one scale, and Sam wants "to get better at hearing,
  not at reading" — a third row spelling `E♭ F G A♭ B♭ C D♭` is the wall of
  information the box's twenty-second budget rules out. The accessible label
  stays their only home.
- **R7** — At a 360px viewport no label overlaps its neighbour and the staff does
  not scroll horizontally. Sam plays on a phone.
- **R8** — A staff drawn with no notes draws no numbers and does not break.
- **R9** — The row appears only in the box on a finished day, because that is the
  only place the staff appears. Nothing here makes the scale visible earlier — it
  would name half the answer.

## Behaviour details

`ScaleStaff` is an SVG whose every x comes off `LEFT` and `ADVANCE`, with
`SHARED_STEP_EXTRA` added for a note repeating the previous note's step. The
degree row is that same x sequence, one text node each, below the bottom line.
The drawing's `HEIGHT` grows downward by a constant to make room; the staff lines
do not move, and neither does any notehead.

The constant is one number, not a measurement of the day's scale: the row sits
clear of step 0 — C4, the lowest notehead `staffNotes` can produce, one ledger
line below the bottom line — so no scale in the rotation reaches it.

The blues scale is the whole test of this epic. `C blues` is `C E♭ F G♭ G B♭` —
six notes, `G♭` and `G` on the same step — so its numbers are `1 ♭3 4 ♭5 5 ♭7`,
and the fourth and fifth sit further apart than the rest because the second of
the shared-step pair was given extra advance for its accidental.

## Acceptance criteria

- **AC1** (R1, R1a) — Given a seven-note mode, when the staff renders, then each
  of the seven noteheads has a degree label at the same x, below the staff's
  bottom line.
- **AC2** (R2) — Given a blues day, when the staff renders, then it draws six
  labels reading `1 ♭3 4 ♭5 5 ♭7`.
- **AC3** (R1a) — Given the blues scale, whose ♭5 and 5 share a step, when the
  staff renders, then each label sits under its own notehead, including the one
  that received the extra advance.
- **AC4** (R3) — Given the component's source, then the degrees arrive as a prop
  and nothing is imported from the interval tables.
- **AC5** (R6) — Given a finished day, when the staff's accessible name is read,
  then it names each degree with its note, in order.
- **AC6** (R8) — Given an empty note list, when the staff renders, then it draws
  no labels and does not throw.
- **AC7** (R7) — Given a 360px viewport and a seven-note scale, when the box
  renders, then no label overlaps another and the panel does not scroll
  sideways.
- **AC8** (R2) — Given a degree count that disagrees with the note count, then
  the mismatch is caught by a `lib/` test, not by the drawing.
- **AC9** (R6a) — Given a finished day, then no note name is rendered as visible
  text anywhere in the staff's column.
- **AC10** (R1c, R1e) — Given a scale rooted on C, which reaches down to C4, and
  a scale rooted on G, which does not leave the staff below, then the degree row
  has the same y in both and the drawing has the same height.
- **AC11** (R1d) — Given a scale reaching C4, then no degree label overlaps a
  notehead, and where a label meets a ledger line the label is painted after it.

## Dependencies

**Needs Epic 1's degree namer** — `(answer) → string[]`, one label per note in
`scaleNotes` order. Once that signature is pinned, this epic can be built in
parallel with Epic 4 against it.

Hands nothing forward.

## Assumptions

- The degrees are drawn in the same `font-jazz` hand as the rest of the page, at
  a small size — a row of numbers pencilled under a staff is exactly the marking
  a musician makes on a Real Book page.
- `SolvedPanel` composes both props from the answer, as it composes `staffNotes`
  today.
- The `LabelledColumn` heading stays "Notes to live in".
- The row is part of the `ScaleStaff` SVG rather than a sibling element above it,
  so one drawing owns both the notes and their numbers and they cannot fall out
  of alignment across a reflow.
- Step 0 is the true floor of the rotation's staff range. It follows from
  `staffNotes`' own rule — a root at its letter's first occurrence at or above C4
  — and a test over every root and flavour in the shipped manifest is the
  cheapest way to keep it true if the catalogue grows.


## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only: never rewrite or prune a
past cycle, or the record stops being trustworthy.

### Cycle 1 — 2026-09-01

**Q1. Do the note names become visible too, or only the degrees?**
Answer: **A) Degrees only; the names stay in the accessible label** — notation
plus a number is already two views of one scale, and Sam wants to get better at
hearing rather than reading.
Applied to: R6a, AC9, Scope

**Q2. Where does the degree row sit relative to a scale that runs low?**
Answer: **C) Above the staff, over the noteheads** — the position a player writes
a degree in by hand, and it takes the row out of the way of a low scale's ledger
lines entirely.
Applied to: R1, R1b, Summary, Behaviour details, AC1, Assumptions

### Cycle 2 — 2026-09-01

**Q3. A scale can run above the staff too — where do the numbers go then?**
Answer: **A) A fixed y above the top line, the number painted over any ledger
line it meets** — a fixed baseline is one number, keeps the box the same height
every day, and a ledger line crossed by a numeral still reads as both. The y is
set clear of step 12, the highest notehead the rotation can draw, so it never
crosses a notehead.
Applied to: R1c, R1d, R1e, Behaviour details, AC10, AC11, Assumptions

### Cycle 3 — 2026-09-01

**Change of mind: the numbers go below the notes after all.**
Answer: **below the staff, under the noteheads** — asked for directly, in place
of Cycle 1's Q2 → C.
Supersedes: Cycle 1 **Q2 → C** (above the staff, over the noteheads), and with it
Cycle 2 **Q3 → A**, whose whole subject was the high scales the row met up there.
Carried over rather than re-asked: Cycle 2's *principle* — a fixed y, one
constant, the box the same height every day, the number painted over a ledger
line it crosses and never over a notehead. It was chosen on those merits and they
hold in either direction; only the bound flips, from step 12 above to step 0
below.
Applied to: R1, R1b, R1c, Summary, Behaviour details, AC1, AC10, AC11,
Assumptions
