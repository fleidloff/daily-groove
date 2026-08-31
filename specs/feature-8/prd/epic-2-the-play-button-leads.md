# PRD — Epic 2: The play button leads

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

The play control becomes the largest control on the page, so the first thing to
do is the first thing you see. `Button` gains a generic `size` prop; the play
control takes the large size and the check button keeps today's. The streak
stays where it is at the top right and is re-aligned so it sits level with a
title block that is about to grow a second line.

## Problem

Feature-4 made the play button exactly as big as the solve button, on purpose,
and `PlayControl`'s doc comment still argues the case: "there is one page and one
loop, so there is one form." Parity was the right fix for a play control that
was too small; it is the wrong end state for a first-time visitor, who is shown
two identical buttons and no indication which one comes first. The answer to
"what do I do here?" is *press play* — and nothing on the page says so.

The streak is the briefing's other prominence note. It is already at the
right-hand end of the header row, which is already the top right of the page, so
nothing moves; but Epic 1 makes the block it is aligned against two lines tall,
and a badge pinned to the top of a taller neighbour reads as stranded.

## Scope

- `components/controls/Button.tsx` gains a `size` prop with two values.
- `components/controls/PlayControl.tsx` requests the large size.
- `PlayControl`'s doc comment is rewritten, since it currently argues for the
  parity this epic removes.
- `components/header/GrooveHeader.tsx`: the header `Row`'s `align` changes from
  `start` to `center`.

**Out of scope**
- **Changing `Row`.** The stacked-case anchoring is done per child in the header,
  because which side a child should take when the axis turns vertical is the
  header's business, not the primitive's. `Row` gains no prop and no breakpoint
  logic — the other two collapsing rows in the app pass `align="start"` and
  `align="baseline"` and are unaffected.
- **Moving the streak anywhere.** "Top right of the page" is already where it
  is. It is not raised above the title, not lifted into the page shell, and not
  pinned to the viewport — it scrolls with the page like everything else.
- **What the streak says.** `StreakBadge`'s wording and its "No streak yet"
  empty state are untouched.
- **The check button's size.** It keeps the default geometry. The contrast is
  the point, so only one side of it moves.
