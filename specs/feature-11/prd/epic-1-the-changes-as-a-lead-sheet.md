# PRD — Epic 1: The changes as a lead sheet

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

When the day ends, the payoff panel stops listing the harmony as two grey chips
and draws it: four bars, ruled and barred, each carrying the chord symbol that
sounds in it, hand-lettered in the app's own jazz face. A player who solves the
day sees a page out of a Real Book, not a table of values.

## Problem

`SolvedPanel` shows "The changes" as `C7` and `C7–Em7♭5–B♭maj7–Fmaj7` — two
chips, one of which is the first chord of the other. A dash-joined string does
not say which chord is sounding in which bar, which is the one thing a player
needs to jam over the loop they have just spent four minutes listening to. The
groove is four bars; the harmony should be shown the way four bars of harmony
are written down.

## Scope

- A bar-to-chord function in `lib/theory/`, matching the generator's own rule.
- A lead-sheet component in `components/puzzle/`, drawn as SVG.
- `SolvedPanel`'s "The changes" column rendering it in place of the two chips.
- The jazz face reaching the sheet without a raw font utility spreading through
  the feature.

**Out of scope**
- **The scale notes.** They stay as they are in this epic; Epic 2 draws them on
  a staff.
- **The four-bar progress track.** Epic 3 puts chord symbols over it.
- **The simple-mode switch.** Epic 4.
- **Any catalogue or generator work.** Everything needed is in `progression`
  already; nothing under `scripts/grooves/` or `data/` is touched.
- **A melody, a rhythm, a time or key signature, repeat marks, or a second
  ending.** Four bars, the chords in them, and nothing that implies the app
  knows more about the tune than it does.
- **A five-line stave under the symbols.** The bars are ruled by their bar lines
  alone. Epic 2's scale is the only staff on the page.
- **A chart head — tune title, key, tempo marking.** The groove card already
  heads itself with the groove's name and its tempo, and the panel's own heading
  already reads the scale; a head would print all three a second time.
- **Anything before the day ends.** The panel only exists once the day is over,
  and this epic does not change when it appears.

## Requirements

- **R1** — The payoff panel draws the day's changes as four bars, in order,
  left to right.
- **R2** — Bar *n* (0-indexed) carries chord `chords[n % chords.length]`, where
  `chords` is `groove.progression` split on `–`. A three-chord progression
  therefore reads `1 2 3 1`, and bar four is a return rather than a new change.
  This is the same arithmetic the generator comps with (`chordFor` in
  `scripts/grooves/events.ts`), and it has to stay the same: the sheet is wrong
  the moment it disagrees with what is sounding.
- **R3** — The mapping is a plain function in `src/features/daily-groove/lib/theory/`,
  taking the progression string and returning exactly four symbols. It is total:
  a one- or two-chord progression cycles to fill four bars, and a progression
  longer than four is truncated to its first four bars rather than throwing.
- **R4** — Chord symbols are set in the app's jazz face — Petaluma Script,
  `--font-jazz` — the same hand the masthead is lettered in.
- **R5** — The sheet reads as a jazz lead sheet, not a table: thin ruled bar
  lines, a closing double bar, symbols sitting above the bar rather than boxed
  or centred in a cell, and air between the bars.
- **R5a** — The bars carry no stave and no rhythm slashes. Bar lines, chord
  symbols and the space between them are the whole drawing, and the sheet shows
  nothing but the four chords — no tune title, no key, no tempo marking.
- **R6** — The sheet replaces both chips in the "The changes" column. The tonic
  chord is bar one and is not shown a second time as its own chip.
- **R7** — The changes keep their `LabelledColumn` eyebrow. Their place in the
  panel's grid is not fixed by this epic: Epic 2 stacks the panel so the staff
  sits below the sheet at full width, and the sheet must survive that move
  without being rebuilt.
- **R8** — The sheet is legible on the panel's inverted accent surface, in the
  light and the dark palette. Its ink comes from the same `on-accent` token the
  panel's other content uses, never a fixed colour.
- **R9** — The sheet carries an accessible text alternative naming the four
  chords in order, so a screen reader gets what the chips used to give it. The
  drawing itself is not announced shape by shape.
