# PRD — Epic 3: Chords over the playing bars

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Once the day is over, the four-bar track on the groove card carries the chord
symbols above its bars, hand-lettered in the app's jazz face, and the symbol
over the sounding bar stands at full ink while the other three fall back. Press
play after solving and the changes can be read while the loop runs — and the one
you are in is the one that is lit.

## Problem

The groove card's track shows four bars stepping past and names none of them.
The panel below it now draws the changes as a lead sheet, but the panel does not
move: a player jamming over the loop has to look away from the thing that is
telling them where they are in the bar. The two halves of the same information —
which bar, which chord — sit in different places on the page.

## Scope

- Chord symbols above the four segments of `TransportPanel`'s track, in the
  jazz face.
- The answer beside the tempo in the groove card's meta line.
- The sounding bar's symbol at full ink, the other three dimmed.
- Shown only once the day has ended.

**Out of scope**
- **Before the day ends.** A progression printed over the bars names the root
  and the mode outright, so until the day is over the card is exactly what it is
  today.
- **The track itself.** Position, segments, highlight, the pass arithmetic —
  feature-6 and feature-9 settled all of it, and this epic adds a row above it
  and changes nothing below.
- **`ProgressTrack`.** The design-system primitive may not learn what a chord
  is; the symbols live in the feature.
- **A second lead sheet on the groove card.** This is the track wearing labels:
  no bar lines, no stave, no reuse of Epic 1's drawing.
- **The payoff panel.** Epics 1 and 2. R12 puts the answer on the *card*; what
  the panel shows is unchanged.
- **The groove's name, the date wording, or the meta line's tone and place.**
  R12 adds one segment to a line feature-4 already positioned.
- **Any new audio, timing source, or per-bar data.** The mapping from Epic 1 and
  the position the panel already has are the whole input.

## Requirements

- **R1** — Once the day has ended, the four-bar track carries four chord
  symbols, one above each bar, from the same bar-to-chord mapping the lead sheet
  uses.
- **R2** — Until the day has ended, no chord symbol appears anywhere on the
  groove card.
- **R3** — A day given up on counts as ended. The symbols appear for a revealed
  day exactly as for a solved one.
- **R4** — While the groove is playing, the symbol above the sounding bar is at
  full ink and the other three are dimmed. The full-ink symbol moves with the
  bar and wraps with the loop, in step with the track's own segment highlight.
- **R5** — Which symbol is at full ink is derived from the same position value
  the segment highlight is derived from, so the two can never disagree at a bar
  line.
- **R6** — When nothing is playing, all four symbols are drawn alike, at full
  ink. A stopped card marks no bar, exactly as the track marks no segment.
- **R6a** — The symbols align to the segments precisely enough that the lit
  segment and its chord read as one column, at every supported width.
- **R7** — The symbols are set in the app's jazz face, small, and sit over the
  bars rather than inside boxes, so the card reads as the same page as the
  panel below it.
- **R8** — A symbol stays aligned to its bar at every width the app supports.
  The symbols and the track share one four-column geometry.
- **R9** — The symbols are legible on the card's inset surface in both palettes.
- **R10** — The symbols add no announcement of their own to the track's
  `progressbar` semantics, and the ink moving from bar to bar is not announced.
  A screen reader is not told the chord four times a bar.
- **R11** — The row appearing does not move the play control or the caption
  beneath it more than its own height, and its arrival is not animated.
- **R12** — Once the day has ended, the groove card's meta line names the
  answer beside the tempo: `105 bpm · C Mixolydian · Sunday, 30 August`. One
  line, tempo first, the day last. The payoff panel names the answer too, but it
  sits below both cards and is out of view while you are playing along; the two
  facts a player jamming over the loop needs — how fast, and in what — belong on
  the card that is playing.
- **R13** — Until the day has ended, the meta line is exactly what it is today:
  the tempo and the day, and nothing that answers the puzzle. The groove's name
  in the heading is unchanged in either state.

## Behaviour details

**Why it waits for the end of the day.** The catalogue's progressions name their
own harmony: `Em7–Bm7–C♯m7♭5` is E Dorian written out. Printing it over the bars
during play would answer both halves of the puzzle before the first guess. So
the row is a payoff, not a hint — it arrives with the answer and turns the card
into something to play along with.

**Where the ink comes from.** `TransportPanel` already computes the sounding bar
as `floor(scaled × 4) % 4`, and `null` when stopped. The symbol row reads that
same value: `null` means all four at full ink, a number means that one at full
ink and the rest dimmed. No second timer and no second derivation — a symbol
lighting a frame before or after its segment is exactly what a player looking at
a bar line would notice.

## Acceptance criteria

- **AC1** (R1) — Given a solved day whose progression is `Em7–Bm7–C♯m7♭5`, when
  the card renders, then four symbols read `Em7`, `Bm7`, `C♯m7♭5`, `Em7`.
- **AC2** (R2) — Given a day in progress, with attempts spent and none correct,
  when the card renders, then no chord symbol is present.
- **AC3** (R3) — Given a day given up on, when the card renders, then the four
  symbols are present.
- **AC4** (R4, R5) — Given a solved day playing at a position inside bar three,
  when the card renders, then the third symbol is at full ink, the other three
  are dimmed, and it is the same bar the track's segment highlights.
- **AC5** (R6) — Given a solved day that is not playing, when the card renders,
  then the four symbols are present and all are at full ink.
- **AC6** (R10) — Given a solved day, when the card is inspected for accessible
  content, then the track exposes what it exposes today and the symbols add no
  live announcement.
- **AC7** (R12, R13) — Given a day in progress, when the card renders, then the
  meta line reads `105 bpm · <day>` and names no mode. Given the same day
  solved or given up on, then it reads `105 bpm · C Mixolydian · <day>`, and the
  groove's name in the heading is unchanged.

## Dependencies

- **Epic 1's bar-to-chord function** — `(progression: string) => string[]`
  returning four symbols. That signature is the whole dependency; once it is
  pinned this epic can be built in parallel with Epic 1's drawing.
- Hands nothing to a later epic.

## Assumptions

- The symbols appear once the day has ended, solved or given up — settled in the
  roadmap (Q1 → A).
- The row sits above the track, inside the same inset card, rather than below it
  or outside it.
- A three-chord progression prints its repeated fourth bar like any other, so
  the row can read `Em7 Bm7 C♯m7♭5 Em7`. Showing the repeat is correct: the bar
  is played, and a blank fourth bar would read as silence.
- The groove card keeps its existing caption and play control unchanged.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only: never rewrite or prune
a past cycle, or the record stops being trustworthy.

### Cycle 1 — 2026-08-31

**Q1. What does the track become once the chords are on it?**
Answer: **A) The track as it is, with a row of four symbols above it, in the
jazz face** — the roadmap has the track wearing labels rather than becoming a
chart, and it keeps this epic parallel with Epic 1's drawing.
Applied to: R1, R7, Scope, Out of scope

**Q2. How is the sounding bar's symbol marked?**
Answer: **A) The sounding symbol at full ink, the other three dimmed** — it
matches how the track already reads, one thing lit against a quiet row, and it
needs no box or rule competing with the drawing.
Applied to: R4, R5, R6, R6a, R10, AC4, AC5, Summary, Behaviour details
