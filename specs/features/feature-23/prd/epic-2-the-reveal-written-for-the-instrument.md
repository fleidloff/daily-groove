# PRD — Epic 2: The reveal written for the instrument

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Once the puzzle is solved or given up, everything Sam reads with an instrument
in hand follows the header's transpose pill: the staff and its notes, the lead sheet's
chord symbols, and the chord line over the running groove. A muted line under
the heading gives the concert name whenever Concert is not selected, so the
answer a guitar friend or the shared link's reader knows is still on the page.

## Problem

The reveal is the moment Sam picks the sax up — "to pick up an instrument
afterwards, if the groove is a good one". Today the notes and chords it hands
them are concert pitch, so every one is the wrong fingering until they add a
major sixth in their head, and a line worked out that way is not a line played
by ear.

## Scope

- staff notes and the staff's accessible label in written pitch
- lead-sheet chord symbols in written pitch, numerals unchanged
- the transport panel's chord line in written pitch
- the concert line under the heading
- switching instrument in the solved state re-renders all of it together

**Out of scope**
- **the heading, the chips, the check** — Epic 1
- **audio, tempo, the loop** — nothing heard changes
- **a second transpose control** in the solved box or the groove card — one
  pill, in the header
- **register, clef or octave** — written notes are placed on the treble staff
  exactly as concert notes are; tenor sax's octave is not modelled
- **a fretboard or keyboard picture** — the briefing rules it out

## Requirements

- **R1** — The staff under "Notes to live in" shows the scale spelt from the
  written root: for a concert E♭ Dorian answer on alto sax, C D E♭ F G A B♭.
  The degree labels under the notes are unchanged.
- **R2** — The staff's accessible label pairs each degree with its written
  note, so a screen reader reads the same notes a sighted player sees.
- **R3** — Each lead-sheet chord symbol has its root transposed and its suffix
  kept: concert E♭m7 · G♭maj7 · A♭7 · E♭m7 reads Cm7 · E♭maj7 · F7 · Cm7 on alto
  sax. Roman numerals are unchanged. Written roots are spelt from the app's
  twelve root names.
- **R4** — The chord line over the transport panel shows the same four written
  symbols as the lead sheet, and keeps appearing only once solved or revealed.
- **R5** — When Concert is not selected, a muted line under the heading reads
  the concert answer in the form "E♭ Dorian in concert pitch". On Concert the
  line is absent.
- **R6** — Switching instrument while the solved box is showing re-renders
  staff, label, lead sheet, chord line and concert line together; no reload.
- **R7** — On Concert the solved box is identical to today's, the concert line
  included by its absence.
- **R8** — The near-miss line, the heard-in line, the mode line and the
  next-groove line are unchanged; none of them names a pitch.

## Acceptance criteria

- **AC1** (R1) — Given a solved concert E♭ Dorian and alto sax, when the solved
  box renders, then the staff shows C D E♭ F G A B♭ with the Dorian degrees.
- **AC2** (R1, R3) — For every root × flavour in the catalogue and each of the
  three keys, the written scale is drawable on the staff and carries a double
  accidental only where the concert spelling of that written root already does
  (the catalogue's own C♯ Lydian, C♯ Lydian dominant, A♭ Phrygian and E♭ Blues
  carry one today); every chord symbol's suffix survives transposition
  unchanged; with Concert both are the identity.
- **AC3** (R2) — Given AC1, then the staff's accessible label lists the written
  notes.
- **AC4** (R3) — Given a groove whose concert changes are E♭m7 · G♭maj7 · A♭7 ·
  E♭m7 and alto sax, then the lead sheet reads Cm7 · E♭maj7 · F7 · Cm7 and the
  numerals are those of the concert rendering.
- **AC5** (R4) — Given the same, then the transport chord line reads the same
  four symbols as the lead sheet; before solving it is absent as today.
- **AC6** (R5) — Given alto sax, then a muted line under the heading reads "E♭
  Dorian in concert pitch"; given Concert, no such line renders.
- **AC7** (R6) — Given the solved box on Concert, when the player picks alto
  sax, then staff, label, lead sheet, chord line and concert line all change in
  place; picking Concert again reverts all five.
- **AC8** (R7) — Given Concert, the solved box's rendered text equals today's
  for the same session.

## Dependencies

From Epic 1: `Written`, `writtenRoot` in `src/lib/theory/transpose.ts`,
`useWritten`, and `written` on the session context. This epic adds
`writtenAnswer(answer, written): Answer` and `writtenChord(symbol, written):
string` beside them, and the concert line's snippet under `solved`.

The `writtenChord` and `writtenAnswer` halves and their tests can start against
the `Written` type alone; the `SolvedPanel` and `GroovePuzzle` wiring waits for
Epic 1's hook.

## Assumptions

- A chord symbol is a root — one letter plus an optional ♯ or ♭ — followed by a
  suffix. The catalogue has no slash chords; if one appears, `writtenChord`
  transposes the first root and leaves the rest, and the test in AC2 says so.
- The concert line names the scale only, not the chords. One line is the
  reminder; four more symbols is the reveal twice.
- Tenor sax and trumpet share the B♭ chip and the same +2 pitch-class offset;
  the octave between them is not shown because the staff keeps its register.
- The concert line is a `solved` snippet taking `{ root, flavour }`, like
  `heardIn`.
- No open questions: the roadmap settled placement and the concert line, and
  the remaining calls are the assumptions above.

## Question log

### Cycle 1 — 2026-09-04

**Can AC2 demand "no double accidental"?** (raised by `/writespec`, measured on
the shipped catalogue)
Answer: **no — four concert scales already carry one**, because `scaleNotes`
spells by letter and the staff draws double accidentals; re-spelling
enharmonically would make the staff disagree with the heading's `ROOTS` name.
AC2 now pins the guard the spec can keep: drawable, no new doubles beyond what
the written root's concert spelling has, suffix preserved, identity on Concert.
Applied to: AC2
