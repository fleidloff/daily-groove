# PRD — Epic 2: The row looks audible

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Every chip in the root row carries a small `♪`, and the caption under the play
control says in words that a root can be tapped to hear it. The mode row carries
nothing, because mode chips are silent. A player learns the roots are audible
before they have spent a guess discovering it.

## Problem

Epic 1 makes the root chips sound, and nothing on the page says so. A chip that
looks exactly like the silent chip beside it will not be tapped for its sound:
players tap a root when they have decided on it, not to audition it. A feature
nobody discovers has not shipped.

## Scope

- A `♪` on each chip in the root row.
- A generic optional adornment on the design system's `Chip`, passed through by
  `ChipGroup`.
- New wording for the groove card's caption, saying the row answers back.

**Out of scope**
- **The sound itself** — everything under `lib/audio/`, `data/` and
  `scripts/grooves/` is Epic 1.
- **The same glyph on the mode row.** Mode chips are silent and must not
  advertise otherwise.
- **Reworking the how-to-play box.** Feature-8 fixed its four lines and their
  exact wording (F8 E3 R4) and its tests assert them; the box is left alone.
- **A tooltip, a coach mark, a first-run overlay, or any dismissible hint.** A
  glyph and a sentence, as settled in the roadmap.
- **The caption's position and layout.** Feature-4 Epic 2 put it below the
  control, full width, and that stands. R1a supersedes only the *wording* half of
  that epic's R4 — see *Behaviour details*.
- **Teaching the mode row anything.** The *Explain the answer* candidate owns
  that.

## Requirements

- **R1** — Every chip in the root row carries a small note glyph, `♪`, before
  its label.
- **R1a** — The caption under the play control reads: *"Find the note that feels
  like home — Play along with your instrument or tap a root to hear it."* It
  replaces the wording that is there today and keeps its position: below the
  control, full width, not beside it.
- **R2** — No chip in the mode row carries the glyph.
- **R3** — The glyph is present in every state the chip has: idle, selected and
  disabled, and in both simple mode and the full twelve.
- **R4** — The glyph is decorative. A chip's accessible name stays its label
  alone and is unchanged from today, as `HowToPlay`'s emoji and `ModeToggle`'s
  track already are.
- **R5** — The glyph is never the only signal. `♪` is ambiguous on a page
  already full of musical language, so the caption in R1a is what actually names
  the behaviour; the glyph marks *where*, the caption says *what*.
- **R6** — `Chip` takes a generic optional adornment. It learns nothing about
  roots, pitch or audio, and remains usable on any row — including the
  read-only inverted chips in `SolvedPanel`.
- **R7** — `ChipGroup` passes the adornment through for the row that asks for
  it, and rows that do not ask are rendered exactly as they are today.
- **R8** — The glyph does not change the chip's height, its padding, or the
  row's grid. A root row with glyphs and a mode row without still read as the
  same row of controls.
- **R9** — The glyph is legible against both the idle and the selected chip
  treatments, in the light and the dark palette.
- **R10** — Nothing about the glyph is persisted or stateful. It does not recede
  after the player has tapped a root, and no storage records that it was seen.

## Behaviour details

**Why the glyph goes in the design system rather than in the feature.** The chip
is a primitive, and a primitive that has learned what a root is stops being
reusable — the standing rule in `docs/coding-guidelines.md`, motivated by
`ChipGroup` itself. So `Chip` gains an adornment slot that means nothing in
particular, and the feature is what decides that this row's adornment means
"this one sounds". `SolvedPanel`'s inverted chips pass nothing and are
unchanged.

**Why it is both a glyph and a sentence.** R5 is not belt-and-braces. `♪` on a
music app is genuinely ambiguous — every chip on the page already implies a
note, so the glyph on its own could read as ornament, a category, or a state.
And words alone sit away from the gesture they describe: on wide screens the
caption is in the groove card, in the other column from the chips. So the glyph
marks where, and the caption is what actually names the behaviour.

**What R1a supersedes.** Feature-4 Epic 2 R4 fixed the caption as *"Play along.
Find the note that feels like home."*, rendered below the control and full
width. R1a replaces that string and nothing else: the position, the width and
the ordering relative to the control are feature-4's and are unchanged, as is
its AC3. Feature-4's test on the caption's text is expected to fail and to be
updated to the new wording — it is the only place the old string is asserted.

## Acceptance criteria

- **AC1** (R1) — Given the guess card, then every chip in the root row renders
  the `♪`.
- **AC2** (R2) — Given the guess card, then no chip in the mode row renders the
  `♪`.
- **AC3** (R3) — Given simple mode is on, then all six root chips render the
  `♪`.
- **AC4** (R3) — Given the day is solved or revealed, then the disabled root
  chips still render the `♪`.
- **AC5** (R4) — Given a root chip, then its accessible name is its root label
  alone, with no mention of the glyph or of sound.
- **AC6** (R1a) — Given the groove card, then the caption reads *"Find the note
  that feels like home — Play along with your instrument or tap a root to hear
  it."*
- **AC6a** (R1a) — Given the groove card, then the caption still renders below
  the play control at full width, as feature-4 Epic 2 AC3 requires.
- **AC7** (R6) — Given a `Chip` with no adornment, then it renders exactly as
  it does today, in both tones.
- **AC8** (R7) — Given `ChipGroup` with no adornment, then its chips render
  exactly as they do today.
- **AC9** (R6) — Given `SolvedPanel`, then its chips render no adornment.
- **AC10** (R8) — Given the root row and the mode row side by side, then their
  chips have the same height.
- **AC11** (R10) — Given a root chip has been tapped, when the page is
  reloaded, then the `♪` is still present on every root chip.

## Dependencies

**Needs to build:** nothing. Epic 1's contract — *a chip in the root row sounds
when tapped, and the mode row does not* — is what this epic promises in the UI,
and the promise can be built and unit-tested before the sound exists.

**Needs to ship:** Epic 1. A glyph promising a sound that is not there yet is
worse than no glyph, so the two land together.

**Shares one file with Epic 1:** `GuessCard`. Epic 1 owns the root row's
`onSelect`; this epic owns the adornment props and the copy. Neither touches
the other's half.

## Assumptions

- **The adornment prop is a string**, not a node. `♪` is text, so a string is
  the whole need; a `ReactNode` slot would invite a component into a primitive
  that has none today.
- **`♪` is U+266A, a text glyph, not an emoji.** It inherits the chip's colour
  and size and needs no font of its own, unlike `HowToPlay`'s emoji.
- **The glyph is a leading adornment**, before the label, so a row of chips has
  its glyphs in a column rather than scattered by label width.
- **The glyph is always shown, for everyone.** It does not fade after first use
  and there is no "seen it" flag — consistent with feature-8's R13, which kept
  the how-to-play rule free of any new storage key.
- **No animation.** The glyph does not pulse, bounce or react to the note.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only.

### Cycle 1 — 2026-08-31

**Q1. What is the mark?**
Answer: **B) A small note glyph, `♪`** — it sits with the page's typography and
the Real Book headline face rather than importing an emoji vocabulary the design
does not otherwise use. Its known weakness, that a note glyph can read as
ornament on a music app, is answered by making the caption carry the meaning.
Applied to: R1, R5, AC1–AC4, AC11, Assumptions

**Q2. What does the card say in words, and where?**
Answer: **A) Extend the caption**, in the user's own wording: *"Find the note
that feels like home — play along with your instrument or tap a root to hear
it."* — the line that sets the task is where the answer belongs, and it names
playing along on your own instrument as the first option rather than the only
one.
Applied to: R1a, R5, AC6, AC6a, Out of scope, Behaviour details
