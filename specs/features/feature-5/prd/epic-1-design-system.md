# PRD — Epic 1: A design system you can navigate

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

`src/components/` is 39 flat files with no grouping — every primitive, layout
box and composite sits at the same level. This epic sorts the 19 components into
five role folders, moves their tests with them, rewrites the import sites, and
writes the design-system rules into a new `docs/coding-guidelines.md`. Nothing
about any component's behaviour changes.

## Problem

A flat folder of 19 components gives a reader no way to tell a layout primitive
from a composite control, and gives a contributor no answer to "where does my new
component go?". The briefing asks for sub-folders so the overview is clearer;
this is the half of that request that concerns the design system.

## Scope

- Sort 19 components into five role folders, tests moving with them.
- Rewrite the 39 `@/components/...` import statements across the 10 files that
  use them, plus the 6 intra-system relative imports.
- Create `docs/coding-guidelines.md` with the agreed section skeleton and fill
  the design-system section.

**Out of scope**
- The lint rules that enforce these boundaries — Epic 4.
- Any change to a component's props, markup, styling or behaviour. This epic
  moves files and rewrites import lines.
- `src/features/daily-groove/components/` — Epic 2 owns the feature slice.
- Adding, splitting, merging or deleting components.

## Requirements

- **R1** — The 19 design-system components are grouped as follows, each with its
  colocated test:
  - `layout/` — `Container`, `PageShell`, `Row`, `Stack`, `LabelledColumn`
  - `surfaces/` — `Card`, `MiniCard`, `Panel`
  - `controls/` — `Button`, `IconButton`, `Chip`, `ChipGroup`, `PlayControl`
  - `typography/` — `Heading`, `Text`, `EyebrowLabel`, `SectionLabel`
  - `display/` — `Pill`, `ProgressTrack`
- **R2** — `tokens.ts` stays at `src/components/tokens.ts`. It is the system's
  shared vocabulary rather than a member of any one group.
- **R3** — There are no barrel files. An import names the file it wants:
  `@/components/controls/Button`. Nothing re-exports another module.
- **R4** — Every consumer outside `src/components/` imports through the `@/`
  alias with the group in the path.
- **R5** — No component's source changes apart from its own import statements.
  Props, markup, class names and exported names are identical before and after.
- **R6** — No test's assertions change. Test files may differ only in their
  import paths and their location on disk.
- **R7** — `docs/coding-guidelines.md` exists, carrying the full section
  skeleton (see Dependencies) and a filled design-system section. The document
  is the concrete rulebook — specific, example-driven, "do this, not that" —
  while `docs/architecture.md` keeps the principles and the reasoning behind
  them. The design-system section states:
  what each of the five groups is for, the rule that a component's name is
  generic and never domain-specific, and the rule that nothing under
  `src/components/` may import from `src/features/`.
- **R8** — Every rule written into the guidelines names the code that motivated
  it. The briefing asks for rules derived from the project, so a rule with no
  example in this repo does not go in.
- **R9** — A design-system component may import any other design-system
  component, and `tokens.ts`, regardless of group. The groups organise the
  folder for a reader; they are not import boundaries. `ChipGroup` keeps its use
  of `EyebrowLabel`, and `Row` and `Stack` keep their use of `Space`.
- **R10** — Inside `src/components/`, a component references a sibling in its own
  group relatively (`./Chip`) and a component in another group through the alias
  (`@/components/typography/EyebrowLabel`). A relative path never climbs out of
  its own folder, so crossing a group boundary always looks like crossing one.

## Behaviour details

Nothing in the running application changes. The observable difference is the
shape of the tree and the text of an import line:

```
before   import { Button } from '@/components/Button'
after    import { Button } from '@/components/controls/Button'
```

Three components import siblings that land in a different group after the move:
`ChipGroup` uses `EyebrowLabel` (controls → typography), and `Row` and `Stack`
use `Space` from `tokens.ts` (layout → root). All three stay exactly as they are
behaviourally, and all three change import style under R10:

```
before   import { EyebrowLabel } from './EyebrowLabel'
after    import { EyebrowLabel } from '@/components/typography/EyebrowLabel'
```

