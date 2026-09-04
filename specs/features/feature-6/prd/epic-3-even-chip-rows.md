# PRD — Epic 3: Chip rows read as even rows

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Every row of chips on the page spreads across its container instead of bunching
to the left with dead space on the right: the twelve root chips, the four
flavour chips, and the solved panel's "The changes" and "Notes to live in"
columns. The rows become CSS grids with an item-count-appropriate column count
rather than wrapping flex rows, so their columns stay equal at every width
instead of leaving a stretched last row. The one row whose two values differ
wildly in length — the chord and its progression — sizes its columns to content
instead.

## Problem

The briefing asks for `space-between` on the root and flavour rows "so that the
options sit centered evenly", and for the same on the solved panel's two
columns. Applied literally, `justify-between` on a wrapping flex row produces
the two failures it is meant to fix: twelve root chips wrap at narrow widths and
the final partial row stretches across the full card, and "The changes" holds
exactly two chips — one a short symbol like `C7`, the other a full progression
like `C7–Em7♭5–B♭maj7–Fmaj7` — which `justify-between` pins to opposite edges
with a gulf between them. A grid with a fixed column count delivers what the
briefing actually asks for in both cases.

## Scope

- `ChipGroup` lays its chips out on a grid instead of a wrapping flex row.
- `SolvedPanel`'s two `LabelledColumn`s get the same treatment through their own
  local `ValueChips` row.
- Remove `Chip`'s `width` prop, which the grid cell now subsumes.

**Out of scope**
- **The chip's own visual design** — size, radius, selected and inverted
  treatments are unchanged. Only the distribution of the row changes.
- **The panel's two-column layout.** `PanelColumns`, `LabelledColumn` and the
  labels are untouched.
- **Hoisting a shared `ChipRow` primitive.** `ChipGroup` and `ValueChips` stay
  two components; the panel's row is read-only and inverted, and merging them
  would mean a `ChipGroup` carrying a tone and a read-only mode — more surface
  than the duplication costs.
- **Which options appear.** The roots list, the four daily flavours and the
  panel's values are all decided elsewhere.

## Requirements

- **R1** — A chip row distributes its chips across the full width of its
  container, with even spacing, at every viewport width.
- **R2** — No row is ever stretched to fill width it does not have. A grid's
  columns are equal by construction and a trailing partial row simply leaves
  empty cells — which is the failure `justify-between` produces and this epic
  exists to avoid.
- **R2a** — Column counts are chosen per row from that row's item count, not
  shared across rows. The root row uses 4 columns, rising to 6 at wider
  viewports; the flavour row 2 rising to 4; the scale-notes row 4 rising to 7.
- **R3** — A chip fills its grid cell rather than hugging its label, which is
  what makes the row even.
- **R3a** — The "The changes" row is the exception: its columns are sized to
  their content, so a four-chord progression takes the room it needs and the
  chord symbol beside it stays compact.
  - *Retired by feature-11 Epic 1.* The two chips this rule governed are gone:
    the changes are drawn as a four-bar lead sheet, whose bars are equal columns
    by convention — 1 × 4, or 2 × 2 on a phone. The rule stands for what it
    described; its subject no longer exists. See
    [feature-11 Epic 1 R5](../../feature-11/prd/epic-1-the-changes-as-a-lead-sheet.md).
- **R4** — The root group (12 items) and the flavour group (4 items) are laid
  out by the same component and change together.
- **R5** — The solved panel's two rows are laid out deliberately on the inverted
  surface, with their chips still read-only. "Notes to live in" (7 items) uses
  equal columns like the guess rows; "The changes" (2 items) uses content-sized
  columns per R3a. They do not share a layout, because their shapes do not.
- **R6** — `Chip` no longer takes a `width` prop, and neither do `ChipGroup` or
  the solved panel's local row. The 60px fixed width it applied is subsumed by
  the grid cell, and a prop that no longer changes anything is removed rather
  than left in place.
- **R7** — Chips remain reachable and operable by keyboard in DOM order, and the
  root and flavour groups keep their `radiogroup` semantics and labels.
- **R8** — A long label does not overflow its cell or force the row wider than
  its container.

## Behaviour details

**The four rows and their item counts.** Each has a different shape, and the
column counts have to suit all four through one rule:

| Row | Items | Natural label width |
| :-- | :-- | :-- |
| Root | 12 | Uniform and short (`C`, `E♭`, `F♯`) |
| Flavour | 4 | Varies (`Dorian`, `harmonic minor`) |
| The changes | 2 | Wildly uneven (`C7` vs a four-chord progression) |
| Notes to live in | 7 | Uniform and short |

The counts that follow from those shapes:

| Row | Base | Wide | Result |
| :-- | :-- | :-- | :-- |
| Root | 4 | 6 | 3 rows, then 2 — both full |
| Flavour | 2 | 4 | 2 rows, then 1 — both full |
| Notes to live in | 4 | 7 | 4 + 3, then 1 row of 7 |
| The changes | content-sized | content-sized | 1 row |

