# Tech spec — Epic 3: Chip rows read as even rows

PRD: [../prd/epic-3-even-chip-rows.md](../prd/epic-3-even-chip-rows.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

`ChipGroup` swaps `flex flex-wrap` for a CSS grid whose column count comes from
a prop, and `Chip` loses the 60px `width` the grid cell now sets. The solved
panel's two rows follow the same rule through its own local `ValueChips`, which
stays a separate component.

One thing falls out of the design and is worth stating before the steps: the
"The changes" row wants content-sized columns, and a gapped flex row of two
items *is* content-sized columns. So that row keeps its current flex layout and
its step is the removal of `width`, not a conversion. Only the three equal-column
rows become grids.

The other constraint that shapes the code is Tailwind's: `grid-cols-${n}` cannot
be built at runtime, because the JIT compiler only sees literal class strings.
The column count therefore maps through a lookup table of literal class pairs
rather than being interpolated.

## Architecture

Three rows become grids, one stays flex:

| Row | Component | Layout | Base | Wide |
| :-- | :-- | :-- | :-- | :-- |
| Root (12) | `ChipGroup` | grid | 4 cols | 6 cols |
| Flavour (4) | `ChipGroup` | grid | 2 cols | 4 cols |
| Notes to live in (7) | `ValueChips` | grid | 4 cols | 7 cols |
| The changes (2) | `ValueChips` | flex, gapped | — | — |

`ChipGroup` gains a `columns` prop. It carries numbers, not row names: a
`ChipGroup` that knew about roots and flavours would be a primitive that has
learned a domain concept, which `docs/architecture.md` forbids. `GuessCard`
supplies the counts, because the caller is what knows how many options it has.

`Chip` loses `width` entirely. Inside a grid cell the chip stretches to the cell;
inside the flex row it hugs its label, which is what `width="auto"` did.

## Contracts

Frozen before the tracks start.

```ts
// src/components/controls/Chip.tsx
type ChipProps = {
  label: string
  selected: boolean
  disabled: boolean
  onSelect: () => void
  tone?: 'default' | 'inverted'
}
// `width` and the `ChipWidth` type are removed.
```

```ts
// src/components/controls/ChipGroup.tsx
/** Columns at the base width, and above the `md` breakpoint. */
export type ChipColumns = { base: 2 | 4; wide: 4 | 6 | 7 }

type ChipGroupProps = {
  label: string
  options: string[]
  value: string | null
  onSelect: (option: string) => void
  disabled: boolean
  name: string
  columns: ChipColumns
}
// `width` is removed.
```

```ts
// The literal-class lookup, colocated with ChipGroup.
const COLUMN_CLASS: Record<number, string> = {
  2: 'grid-cols-2', 4: 'grid-cols-4', 6: 'grid-cols-6', 7: 'grid-cols-7',
}
const WIDE_CLASS: Record<number, string> = {
  4: 'md:grid-cols-4', 6: 'md:grid-cols-6', 7: 'md:grid-cols-7',
}
```

## Tracks

### Track A — The design system's chip row

- **Goal** — `Chip` has no `width`; `ChipGroup` renders a grid at
  caller-supplied column counts.
- **Owns** — `src/components/controls/Chip.{tsx,test.tsx}`,
  `src/components/controls/ChipGroup.{tsx,test.tsx}`
- **Depends on** — nothing.
- **Parallel with** — Track B, Track C.
- **Done when** — its own tests pass, per `docs/testing.md`, without the feature
  being touched.

### Track B — The solved panel's two rows

- **Goal** — the notes row is a grid, the changes row is content-sized, and
  neither passes a width.
- **Owns** —
  `src/features/daily-groove/components/puzzle/SolvedPanel.{tsx,test.tsx}`
- **Depends on** — the `ChipProps` contract only. It renders `Chip` directly.
- **Parallel with** — Track A, Track C.
- **Done when** — its own tests pass.

### Track C — The guess card supplies the counts

- **Goal** — `GuessCard` passes `columns` for both groups and no `width`.
- **Owns** —
  `src/features/daily-groove/components/puzzle/GuessCard.{tsx,test.tsx}`
- **Depends on** — the `ChipGroupProps` contract only.
- **Parallel with** — Track A, Track B.
- **Done when** — its own tests pass against the contract.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C — three disjoint file sets,
  all building against the two frozen contracts.
- **Wave 2:** Integration.

## Implementation

### Track A — The design system's chip row

#### Step A1 — `Chip` no longer takes a width

Covers: R6, AC7

- **Test first** — `src/components/controls/Chip.test.tsx`: delete the two cases
  that pass `width`, and add one asserting a rendered chip's class list contains
  neither `w-[60px]` nor `px-0`. Run it: fails — the default `auto` still emits
  `px-[15px]` and `fixed` is still reachable.
- **Implement** — `Chip.tsx`: remove `width`, `ChipWidth` and the `WIDTH`
  record; fold `px-[15px]` into `BASE`.
- **Green when** — the assertion passes and the rest of `Chip.test.tsx` is
  green.
- **Refactor** — none.

#### Step A2 — `ChipGroup` renders a grid at the base column count

Covers: R1, R2a, R3, AC1

- **Test first** — `src/components/controls/ChipGroup.test.tsx`: render a
  12-option group with `columns={{ base: 4, wide: 6 }}` and assert the element
  with `data-testid="chip-list"` has classes `grid` and `grid-cols-4` and not
  `flex-wrap`. Run it: fails — the list is `flex flex-wrap`.
- **Implement** — `ChipGroup.tsx`: add the `columns` prop and `COLUMN_CLASS`
  lookup; render `grid ${COLUMN_CLASS[columns.base]} gap-[7px]`.
- **Green when** — the class assertion passes.
- **Refactor** — none.

#### Step A3 — The column count rises above the breakpoint

Covers: R2a, AC2, AC3

- **Test first** — `ChipGroup.test.tsx`: two cases — a 12-option group with
  `{ base: 4, wide: 6 }` has `grid-cols-4` and `md:grid-cols-6`; a 4-option
  group with `{ base: 2, wide: 4 }` has `grid-cols-2` and `md:grid-cols-4`. Run
  them: fail, no responsive class is emitted.
- **Implement** — `ChipGroup.tsx`: add `WIDE_CLASS` and append
  `WIDE_CLASS[columns.wide]`.
- **Green when** — both cases pass.
- **Refactor** — none.

#### Step A4 — No group leaves a partial row

Covers: R2, R2a, AC2, AC3

- **Test first** — `ChipGroup.test.tsx`: a table-driven case asserting that for
  `{ options: 12, columns: { base: 4, wide: 6 } }` and
  `{ options: 4, columns: { base: 2, wide: 4 } }`, the option count divides
  exactly by both `base` and `wide`. Run it: passes after A3 — keep it as the
  guard the PRD's R2a asks for, so a future column change cannot silently
  introduce an orphan row.
- **Implement** — none.
- **Green when** — both rows of the table pass.
- **Refactor** — none.

#### Step A5 — `ChipGroup` keeps its group semantics and tab order

Covers: R7, AC8

- **Test first** — `ChipGroup.test.tsx`: keep the existing `radiogroup` and
  label cases unchanged, and add one asserting the rendered chips appear in the
  order given. Run it: passes — a grid does not reorder DOM children. Keep it as
  the regression guard for R7.
- **Implement** — none.
- **Green when** — all three pass.
- **Refactor** — none.

### Track B — The solved panel's two rows

#### Step B1 — `ValueChips` no longer passes a width

Covers: R6, AC7

- **Test first** — `src/features/daily-groove/components/puzzle/SolvedPanel.test.tsx`:
  assert the panel renders without a `width` prop reaching `Chip` — concretely,
  that no rendered chip carries `w-[60px]`. Run it: fails, the notes row does.
- **Implement** — `SolvedPanel.tsx`: remove the `width` prop from `ValueChips`
  and from both call sites.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step B2 — The notes row is a grid of equal columns

Covers: R5, AC5, AC6a

- **Test first** — `SolvedPanel.test.tsx`: solve a day and assert the
  "Notes to live in" column's chip container has `grid`, `grid-cols-4` and
  `md:grid-cols-7`, and that every chip inside it is disabled. Run it: fails,
  the container is `flex flex-wrap`.
- **Implement** — `SolvedPanel.tsx`: give `ValueChips` a `layout: 'grid' | 'row'`
  prop; `grid` renders `grid grid-cols-4 md:grid-cols-7 gap-2`. Pass `grid` for
  the notes.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step B3 — The changes row sizes its columns to content

Covers: R3a, R5, AC6

- **Test first** — `SolvedPanel.test.tsx`: assert the "The changes" column's
  chip container is *not* a grid — it has `flex` and no `grid-cols-2` — and that
  it renders exactly the chord and the progression as two chips. Run it: fails
  if B2 converted both rows.
- **Implement** — `SolvedPanel.tsx`: pass `layout="row"` for the changes,
  keeping `flex flex-wrap gap-2`. A gapped flex row of two items is
  content-sized columns; converting it to a grid is what would produce the gulf
  the PRD rejects.
- **Green when** — both assertions pass.
- **Refactor** — document in `ValueChips`' comment why the two rows differ.

#### Step B4 — A long progression does not overflow the panel

Covers: R8, AC9

- **Test first** — `SolvedPanel.test.tsx`: render with the catalogue's longest
  progression and assert the changes container carries `flex-wrap` so a chip too
  wide for the row moves down rather than widening it. Run it: passes after B3 —
  keep it as the R8 guard.
- **Implement** — none.
- **Green when** — the assertion passes.
- **Refactor** — none.

### Track C — The guess card supplies the counts

#### Step C1 — Both groups get their column counts

Covers: R2a, R4, AC4

- **Test first** — `src/features/daily-groove/components/puzzle/GuessCard.test.tsx`:
  render with twelve roots and four flavours and assert the root group's chip
  list has `grid-cols-4` and `md:grid-cols-6`, and the flavour group's has
  `grid-cols-2` and `md:grid-cols-4`. Run it: fails — `GuessCard` passes
  `width="fixed"` and no `columns`.
- **Implement** — `GuessCard.tsx`: replace `width="fixed"` on the root group
  with `columns={{ base: 4, wide: 6 }}`, and add
  `columns={{ base: 2, wide: 4 }}` to the flavour group.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step C2 — Both rows still go through one component

Covers: R4, AC4

- **Test first** — `GuessCard.test.tsx`: assert both chip lists carry the same
  layout classes shape — both `grid`, both with a `md:` override. Run it: passes
  after C1; keep it as the guard that the two rows cannot drift apart.
- **Implement** — none.
- **Green when** — the assertion passes.
- **Refactor** — none.

## Integration and verification

#### Step I1 — The composed page renders even rows

Covers: R1, R4, R5

- **Test first** — `src/features/daily-groove/components/GroovePuzzle.test.tsx`:
  keep `offers all twelve roots every day` and
  `opens the solved panel with the answer, the tries and the changes` unchanged;
  they must pass without edits. Run them: they fail only if a track changed
  behaviour rather than layout.
- **Implement** — none.
- **Green when** — both pass untouched, proving the change was layout only.
- **Refactor** — none.

#### Step I2 — Clean suite, lint and build

Covers: all

- **Green when** — `npm test`, `npm run lint` and `npm run build` are clean, and
  no module references `ChipWidth`.

#### Step I3 — The demo path

Covers: R1, R2, R3a, R8

Run `npm run dev` at desktop width: the root row, the flavour row and both
solved-panel columns each span their container evenly. Narrow the window past
`md`: the column counts drop and every row stays full, with no stretched orphan.
Solve a day and confirm the two "The changes" chips sit next to each other
rather than at opposite edges, and that the notes row's last three chips sit in
columns the same width as the first row's.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A2, I1, I3 |
| R2 | A4, I3 |
| R2a | A3, A4, C1 |
| R3 | A2 |
| R3a | B3, I3 |
| R4 | C1, C2, I1 |
| R5 | B2, B3, I1 |
| R6 | A1, B1 |
| R7 | A5 |
| R8 | B4, I3 |
| AC1 | A2 |
| AC2 | A3, A4 |
| AC3 | A3, A4 |
| AC3a | B2, I3 |
| AC4 | C1, C2 |
| AC5 | B2, B3 |
| AC6 | B3 |
| AC6a | B2 |
| AC7 | A1, B1 |
| AC8 | A5 |
| AC9 | B4 |

## Assumptions

- The breakpoint is `md`, matching where `GroovePuzzle`'s two columns already
  split, so the chip rows narrow at the same moment the card does.
- The existing gaps carry over: `gap-[7px]` in `ChipGroup`, `gap-2` in the
  panel.
- `ChipColumns` is typed as a union of the counts actually in use rather than
  `number`, so a count with no literal class in the lookup is a type error
  rather than a silently missing class.
- The notes row's trailing partial row at the base width — 4 then 3 — is
  accepted, per the PRD. Seven cannot divide evenly into fewer than seven
  columns.

## Decision log

Settled architectural decisions. The sections above are the source of truth —
this records how they got there, and what each one cost. Append-only: never
rewrite or prune a past cycle.

### Cycle 1 — 2026-08-30

**Q1. How is the column count expressed on `ChipGroup`?**
Decision: **A) `columns={{ base, wide }}`, a typed pair mapped through a literal
class lookup** — Tailwind's JIT only sees literal class strings, so a lookup is
required whatever the prop shape, and naming both counts is what makes R2a's
"no partial row at either breakpoint" assertable in Step A4.
Changed: nothing. The `ChipColumns` contract and Steps A2, A3 and C1 were
written against this shape.

**Q2. Does the grid live on `ChipGroup`, or in a layout primitive both rows use?**
Decision: **A) Each component owns its own grid classes** — the two rows need
different column counts and different gaps, and the shared part is three
Tailwind classes; a primitive wrapping that would be indirection without
abstraction, and it is what keeps Tracks A and B genuinely disjoint.
Changed: nothing. No `src/components/layout/Grid.tsx` is created, and the track
ownership stands as written.