A composite reusing a primitive is what a design system is for, so the groups
stay navigational. The boundary that is real — and that Epic 4 enforces — is the
one between `src/components/` and `src/features/`, not the ones between groups.

## Acceptance criteria

- **AC1** (R1) — Given the repo after this epic, when `src/components/` is
  listed, then it contains exactly five directories plus `tokens.ts`, and every
  component file sits in the group named in R1 beside its own test.
- **AC2** (R3) — Given the repo after this epic, when `src/components/` is
  searched for `index.ts`, then none is found.
- **AC3** (R4) — Given the repo after this epic, when the source is searched for
  `@/components/<PascalCase>` with no group segment, then there are no matches.
- **AC4** (R5, R6) — Given the diff for this epic, when every changed line in
  `src/` is inspected, then each is either an import statement or a file move;
  no assertion, prop, class name or JSX node differs.
- **AC5** (R5) — Given the app after this epic, when `npm test`, `npm run lint`
  and `npm run build` are run, then all three pass with the same test count as
  before the epic.
- **AC6** (R7) — Given `docs/coding-guidelines.md`, when it is read, then it
  contains the agreed section headings and a design-system section covering the
  five groups, the generic-naming rule and the no-feature-imports rule, each
  written as a concrete rule with the file that motivated it.
- **AC8** (R10) — Given any file under `src/components/`, when its imports are
  inspected, then no specifier begins with `../`; every cross-group reference
  uses the `@/components/<group>/<Name>` form.
- **AC9** (R9) — Given `ChipGroup`, `Row` and `Stack` after the move, when they
  are rendered in their existing tests, then all pass unchanged, with
  `EyebrowLabel` and `Space` resolved across group boundaries.
- **AC7** (R5) — Given the app running under `npm run dev`, when the daily
  puzzle is played through a full cycle, then it looks and behaves exactly as it
  did before the epic.

## Dependencies

**Hands to Epic 2 and Epic 4 — the `docs/coding-guidelines.md` skeleton.** This
epic and Epic 2 run in parallel and both write to that file, so the section list
is fixed here as a contract and each epic fills only its own section:

```markdown
# Coding guidelines
## The design system            <- Epic 1 fills
## Feature slices               <- Epic 2 fills
## Anti-patterns and their fixes <- Epic 3 fills
## Shared code (`src/lib/`)     <- Epic 3 fills
## Enforcement                  <- Epic 4 fills
```

Whichever of Epic 1 and Epic 2 lands first creates the file with all five
headings present and empty. Because the sections are disjoint, a concurrent
merge is a trivial one.

**Needs:** nothing. This epic can start immediately.

## Assumptions

- Group folders are lowercase and plural, matching no existing convention in
  this repo because none exists yet.
- `PageShell` is layout rather than a surface: it establishes the page frame, and
  `Panel`/`Card`/`MiniCard` are the things drawn on it.
- `Pill` is display rather than typography — it is a rendered badge, not a text
  style.
- The 10 consuming files and 39 import statements counted today are the whole
  blast radius; the move is mechanical and reviewable in one pass.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there.

### Cycle 1 — 2026-08-30

**Q1. May a design-system component import from another group?**
Answer: **A) Yes, freely** — the groups organise the folder for a reader rather
than partitioning the system, and all three existing cross-group imports are a
composite reusing a primitive, which is what a design system is for.
Applied to: R9, AC9, Behaviour details

**Q2. How do components inside `src/components/` reference each other?**
Answer: **A) Relative within a group, alias across groups** — a relative path
that climbs out of its own folder is the thing the sub-folders exist to make
visible, so crossing a boundary should read as crossing one.
Applied to: R10, AC8, Behaviour details

**Q3. What is `docs/coding-guidelines.md` for a reader who already has
`architecture.md`?**
Answer: **A) The concrete rulebook** — example-driven "do this, not that", with
`architecture.md` keeping the principles and reasoning; this matches the
briefing's ask for rules derived from the project and gives Epic 4 a clear
consolidation target.
Applied to: R7, AC6, and the register of every rule Epics 2–4 add
