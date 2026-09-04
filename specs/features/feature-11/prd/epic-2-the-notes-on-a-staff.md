# PRD — Epic 2: The notes on a staff

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Beneath the lead sheet, the day's scale is drawn as notes on a staff — ascending
from the root, spelled the way the panel already spells it, with the
accidentals a reader expects. "Notes to live in" becomes something a musician
reads rather than a row of letters they have to translate.

## Problem

The payoff panel lists the scale as up to seven chips: `E`, `F♯`, `G`, `A`, `B`,
`C♯`, `D`. That is the right information in the least musical form available. A
player looking at the panel is about to pick up an instrument, and the shape of
a scale — where the steps are wide, where the accidental falls — is exactly what
a staff shows and a row of letters hides.

## Scope

- A note-name-to-staff-position function in `lib/theory/`, beside `notes.ts`.
- A staff component in `components/puzzle/`, drawn as SVG.
- The scale rendered on it, inside the payoff panel, below the lead sheet.
- The note-name chips retired, and the panel restacked to give the staff width.

**Out of scope**
- **The chord symbols and the bars.** Epic 1 owns the lead sheet.
- **The progress track.** Epic 3.
- **Superseded by feature-15.** The scale is drawn in quarter notes — a filled
  head with a stem, turning over at the middle line — behind a generated
  engraved clef, and the staff closes on a thin-and-thick final bar. The
  reasoning below is kept as written because it is why the drawing started
  where it did, not because it still describes the app.
- **Rhythm.** Whole notes, evenly spaced, no stems, beams, bar lines, time
  signature or key signature. This is a picture of a scale, not a transcription.
- **The groove's actual melody, bass line or comping.** The app holds no
  note-level data for a groove — only its scale and its changes — and this epic
  adds none.
- **Playing a note when it is touched.** Feature-10 made the root row audible;
  the staff is a drawing.
- **Transposing, clef switching by the player, or any control at all.**

## Requirements

- **R1** — The payoff panel draws the day's scale as noteheads on a five-line
  staff, ascending from the root, in the order `scaleNotes` returns them.
- **R1a** — The staff replaces the note-name chips. The letters are not printed
  beside it, beneath it, or under the noteheads; they survive as the staff's
  accessible text (R7), which is what a screen reader and a test both read.
- **R1b** — The staff carries a treble clef, and the root is placed in the
  octave running upward from middle C, with the scale ascending from there. One
  clef and one rule for all twelve roots, so the same scale is the same picture
  wherever it starts.
- **R1c** — The panel stacks: the lead sheet at full width, the staff below it
  at full width, each keeping its own eyebrow label. The two-column grid that
  held two rows of chips does not survive contact with a staff.
- **R2** — Each note's vertical position is its letter and octave; its
  accidental is drawn to the left of the notehead. A note with no accidental
  gets none.
- **R3** — The mapping from a spelled note name to a staff position is a plain
  function in `src/features/daily-groove/lib/theory/`, tested directly. It
  handles every symbol `notes.ts` can spell, including `♭♭` and `♯♯`.
- **R4** — The six-note blues scale is drawn correctly. `C Blues` is
  `C E♭ F G♭ G B♭`: two notes on the same line, one flattened and one natural,
  adjacent. Neither notehead nor accidental may collide or overlap the other.
- **R5** — Notes that fall outside the staff get ledger lines.
- **R6** — Every scale the catalogue can mint is drawable: all twelve roots
  against all thirteen flavours in `FLAVOUR_INTERVALS`. A combination the mapping
  cannot place fails loudly in tests, never as a broken panel on that mode's day.
- **R7** — The staff carries an accessible text alternative naming the notes in
  order. A screen reader gets the scale as words, not as a description of a
  drawing.
- **R8** — The staff is lettered in the app's jazz face where it carries
  lettering at all, and its ruling matches the lead sheet's weight, so the panel
  reads as one page rather than a drawing pasted under a chart.
