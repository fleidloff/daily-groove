# PRD — Epic 2: The switch and the box say what the two ways are

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

The switch on the card keeps its name, "Simple mode", and gains a line beneath
it that says what is on offer right now. The how-to-play box names both ways to
play in one line under its four steps. Two lines swap rooms: the listening
advice leaves the groove box and becomes the hint box's opening line, and the
drum credit leaves the how-to-play box for the foot of the groove box.

## Problem

"Simple mode" names nothing Sam can picture; it is app vocabulary standing in
for the two facts that matter — six roots, Major or Minor. The switch is also
unannounced: a player who starts in Simple (Epic 1) has no way to know there is
more, and a player who starts full has no way to know there is less. Meanwhile
the groove box carries a sentence of listening advice under the play button and
the how-to-play box carries a licence credit, and both would read better where
the other one is.

## Scope

- a `description` line on the design-system `Switch`
- the mode switch's description, following its state
- one line in the how-to-play box naming both ways and the switch
- the caption removed from the groove box
- the coaching ladder's first rung reworded, with a sounds-off variant
- the drum credit moved to the bottom of the groove box

**Out of scope**
- **who starts in Simple** — Epic 1
- **the rest of the coaching ladder** — only rung one changes; the colour,
  tonic and simple-colour tables are untouched
- **a fifth how-to-play step** — the steps stay four; the new line is not a
  list item
- **a page footer** — the credit becomes a line in the groove box, and the
  **Footer** candidate in `specs/features.md` is left for the user to retire
- **the tap-sounds switch** — it gains no description

## Requirements

- **R1** — The design-system `Switch` accepts an optional `description`. When
  given, it renders beneath the label in a smaller, fainter type; the switch's
  accessible name stays the label alone, and the description is exposed as its
  accessible description. Without it the switch renders exactly as today.
- **R2** — The mode switch's label is `puzzle.simpleMode`, "Simple mode". Its
  description when on reads "Six roots, Major or Minor"; when off it reads
  "Twelve roots, four modes". The description follows the state, so it always
  describes what the card is offering — and it counts what the row shows, not
  the catalogue behind it.
- **R3** — The description names no individual mode, so neither reading of the
  mode row leaks into the switch — the existing guard on the toggle holds.
- **R4** — The how-to-play box has one line under its four steps that names both
  ways to play and points at the switch by name. Proposed text: *"Two ways to
  play: Simple mode is six roots, Major or Minor. The switch on the card opens
  up the full set."* It is a paragraph, not a fifth list item, and it is the
  same text whichever way the player is currently in.
- **R5** — The line under the play button in the groove box is gone. Nothing
  replaces it there.
- **R6** — The coaching ladder's first rung, which the hint box shows from the
  moment the card renders until the first Check, reads: *"Loop it a few times.
  Find the note that feels like home — Play along with your instrument, or tap
  a root or a mode to hear it."* With tap sounds off it reads the same sentence
  ending at *"instrument."*
- **R7** — `coaching.opening` and the ladder's first rung are the same string,
  as today, so the pre-first-guess feedback and the rung never disagree.
- **R8** — The drum credit — "Drum samples provided by DrumGizmo.org" linking to
  `https://drumgizmo.org`, then "CC BY 4.0" linking to the licence — sits as the
  last thing in the groove box, in the faint small type it has today, both links
  opening in a new tab with `noopener`. It is no longer in the how-to-play box.
- **R9** — Every new or moved string lives in `src/lib/snippets/en/` with its
  type in `snippets/types.ts`; no component carries an English word of its own.

## Acceptance criteria

- **AC1** (R1) — Given a `Switch` with a description, when rendered, then
  `getByRole('switch', { name: label })` finds it, its accessible description
  is the given text, and the description text is in the document. Given no
  description, then the switch's text content is the label alone.
- **AC2** (R2) — Given the mode switch on, then "Six roots, Major or Minor" is
  visible and the accessible name is still "Simple mode"; given it off, then
  "Twelve roots, four modes" is visible instead.
- **AC3** (R3) — Given either state, then the toggle's text matches no mode
  name.
- **AC4** (R4) — Given the how-to-play box open, then the two-ways line is
  visible, it contains "Simple mode", and there are still exactly four list
  items.
- **AC5** (R5) — Given the page rendered, then neither today's sounds-on nor
  sounds-off caption is anywhere in the groove box.
- **AC6** (R6) — Given a fresh card with tap sounds on, then the hint box's
  coaching line is the new sentence; given tap sounds off, then it is the same
  sentence without the tap clause. Given one miss, then rung two is unchanged.
- **AC7** (R8) — Given the page rendered, then the two credit links are inside
  the groove card, after the play control, with today's hrefs, `target` and
  `rel`; given the how-to-play box open, then it contains no link.
- **AC8** (R9) — Given the snippets test and the language guard run, then they
  pass with the new keys.

## Dependencies

- Independent of Epics 1 and 3. Shares `src/lib/snippets/en/coaching.ts` and
  `snippets/types.ts` with Epic 3, and `components/GroovePuzzle.tsx` with Epic
  1 if the hook's wiring changes; `/writespec` sequences those.
- Existing tests that move with their subject: the credit assertions in
  `HowToPlay.test.tsx` go to `GrooveCard.test.tsx`; the caption assertions in
  `GroovePuzzle.sounding.test.tsx` become hint-box assertions.

## Assumptions

- Both descriptions are capitalised as sentence fragments under the label; the
  how-to-play line uses the same words as the on-side so the two read as one
  idea.
- "Four modes" is the count the full row shows today. If `flavourOptions` ever
  offers a different number, the description follows it — the string is the
  place to change, not a rule.
- The description follows the state rather than describing what flipping does,
  because a switch whose text says what you have is readable at a glance without
  reasoning about the flip.
- The credit goes below the play control, at the bottom of the card, as the
  briefing says; nothing above it moves.
- The how-to-play line is static. A state-aware line would be wrong for the
  veteran who opens the box in full mode, and `HowToPlay` knows nothing about
  the session today.

## Question log

### Cycle 1 — 2026-09-03

**Q1. What does the switch say when it is off?**
Answer: **A) "Twelve roots, four modes"** — it is what the full row shows; a
count the player can verify beats a claim about the whole vocabulary.
Applied to: R2, AC2, Assumptions