- **The caption under the play button** ("Play along. Find the note that feels
  like home.") and the transport's loop visualisation. This is a size change,
  not a redesign of the card.
- **The give-up button**, which also renders `Button`. It keeps the default and
  is not touched.
- **A new design-system component.** `size` is a prop, so the component list in
  `components/structure.test.ts` is unchanged.
- **The title and subtitle** — Epic 1 owns everything inside the header's left
  `Stack`.

## Requirements

- **R1** — `Button` accepts a size. The default is today's geometry, so every
  existing call site renders exactly as it does now.
- **R2** — The default size keeps today's geometry: `py-[15px]` at `text-[15px]`.
  The large size is about half again as tall — `py-[22px]` at `text-[17px]`. Its
  corner radius, colour tones, focus ring and disabled behaviour are the
  default's, unchanged.
- **R3** — The size is a generic property of the button. It names no groove, no
  playback and no domain concept, and `Button` remains driveable entirely from
  props with no app state.
- **R4** — The play control renders at the large size.
- **R5** — The check control in the guess card renders at the default size.
- **R6** — The play control keeps its three states — play, stop, loading — at
  the new size, with the same glyph-and-word pairing and the same accessible
  names: the action the press will perform, except while busy, where the name
  reports the wait.
- **R7** — The play control stays full-width within its column, growing in
  height and type rather than becoming a differently-shaped control.
- **R8** — The streak badge remains at the right-hand end of the header,
  opposite the title block, inside the feature.
- **R9** — The header row aligns its two sides on their centres, so the badge
  sits level with the middle of the title block however many lines that block
  has.
- **R10** — Below the header's collapse breakpoint the badge continues to stack
  under the title block, as it does today.
- **R10a** — The streak stays at the right at every width. In the stacked case it
  sits at the end of its own line, never centred, and the title block stays at the
  left. The row's centre alignment applies only once the header is actually a row.
- **R11** — Nothing about playback changes. What the button does, how long it
  takes and what it sounds like are untouched.

## Behaviour details

The large size is a half-again bump, not a slab: at `py-[22px]` and `text-[17px]`
against the default's `py-[15px]` and `text-[15px]`, the play control is clearly
the dominant control while both buttons stay legible side by side on a phone, and
the guess card is not pushed further down the page than it already is.

`PlayControl` renders `Button` and will continue to. The two controls stop
sharing a size, not a form: same shape, same tones, same focus treatment, one
larger than the other. This is a deliberate reversal of feature-4's parity
decision, and the doc comment recording that decision is corrected rather than
left to contradict the code.

`Row` already supports `align="center"`, so R9 is a one-prop change with no
design-system work behind it. R9 is correct whether or not Epic 1 has landed,
but it only *looks* like the answer once the subtitle's second line exists —
worth knowing when this epic is reviewed on its own.

## Acceptance criteria

- **AC1** (R1) — Given a `Button` rendered without a size, when its classes are
  inspected, then they are the ones it renders today.
- **AC2** (R2) — Given a `Button` at the large size, when its classes are
  inspected, then they carry `py-[22px]` and `text-[17px]`; and when it is
  compared with the default, then its radius, tone classes and focus classes are
  identical.
- **AC3** (R2) — Given a disabled `Button` at the large size, when it renders,
  then it is disabled and carries the same disabled treatment as the default.
- **AC4** (R4, R5) — Given the whole puzzle, when it renders, then the play
  control is at the large size and the check control is not.
- **AC5** (R6) — Given the play control at the large size, when it is idle,
  playing, and busy in turn, then its accessible names are "Play the groove"'s
  action name, "Stop the loop", and the loading name, and each state shows its
  own glyph and word.
- **AC6** (R6) — Given the play control while busy, when it is pressed, then
  nothing is toggled, as today.
- **AC7** (R8) — Given the header, when it renders, then the streak badge is
  present and follows the title block in the row.
- **AC8** (R9) — Given the header, when the row is inspected, then it aligns on
  centres rather than on tops.
- **AC9** (R10) — Given a viewport below the collapse breakpoint, when the
  header renders, then the badge is stacked beneath the title block.
- **AC9a** (R10a) — Given the header, when the streak badge's anchor is
  inspected, then it aligns itself to the end of the cross axis while stacked and
  defers to the row above the breakpoint; and the title block's anchor aligns
  itself to the start.
- **AC10** (R3) — Given the design system's source, when it is inspected, then
  `Button` names no domain concept and the component list in
  `components/structure.test.ts` is unchanged.

## Dependencies

None to start. It shares `GrooveHeader.tsx` with Epic 1 under a contract: **Epic
1 owns what the title block says** — the `<h1>` and the subtitle inside the left
`Stack` — and **this epic owns the enclosing `Row`'s alignment**, touching
nothing inside that `Stack`. One prop each, on adjacent elements.

It hands forward a `Button` with a size, which any later epic may use.

Per `docs/testing.md`, `Button` and `PlayControl` are design-system components
and are tested against their own contract — props, states, accessibility —
independently of the feature.

## Assumptions

- Two sizes are enough. A third would be a size nothing asks for.
- The large size changes vertical padding and text size only — the two values in
  R2. Width is already full-bleed within the column and stays that way.
- Neither size is set in the display face. The masthead's voice stays the
  masthead's.
- The glyphs (`▶`, `■`, `◌`) scale with the label's type rather than being
  separately sized.
- The default size applies at every breakpoint; the large size does too. Neither
  is responsive beyond what the surrounding layout already does.
- The streak badge's own size is unchanged. Only the row's alignment moves.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only: never rewrite or prune
a past cycle, or the record stops being trustworthy.

### Cycle 1 — 2026-08-31

**Q1. How much bigger is the large size?**
Answer: **A) About half again as tall — `py-[22px]` at `text-[17px]`** — the
dominant control without becoming a slab, and both buttons stay legible side by
side on a phone.
Applied to: R2, AC2, Behaviour details, Assumptions
