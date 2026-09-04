# Tech spec — Epic 1: A design system you can navigate

PRD: [../prd/epic-1-design-system.md](../prd/epic-1-design-system.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

A rename, executed as one atomic change plus one genuinely independent
documentation track. The 19 components move into five role folders, their
intra-system imports switch to the alias where they cross a group, and the ten
consumer files follow. What makes this more than `git mv` is the guard: three of
the PRD's acceptance criteria are structural claims about the tree — no barrels,
no ungrouped import paths, no relative import climbing out of a folder — and
this repo already tests source text that way (`src/app/page.test.tsx` asserts
`page.tsx` holds no layout classes; `scripts/grooves/verify-cli.test.ts` reads
its own source to assert its dependency list). So each structural rule gets a
real failing test first, and the move makes it pass.

## Architecture

`src/components/` becomes five role folders plus `tokens.ts`:

```
src/components/
├── layout/      Container, PageShell, Row, Stack, LabelledColumn
├── surfaces/    Card, MiniCard, Panel
├── controls/    Button, IconButton, Chip, ChipGroup, PlayControl
├── typography/  Heading, Text, EyebrowLabel, SectionLabel
├── display/     Pill, ProgressTrack
└── tokens.ts
```

Each component keeps its filename and its colocated `.test.tsx`. The groups are
navigational, not import boundaries: a component may import any other component
and `tokens.ts` regardless of group. The one boundary that is real —
`src/components/` may not import `src/features/` — is enforced in Epic 4.

Import style follows the folder: relative inside a group, aliased across one, so
a crossing always reads as a crossing and no specifier ever begins with `../`.

## Contracts

The path table every track builds against. Frozen — Track B rewrites consumers
against these paths while Track A creates them.

```ts
'@/components/layout/Container'      '@/components/controls/Button'
'@/components/layout/PageShell'      '@/components/controls/IconButton'
'@/components/layout/Row'            '@/components/controls/Chip'
'@/components/layout/Stack'          '@/components/controls/ChipGroup'
'@/components/layout/LabelledColumn' '@/components/controls/PlayControl'

'@/components/surfaces/Card'         '@/components/typography/Heading'
'@/components/surfaces/MiniCard'     '@/components/typography/Text'
'@/components/surfaces/Panel'        '@/components/typography/EyebrowLabel'
                                     '@/components/typography/SectionLabel'
'@/components/display/Pill'
'@/components/display/ProgressTrack'  '@/components/tokens'   // unmoved
```

The three intra-system imports that cross a group after the move:

```ts
// src/components/controls/ChipGroup.tsx
import { Chip } from './Chip'                                   // same group
import { EyebrowLabel } from '@/components/typography/EyebrowLabel'
// src/components/typography/SectionLabel.tsx
import { EyebrowLabel } from './EyebrowLabel'                   // same group
// src/components/controls/PlayControl.tsx
import { IconButton } from './IconButton'                       // same group
// src/components/layout/Row.tsx, Stack.tsx
import type { Space } from '@/components/tokens'
```

## Tracks

### Track A — The move and the design system's own imports

- **Goal** — the five folders exist, all 39 files sit in them, and every import
  inside `src/components/` follows the contract.
- **Owns** — `src/components/**`
- **Depends on** — the path table only
- **Parallel with** — Track C
- **Done when** — the design-system tests pass and the structural tests of
  Steps A1–A3 are green.

### Track B — The consumers

- **Goal** — the ten files outside `src/components/` that import from it use the
  grouped paths.
- **Owns** — `src/app/page.tsx`, `src/features/daily-groove/components/*.tsx`
  (9 files: ArchiveStrip, GrooveCard, GrooveHeader, GroovePuzzle, GuessCard,
  NudgeBox, SolvedPanel, StreakBadge, TransportPanel)
- **Depends on** — Track A, genuinely. A rename is atomic: these files cannot
  resolve until the targets exist.
- **Parallel with** — nothing.
- **Done when** — the full suite is green.

### Track C — The guidelines document

- **Goal** — `docs/coding-guidelines.md` exists with the five-heading skeleton
  and a filled design-system section.
- **Owns** — `docs/coding-guidelines.md`
- **Depends on** — nothing
- **Parallel with** — Track A and Track B, completely. It shares no file with
  either.
- **Done when** — the section is written and Step C2's checklist holds.

## Execution waves

- **Wave 1 (parallel):** Track A, Track C
- **Wave 2:** Track B — needs Track A's files to exist
- **Wave 3:** Integration

Only Track C is truly parallel. Tracks A and B are one atomic rename split into
ordered steps: between them the tree does not compile, so they land in a single
commit. A per-group split of the move was considered and rejected — each of the
ten consumer files imports from several groups, so splitting by group turns one
clean rename into ten merge conflicts.

## Implementation

### Track A — The move and the design system's own imports

#### Step A1 — A test that no barrel files exist

Covers: R3, AC2

- **Test first** — `src/components/structure.test.ts` (new): read
  `src/components/` recursively with `node:fs`; assert no entry is named
  `index.ts` or `index.tsx`. Run it: passes immediately — there are none today,
  and this step's job is to lock that in before the move can introduce one.
- **Implement** — nothing. This is the one structural test that starts green.
- **Green when** — it passes, and still passes after Steps A4–A8.
- **Refactor** — none.

#### Step A2 — A test that every component sits in a role folder

Covers: R1, R2, AC1

- **Test first** — `src/components/structure.test.ts`: assert
  `readdirSync('src/components', { withFileTypes: true })` yields exactly the
  directories `layout`, `surfaces`, `controls`, `typography`, `display` and
  exactly one file, `tokens.ts`. Then assert each of the 19 component files
  resolves at the path the contract gives it. Run it: fails with
  `expected [ 'Button.tsx', 'Button.test.tsx', … ] to equal [ 'tokens.ts' ]`.
- **Implement** — Steps A4–A8 make it pass; leave it red until then.
- **Green when** — after A8.
- **Refactor** — none.

#### Step A3 — A test that no import climbs out of its folder

Covers: R10, AC8

- **Test first** — `src/components/structure.test.ts`: read every `.ts`/`.tsx`
  under `src/components/`; assert no import specifier matches `/^\.\.\//`. Run
  it: passes today (nothing climbs yet) and must still pass after the move,
  which is the real assertion — `ChipGroup` reaching `EyebrowLabel` across
  groups must use the alias, not `../typography/EyebrowLabel`.
- **Implement** — nothing yet.
- **Green when** — it still passes after A8.
- **Refactor** — none.

#### Step A4 — Move `layout/`

Covers: R1, R5, R6

- **Test first** — `npm test -- src/components` after the move: fails with
  `Cannot find module './Container'` from the moved tests, or from `page.tsx`.
- **Implement** — `git mv` `Container`, `PageShell`, `Row`, `Stack`,
  `LabelledColumn` and their `.test.tsx` into `src/components/layout/`. In
  `Row.tsx` and `Stack.tsx` rewrite `import type { Space } from './tokens'` to
  `from '@/components/tokens'`. Fix each moved test's import of its own subject
  to `./<Name>`.
- **Green when** — the five moved test files pass. `page.tsx` is still red; that
  is Track B.
- **Refactor** — none. No component source changes beyond its import lines.

#### Step A5 — Move `surfaces/`

Covers: R1, R5, R6

- **Test first** — as A4: the moved tests fail to resolve their subject.
- **Implement** — `git mv` `Card`, `MiniCard`, `Panel` and their tests into
  `src/components/surfaces/`; fix each test's subject import.
- **Green when** — the three moved test files pass.
- **Refactor** — none.

#### Step A6 — Move `controls/`

Covers: R1, R5, R6, R9, R10, AC9

- **Test first** — as A4.
- **Implement** — `git mv` `Button`, `IconButton`, `Chip`, `ChipGroup`,
  `PlayControl` and their tests into `src/components/controls/`. In
  `ChipGroup.tsx` keep `import { Chip } from './Chip'` and rewrite
  `import { EyebrowLabel } from './EyebrowLabel'` to
  `from '@/components/typography/EyebrowLabel'`. In `PlayControl.tsx` keep
  `import { IconButton } from './IconButton'`.
- **Green when** — the five moved test files pass, `ChipGroup.test.tsx` included
  — proving a cross-group import resolves (AC9).
- **Refactor** — none.

#### Step A7 — Move `typography/`

Covers: R1, R5, R6

- **Test first** — as A4.
- **Implement** — `git mv` `Heading`, `Text`, `EyebrowLabel`, `SectionLabel` and
  their tests into `src/components/typography/`. `SectionLabel.tsx` keeps
  `import { EyebrowLabel } from './EyebrowLabel'` — same group, still relative.
- **Green when** — the four moved test files pass.
- **Refactor** — none.

#### Step A8 — Move `display/`

Covers: R1, R2, R5, R6, AC1

- **Test first** — Step A2's structural test, still red.
- **Implement** — `git mv` `Pill`, `ProgressTrack` and their tests into
  `src/components/display/`. Leave `tokens.ts` where it is.
- **Green when** — Step A2 goes green, and A1 and A3 are still green.
- **Refactor** — none.

### Track B — The consumers

#### Step B1 — A test that no consumer uses an ungrouped path

Covers: R4, AC3

- **Test first** — `src/components/structure.test.ts`: read every `.ts`/`.tsx`
  under `src/app/` and `src/features/`; assert no import specifier matches
  `/^@\/components\/[A-Z]/` — that is, `@/components/Button` with no group
  segment. Run it: fails listing all ten consumer files.
- **Implement** — Steps B2 and B3.
- **Green when** — after B3.
- **Refactor** — none.

#### Step B2 — Point the route at the grouped paths

Covers: R4, R5, AC3

- **Test first** — `npm test -- src/app/page.test.tsx`: fails with
  `Cannot find module '@/components/Container'`.
- **Implement** — `src/app/page.tsx`: rewrite the `Container` and `PageShell`
  imports to `@/components/layout/Container` and `@/components/layout/PageShell`.
- **Green when** — `page.test.tsx` passes, its "composes the page out of
  design-system primitives" assertion included.
- **Refactor** — none.

#### Step B3 — Point the feature components at the grouped paths

Covers: R4, R5, R6, AC3

- **Test first** — `npm test -- src/features`: fails with
  `Cannot find module '@/components/Stack'` and eight siblings.
- **Implement** — rewrite the `@/components/...` imports in all nine feature
  components against the contract table. `Stack` (7 uses) and `Row` (6) go to
  `layout/`, `Heading` (4) and `Text` (3) and `EyebrowLabel` (3) to
  `typography/`, `Card` (4) to `surfaces/`, and the rest one apiece.
- **Green when** — Step B1 goes green and the full suite is green at 1005 tests
  plus the structural tests added here.
- **Refactor** — none.

### Track C — The guidelines document

#### Step C1 — Create the document with the agreed skeleton

Covers: R7

- **Test first** — none; this is prose. The check is Step C2.
- **Implement** — `docs/coding-guidelines.md` with the five headings from the
  PRD's Dependencies section, in order, each empty except the first:
  `## The design system`, `## Feature slices`,
  `## Anti-patterns and their fixes`, `## Shared code (\`src/lib/\`)`,
  `## Enforcement`. Add a one-paragraph preamble saying the document is the
  concrete rulebook and `docs/architecture.md` holds the principles.
- **Green when** — the file exists with all five headings.
- **Refactor** — none.

#### Step C2 — Fill the design-system section

Covers: R7, R8, AC6

- **Test first** — none. The acceptance check is the checklist below, run by a
  reader.
- **Implement** — under `## The design system`, write: what each of the five
  groups holds and the one-line test for choosing between them; the
  generic-naming rule, motivated by the existing names (`Button`, `Card`,
  `ProgressTrack` — never `CheckoutButton`); the rule that nothing under
  `src/components/` imports from `src/features/`, marked *lint-enforced from
  Epic 4*; the import-style rule from R10, with the `ChipGroup` example; and the
  no-barrels rule, with the reason (a barrel lets one import pull in the whole
  design system). Tag each rule *lint-enforced* or *human-checked*.
- **Green when** — every rule names a file in this repo, and no rule is present
  that this repo did not motivate.
- **Refactor** — none.

## Integration and verification

- **Step I1** — Run `npm test`. Expect 1005 pre-existing tests plus the
  structure tests, all green (R5, R6, AC5).
- **Step I2** — Run `npm run lint` and `npm run build`. Both pass (AC5).
- **Step I3** — Audit the diff (AC4): every changed line under `src/` is an
  import statement or a file move. `git diff -M --stat` should show renames, and
  `git diff -M` should show no changed JSX, prop, class name or assertion. Any
  other change is a defect in this epic, not an improvement.
- **Step I4** — Demo path (AC7): `npm run dev`, play a full puzzle — guess,
  miss, guess, solve, reload. Identical to before.
- **Step I5** — Confirm the test count is unchanged apart from the structure
  tests added in A1–A3 and B1 (R6, AC5).

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A2, A4, A5, A6, A7, A8 |
| R2 | A2, A8 |
| R3 | A1 |
| R4 | B1, B2, B3 |
| R5 | A4–A8, B2, B3, I1, I3 |
| R6 | A4–A8, B3, I1, I5 |
| R7 | C1, C2 |
| R8 | C2 |
| R9 | A6 |
| R10 | A3, A4, A6 |
| AC1 | A2, A8 |
| AC2 | A1 |
| AC3 | B1, B2, B3 |
| AC4 | I3 |
| AC5 | I1, I2, I5 |
| AC6 | C2 |
| AC7 | I4 |
| AC8 | A3 |
| AC9 | A6 |

## Assumptions

- `src/components/structure.test.ts` is the home for all four structural tests.
  It sits in `src/components/` so it runs under the existing `app` vitest
  project, whose include glob is `src/**/*.{test,spec}.{ts,tsx}`. It reads the
  tree from disk rather than importing modules, so it costs no render time.
- The move uses `git mv` so history follows the files and `git diff -M` can
  prove Step I3's claim cheaply.
- Steps A4–A8 leave the tree non-compiling until B3. They are one commit.
- The structural tests deliberately outlive this epic: they are what stops the
  next feature adding a flat component, in the window before Epic 4's lint rules
  land.

## Decision log

No architectural decisions were required. The PRD settled the taxonomy, the
no-barrel rule, the cross-group import rule and the document's register in its
own cycle 1, and nothing in the implementation reopened them.