- **R9** — The staff is legible on the panel's inverted accent surface in both
  palettes, taking its ink from the same `on-accent` token as the rest of the
  panel.
- **R10** — The staff fits a phone: it never overflows the panel horizontally,
  and the notes stay distinguishable at the narrowest supported width.
- **R11** — A day given up on shows the same staff as a day solved.
- **R12** — The staff is static: no animation, no interaction, no state.

## Behaviour details

**Why a spelled name is enough.** `scaleNotes(answer)` already does the hard
part — it walks letters, not pitch classes, so A Dorian spells `F♯` and never
`G♭`, and the blues scale declares its own letters because two of its degrees
share one. The staff therefore needs no theory of its own: letter → line or
space, accidental → glyph. Everything it draws comes from a string like `E♭`.

**The blues collision.** Six of the thirteen flavours are seven notes and one is
six, and only the blues scale puts two noteheads on the same line. The staff
must space them horizontally like any other pair of adjacent notes, with each
accidental in front of its own notehead — the natural sign included, since a `G`
following a `G♭` needs one to read correctly.

## Acceptance criteria

- **AC1** (R1, R2) — Given `E Dorian`, when the panel renders, then seven
  noteheads ascend from E, and the F carries a sharp.
- **AC2** (R4) — Given `C Blues`, when the panel renders, then six noteheads are
  drawn, the G♭ and the G occupy the same staff position, and their noteheads do
  not overlap.
- **AC3** (R3, R6) — Given every root paired with every flavour in
  `FLAVOUR_INTERVALS`, when the mapping runs, then each returns a position and an
  accidental for every note, and none throws.
- **AC4** (R5) — Given a scale that runs past the top or bottom line, when the
  panel renders, then the notes outside carry ledger lines.
- **AC5** (R7) — Given the panel renders, when the staff is read by an
  accessible-name query, then the note names are available in order as text.
- **AC6** (R1, R1c) — Given the panel renders, then the staff appears below the
  lead sheet, both at full width inside the panel, each under its own label.
- **AC6a** (R1a) — Given the panel renders, then no chip carrying a note name is
  present, and the note names are still reachable as text.
- **AC6b** (R1b) — Given `B Ionian` and `C Ionian`, when the panel renders, then
  both are drawn in the treble clef with the root in the octave above middle C,
  and the higher scale carries ledger lines rather than changing clef.
- **AC7** (R11) — Given a day given up on, when the panel renders, then the same
  staff is drawn.
- **AC8** (R9) — Given the dark palette, when the panel renders, then the
  staff's ink is the panel's `on-accent` ink and no colour is hardcoded.

## Dependencies

- **Epic 1** — the lead sheet it sits beneath, and the drawing conventions
  (ruling weight, ink, jazz face) it matches. It does not need Epic 1's
  bar-to-chord function.

## Assumptions

- The staff is drawn as SVG, hand-written, with no new dependency — settled in
  the roadmap (Q2 → A).
- The notes drawn are the scale, not the groove's own line — settled in the
  roadmap (Q3 → A).
- Restacking the panel (R1c) touches only the arrangement of the two labelled
  groups. The panel's heading line — the answer, the tries, the streak — is not
  rearranged.
- `PanelColumns` may end up unused by this panel. Whether it stays in the design
  system for another caller or goes is an implementation call, not a product one.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only: never rewrite or prune
a past cycle, or the record stops being trustworthy.

### Cycle 1 — 2026-08-31

**Q1. Do the note-name chips survive?**
Answer: **A) The staff replaces the chips; the note names live on as the staff's
accessible text** — the briefing asks for the notes rendered as notes, and the
panel is already carrying a lead sheet.
Applied to: R1a, R7, AC6a, Scope

**Q2. Which clef, and in which octave does the scale sit?**
Answer: **A) Treble clef, the root placed in the octave from middle C upward** —
one clef and one rule, ledger lines only above, and the shape stays the same
picture for every root.
Applied to: R1b, AC6b