Seven is prime, so the notes row cannot divide evenly below seven columns. At
the base width its last row holds three chips in equal columns with four cells
empty — left-aligned and plainly a grid, not the stretched row `justify-between`
would give. That is the one place the even-division rule bends, and it bends the
harmless way.

**Why "The changes" is different.** Two chips in equal columns means `C7` is
given exactly as much of the panel as `C7–Em7♭5–B♭maj7–Fmaj7` — half each,
which is a great deal of empty chip around a two-character label. Content-sized
columns let each value take the room it actually needs, which is what reads as
even here even though the columns are not equal.

**What replaces `width="fixed"`.** `Chip`'s `fixed` width is a hard `w-[60px]`
that exists so the twelve roots line up in a grid-like row. Once the row *is* a
grid, the cell sets the width and the prop is doing the same job twice — with a
60px cap that a wider cell would fight. It goes, from `Chip`, from `ChipGroup`,
and from the solved panel's row.

## Acceptance criteria

- **AC1** (R1, R3) — Given a chip group, when it renders, then its container is
  a grid whose chips each fill their cell.
- **AC2** (R2a) — Given a 12-item group, when it renders, then it uses 4 columns
  at the base width and 6 at the wide one, leaving no partial row at either.
- **AC3** (R2a) — Given a 4-item group, when it renders, then it uses 2 columns
  at the base width and 4 at the wide one, leaving no partial row at either.
- **AC3a** (R2) — Given the 7-item notes row at the base width, when it renders,
  then its last row holds three chips in columns the same width as the first
  row's, not three chips stretched across the panel.
- **AC4** (R4) — Given the guess card, when it renders, then the root row and
  the flavour row use the same layout component.
- **AC5** (R5) — Given a solved day, when the panel renders, then every chip in
  both labelled columns is disabled, and each column is laid out by the rule R5
  sets for it — the notes row per AC6a, the changes row per AC6. The two rows do
  not share a layout, and neither is stretched with `justify-between`.
- **AC6** (R3a, R5) — Given "The changes" with a short chord and a long
  progression, when the panel renders, then each chip is sized to its own
  content and the two are not separated by a gulf of empty space.
- **AC6a** (R5) — Given the notes row, when it renders, then its chips sit in
  equal columns.
- **AC7** (R6) — Given `Chip`, `ChipGroup` and the solved panel's row, when
  their props are inspected, then none takes a width.
- **AC8** (R7) — Given the root group, when a user tabs through it, then chips
  receive focus in the order they are listed, and the group is still exposed as
  a labelled `radiogroup`.
- **AC9** (R8) — Given the longest flavour label in the catalogue, when the row
  renders at the narrowest supported width, then the container does not scroll
  horizontally.

## Dependencies

None. `ChipGroup`, `Chip` and `SolvedPanel` are touched by no other epic in this
feature, so this runs alongside Epics 1 and 4 with no shared files.

Per `docs/testing.md`, `ChipGroup` and `Chip` are tested against their own
contract in the design system, independently of the puzzle; `SolvedPanel` is
tested inside the feature.

## Assumptions

- The breakpoints are Tailwind's defaults, as the rest of the app already uses
  (`sm`, `md`, `lg`).
- The existing gap between chips (`gap-[7px]` in the group, `gap-2` in the
  panel) carries over unless the grid makes it visibly wrong.
- The column counts step at one breakpoint, not two. The guess card is roughly
  half the page above `md` and full width below it, so a single step matches the
  layout change the page already makes.
- The scale-notes row's trailing partial row at the base width is accepted
  rather than worked around. Seven cannot divide evenly into fewer than seven
  columns, and a left-aligned short row is not the defect this epic set out to
  fix.
- `EyebrowLabel` and the group's label placement above the row are unchanged.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only: never rewrite or prune
a past cycle, or the record stops being trustworthy.

### Cycle 1 — 2026-08-30

**Q1. What column counts do the rows use?**
Answer: **A) Per-row counts chosen to divide evenly: roots `4 → 6`, flavours
`2 → 4`, notes `4 → 7`** — the only option that serves a 12-, 4- and 7-item row
at once, and the count is something the caller already knows. The changes row is
governed by Q3 instead.
Applied to: R2a, AC2, AC3, AC3a, Behaviour details, Assumptions

**Q2. What happens to `Chip`'s `width` prop?**
Answer: **A) Remove `width` from `Chip` and `ChipGroup` entirely; the cell owns
the width** — a prop that no longer changes anything is the leftover this
feature exists to clear.
Applied to: Scope, R6, AC7, Behaviour details

**Q3. Do "The changes" chips get equal columns, or columns sized to content?**
Answer: **B) Columns sized to content, so the progression takes the room it
needs and the chord chip stays compact** — equal columns would give a
two-character chord half the panel.
Applied to: Summary, R3a, R5, AC6, AC6a, Behaviour details