- **R10** — The sheet fits a phone. It never overflows the panel horizontally
  and it never shrinks a chord symbol below legibility to fit; if the four bars
  cannot fit one line at the narrowest supported width, they wrap two-by-two as
  a real chart would, keeping the bar order.
- **R11** — A day given up on shows the same sheet as a day solved. The panel
  already drops the claim of a win; the harmony is the harmony either way.
- **R12** — Nothing about the sheet is stateful, animated or interactive. It is
  a drawing that appears with the panel and stays.

## Behaviour details

**The bar mapping, worked through.** The seeded catalogue holds 17 three-chord
progressions and 13 four-chord ones, so the repeat in bar four is the common
case rather than the exception:

| `progression` | Bar 1 | Bar 2 | Bar 3 | Bar 4 |
| :-- | :-- | :-- | :-- | :-- |
| `C7–Em7♭5–B♭maj7–Fmaj7` | C7 | Em7♭5 | B♭maj7 | Fmaj7 |
| `Em7–Bm7–C♯m7♭5` | Em7 | Bm7 | C♯m7♭5 | Em7 |

**Reaching the jazz face.** `font-jazz` is reachable today only through
`Heading` size `xl`, which is the masthead's size as well as its face, and the
sheet needs the face at a chart's size. Either the typography primitive gains a
face the sheet can ask for, or the symbols are drawn as SVG text carrying the
token directly. Both are acceptable; scattering a raw `font-jazz` utility
through the feature to get at it is not.

## Acceptance criteria

- **AC1** (R1, R2) — Given a day whose progression is `C7–Em7♭5–B♭maj7–Fmaj7`,
  when the panel renders, then four bars show those four symbols in that order.
- **AC2** (R2) — Given a day whose progression is `Em7–Bm7–C♯m7♭5`, when the
  panel renders, then bar four shows `Em7`.
- **AC3** (R3) — Given a single-chord progression, when the mapping runs, then
  it returns that chord four times; given five chords, then it returns the first
  four; in neither case does it throw.
- **AC4** (R6) — Given any solved day, when the panel renders, then the tonic
  chord appears exactly once on the page and no chip labelled with the full
  dash-joined progression exists.
- **AC5** (R4, R5) — Given the panel renders, then the chord symbols resolve to
  the jazz face and the four bars are separated by bar lines with a doubled
  final bar line.
- **AC5a** (R5a) — Given the panel renders, then the changes carry no stave
  lines, no rhythm slashes, and no title, key or tempo text.
- **AC6** (R9) — Given the panel renders, when the sheet is read by an
  accessible-name query, then the four chords are available in order as text.
- **AC7** (R11) — Given a day given up on, when the panel renders, then the same
  four bars are drawn.
- **AC8** (R8) — Given the dark palette, when the panel renders, then the
  sheet's ink is the panel's `on-accent` ink and no colour is hardcoded.

## Dependencies

Nothing before it. It hands two things to later epics:

- **The bar-to-chord function** — `(progression: string) => string[]` returning
  four symbols. Epic 3 builds against this signature and needs nothing else
  from this epic.
- **The lead-sheet component's props** — the four symbols, nothing derived
  inside it.

## Assumptions

- The `–` in `progression` is the en dash the generator writes; the split is on
  that character, and a `-` in a chord symbol itself never occurs in the
  catalogue's vocabulary.
- The sheet is drawn as SVG, hand-written, with no new dependency — settled in
  the roadmap (Q2 → A).
- `SolvedPanel` may stop taking the `chord` prop, or keep taking it and not
  render it. Either is fine; the observable rule is R6.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only: never rewrite or prune
a past cycle, or the record stops being trustworthy.

### Cycle 1 — 2026-08-31

**Q1. Do the four bars sit on a five-line stave?**
Answer: **A) Bar lines and symbols only — no stave** — it keeps the sheet from
competing with Epic 2's staff directly beneath it, and four empty staves under
four chords is a page with a hole in it.
Applied to: R5a, AC5a, Out of scope

**Q2. Does the sheet carry a chart head — title, key, tempo?**
Answer: **A) Chords only** — the groove card already heads itself with the
groove's name and tempo and the panel heading already names the scale, so a head
would print all three twice.
Applied to: R5a, AC5a, Out of scope
