# PRD — Epic 2: The row looks audible

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Every chip in the root row carries a small mark saying it can be heard, and the
card says the same thing in words. The mode row carries nothing, because mode
chips are silent. A player learns the roots are audible before they have spent
a guess discovering it.

## Problem

Epic 1 makes the root chips sound, and nothing on the page says so. A chip that
looks exactly like the silent chip beside it will not be tapped for its sound:
players tap a root when they have decided on it, not to audition it. A feature
nobody discovers has not shipped.

## Scope

- A small mark on each chip in the root row.
- A generic optional adornment on the design system's `Chip`, passed through by
  `ChipGroup`.
- Copy that says, in words, that the row answers back.

**Out of scope**
- **The sound itself** — everything under `lib/audio/`, `data/` and
  `scripts/grooves/` is Epic 1.
- **The same mark on the mode row.** Mode chips are silent and must not
  advertise otherwise.
- **Reworking the how-to-play box.** Feature-8 fixed its four lines and their
  exact wording (F8 E3 R4) and its tests assert them; the box is left alone.
- **A tooltip, a coach mark, a first-run overlay, or any dismissible hint.** A
  mark and a sentence, as settled in the roadmap.
- **Teaching the mode row anything.** The *Explain the answer* candidate owns
  that.

## Requirements

- **R1** — Every chip in the root row carries a small mark indicating it can be
  heard.
- **R2** — No chip in the mode row carries the mark.
- **R3** — The mark is present in every state the chip has: idle, selected and
  disabled, and in both simple mode and the full twelve.
- **R4** — The mark is decorative. A chip's accessible name stays its label
  alone and is unchanged from today, as `HowToPlay`'s emoji and `ModeToggle`'s
  track already are.
- **R5** — The mark is never the only signal. The card says in words that the
  root row can be heard, so the affordance survives being missed, misread, or
  rendered without its glyph.
- **R6** — `Chip` takes a generic optional adornment. It learns nothing about
  roots, pitch or audio, and remains usable on any row — including the
  read-only inverted chips in `SolvedPanel`.
- **R7** — `ChipGroup` passes the adornment through for the row that asks for
  it, and rows that do not ask are rendered exactly as they are today.
- **R8** — The mark does not change the chip's height, its padding, or the
  row's grid. A root row with marks and a mode row without still read as the
  same row of controls.
- **R9** — The mark is legible against both the idle and the selected chip
  treatments, in the light and the dark palette.
- **R10** — Nothing about the mark is persisted or stateful. It does not recede
  after the player has tapped a root, and no storage records that it was seen.

## Behaviour details

**Why the mark goes in the design system rather than in the feature.** The chip
is a primitive, and a primitive that has learned what a root is stops being
reusable — the standing rule in `docs/coding-guidelines.md`, motivated by
`ChipGroup` itself. So `Chip` gains an adornment slot that means nothing in
particular, and the feature is what decides that this row's adornment means
"this one sounds". `SolvedPanel`'s inverted chips pass nothing and are
unchanged.

**Why it is both a mark and a sentence.** R5 is not belt-and-braces. A glyph
alone is ambiguous — a small symbol on a chip could be decoration, a category,
or a state — and words alone sit away from the gesture they describe. Together
one says *where* and the other says *what*.

## Acceptance criteria

- **AC1** (R1) — Given the guess card, then every chip in the root row renders
  the mark.
- **AC2** (R2) — Given the guess card, then no chip in the mode row renders the
  mark.
- **AC3** (R3) — Given simple mode is on, then all six root chips render the
  mark.
- **AC4** (R3) — Given the day is solved or revealed, then the disabled root
  chips still render the mark.
- **AC5** (R4) — Given a root chip, then its accessible name is its root label
  alone, with no mention of the mark or of sound.
- **AC6** (R5) — Given the page, then it states in words that the root row can
  be heard.
- **AC7** (R6) — Given a `Chip` with no adornment, then it renders exactly as
  it does today, in both tones.
- **AC8** (R7) — Given `ChipGroup` with no adornment, then its chips render
  exactly as they do today.
- **AC9** (R6) — Given `SolvedPanel`, then its chips render no adornment.
- **AC10** (R8) — Given the root row and the mode row side by side, then their
  chips have the same height.
- **AC11** (R10) — Given a root chip has been tapped, when the page is
  reloaded, then the mark is still present on every root chip.

## Dependencies

**Needs to build:** nothing. Epic 1's contract — *a chip in the root row sounds
when tapped, and the mode row does not* — is what this epic promises in the UI,
and the promise can be built and unit-tested before the sound exists.

**Needs to ship:** Epic 1. A mark promising a sound that is not there yet is
worse than no mark, so the two land together.

**Shares one file with Epic 1:** `GuessCard`. Epic 1 owns the root row's
`onSelect`; this epic owns the adornment props and the copy. Neither touches
the other's half.

## Assumptions

- **The mark is a leading adornment**, before the label, so a row of chips has
  its marks in a column rather than scattered by label width.
- **The mark is always shown, for everyone.** It does not fade after first use
  and there is no "seen it" flag — consistent with feature-8's R13, which kept
  the how-to-play rule free of any new storage key.
- **No animation.** The mark does not pulse, bounce or react to the note.

## Open questions

The current round. Tick one option per question (`- [x]`), or write your own,
then re-run `/brainstorm feature-10 epic-2` — the answers get folded into the
sections above, moved into the log, and replaced with whatever they open up.

### Q1. What is the mark?

This decides the shape of `Chip`'s new prop: a text glyph is a string, an icon
is a node, a dot is a boolean flag with a style.

- [ ] A) A small speaker glyph, e.g. `🔈` *(recommended — "this makes a sound" is the thing being said, and it is the one symbol a player will not misread as musical decoration on a page already covered in musical language)*
- [x] B) A small note glyph, e.g. `♪` *(sits better with the page's typography and the Real Book headline face — but on a music app every chip already implies a note, so it risks reading as ornament)*
- [ ] C) A plain dot or ring, unlabelled *(quietest, and carries no meaning at all without the caption doing all the work)*
- [ ] D) No glyph — a distinct chip treatment instead, e.g. an underline or a second border *(nothing new in the layout, but a treatment that means "audible" has to be learned, and R9 gets harder in two palettes)*

### Q2. What does the card say in words, and where?

The caption under the play control currently reads *"Play along. Find the note
that feels like home."* The roadmap put the new words there. Worth noting
before you pick: on wide screens that caption is in the **groove card**, in the
other column from the chips it would be pointing at. On a phone the cards
stack, so it sits directly above them.

- [x] A) Extend the caption: *"Find the note that feels like home — Play along with your instrument or tap a root to hear it."* *(recommended — it is the line that sets the task, so the answer belongs in the same breath; and it is the roadmap's settled position)*
- [ ] B) Put it on the root row's own label instead — `Root · tap to hear` — and leave the caption untouched *(the words sit with the chips at every width, at the cost of a heavier eyebrow label and a settled roadmap line reopened)*
- [ ] C) Both: extend the caption and label the row *(nothing is missed; the same instruction is on screen twice)*
- [ ] D) Replace the caption entirely: *"Play along, then tap a root to hear it against the groove."* *(one sentence instead of two — but it drops "the note that feels like home", which is the line that tells the player what they are listening for)*
