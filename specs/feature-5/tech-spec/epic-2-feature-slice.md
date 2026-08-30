# Tech spec — Epic 2: A feature slice with named seams

PRD: [../prd/epic-2-feature-slice.md](../prd/epic-2-feature-slice.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Four independent moves inside one feature folder, plus a documentation track.
They parallelise cleanly because each owns a disjoint set of files and every
track rewrites its own imports against a path table frozen up front — so the
component track can point at `lib/theory/music` while the lib track is still
moving `music.ts` there. The one part that is not a file move is the generated
manifest: its location is named in two generator path constants and read by the
app, and the whole point of R8 is that relocating it must not trigger a
re-render. Structural tests, in the style Epic 1 establishes, lock each new
folder rule in before the move satisfies it.

## Architecture

```
src/features/daily-groove/
├── components/
│   ├── GroovePuzzle.tsx        the root; composes the three regions
│   ├── header/                 GrooveHeader, StreakBadge
│   ├── puzzle/                 GrooveCard, TransportPanel, GuessCard,
│   │                           AttemptDots, FeedbackLine, NudgeBox, SolvedPanel
│   └── archive/                ArchiveStrip
├── hooks/                      useProgress
├── state/                      useDailyGrooveStore  (a store factory, not a hook)
├── data/                       grooves.generated.ts (generator output)
├── lib/
│   ├── theory/                 notes, music, options
│   ├── puzzle/                 selectGroove, scoring, resolveGroove
│   ├── persistence/            storage, streak
│   ├── presentation/           feedback, archive
│   └── audio/                  audio, transport
├── types.ts
└── index.ts                    unchanged public surface
```

`lib/` survives as the wrapper for business logic, as `docs/architecture.md`
prescribes, and now separates it from `components/`, `hooks/`, `state/` and
`data/` by more than convention. The component regions follow the composition
tree — each is a subtree of `GroovePuzzle`, which is why no component appears in
two of them.

## Contracts

The path table. Every track rewrites imports against this while the others are
still moving files.

```ts
// lib/theory/
'../lib/theory/notes'   '../lib/theory/music'    '../lib/theory/options'
// lib/puzzle/
'../lib/puzzle/selectGroove'  '../lib/puzzle/scoring'  '../lib/puzzle/resolveGroove'
// lib/persistence/
'../lib/persistence/storage'  '../lib/persistence/streak'
// lib/presentation/
'../lib/presentation/feedback'  '../lib/presentation/archive'
// lib/audio/
'../lib/audio/audio'    '../lib/audio/transport'
// relocated out of lib/
'../data/grooves.generated'     '../state/useDailyGrooveStore'
// unmoved
'../types'   '../hooks/useProgress'
```

Depth note: every mover above sits one level deeper than it did, so a component
at `components/<region>/X.tsx` reaches lib with `../../lib/<concern>/<module>`,
while `GroovePuzzle.tsx` at the `components/` root still uses `../lib/...`.

The manifest's emitted header is **not** part of this epic's contract. It stays
`import type { Groove } from '../types'` — unchanged bytes are what make R8's
"no re-render" claim provable — and Epic 4 changes it as part of the type move.

The generator's two path constants, both pointing at the manifest:

```ts
// scripts/grooves/cli.ts:24 and scripts/grooves/verify-cli.ts:20
'../../src/features/daily-groove/data/grooves.generated.ts'
```

`index.ts` exports exactly what it exports today — `GroovePuzzle` plus the
`Answer`, `Attempt`, `DailyResult`, `Flavour`, `Groove`, `Root` types.

## Tracks

### Track A — The `lib/` concern folders

- **Goal** — twelve modules sit in five concern folders with their tests.
- **Owns** — `src/features/daily-groove/lib/**` *except* `grooves.generated.*`
- **Depends on** — the path table only
- **Parallel with** — B, C, D, E
- **Done when** — every moved module's own test passes.

### Track B — `data/` and the generator's path constants

- **Goal** — the manifest lives in `data/`, the generator writes and verifies it
  there, and no audio was re-rendered to achieve it.
- **Owns** — `src/features/daily-groove/lib/grooves.generated.ts` and its test,
  `scripts/grooves/cli.ts`, `scripts/grooves/verify-cli.ts`
- **Depends on** — the path table only
- **Parallel with** — A, C, D, E
- **Done when** — `npm run grooves:verify` passes without `npm run grooves`
  having been run.

### Track C — The component regions

- **Goal** — ten components sit in three regions, `GroovePuzzle.tsx` above them,
  every import rewritten to the table.
- **Owns** — `src/features/daily-groove/components/**`
- **Depends on** — the path table only
- **Parallel with** — A, B, D, E
- **Done when** — the component tests pass. They will not until A, B and D land;
  see Execution waves.

### Track D — `state/`

- **Goal** — the store factory is out of `hooks/`, which is left holding a hook.
- **Owns** — `src/features/daily-groove/hooks/**`,
  `src/features/daily-groove/state/**`
- **Depends on** — the path table only
- **Parallel with** — A, B, C, E
- **Done when** — `useProgress.test.ts` and the store's own test pass.

### Track E — The guidelines section

- **Goal** — `## Feature slices` is filled in `docs/coding-guidelines.md`.
- **Owns** — `docs/coding-guidelines.md`
- **Depends on** — nothing. If Epic 1 has not landed, this track creates the
  file with all five headings and fills only its own.
- **Parallel with** — everything, including all of Epic 1.
- **Done when** — Step E1's checklist holds.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C, Track D, Track E
- **Wave 2:** Integration — `index.ts`, the full suite, `grooves:verify`

The four move tracks own disjoint files and rewrite imports against a frozen
table, so they can run at once. The tree does not compile until all four land —
each track's own tests go green in isolation only for modules with no
cross-track import, so the honest gate is Wave 2. They land in one commit.

## Implementation

### Track A — The `lib/` concern folders

#### Step A1 — A test that `lib/` holds no loose modules

Covers: R1, AC1

- **Test first** — `src/features/daily-groove/structure.test.ts` (new): assert
  `readdirSync('src/features/daily-groove/lib', { withFileTypes: true })`
  contains only directories, named exactly `theory`, `puzzle`, `persistence`,
  `presentation`, `audio`. Run it: fails with a list of 26 loose `.ts` files.
- **Implement** — Steps A2–A6 make it pass.
- **Green when** — after A6, and after Track B has removed `grooves.generated.*`.
- **Refactor** — none.

#### Step A2 — Move `lib/theory/`

Covers: R1, R10

- **Test first** — `npm test -- lib/theory`: fails with
  `Cannot find module '../types'` from the moved tests (the depth changed).
- **Implement** — `git mv` `notes.ts`, `music.ts`, `options.ts` and their tests
  into `lib/theory/`. In each, rewrite `'../types'` to `'../../types'`, and any
  sibling import to `'./<name>'`.
- **Green when** — `notes.test.ts`, `music.test.ts`, `options.test.ts` pass.
- **Refactor** — none.

#### Step A3 — Move `lib/puzzle/`

Covers: R1, R10

- **Test first** — as A2.
- **Implement** — `git mv` `selectGroove.ts`, `scoring.ts`, `resolveGroove.ts`
  and their tests into `lib/puzzle/`. Rewrite `'../types'` to `'../../types'`.
  `resolveGroove.ts` also imports the manifest — point it at
  `'../../data/grooves.generated'` per the contract, before Track B has moved it.
- **Green when** — the three moved tests pass once Track B lands; until then
  `resolveGroove.test.ts` is red on the manifest path alone.
- **Refactor** — none.

#### Step A4 — Move `lib/persistence/`

Covers: R1, R10

- **Test first** — as A2.
- **Implement** — `git mv` `storage.ts`, `streak.ts` and their tests into
  `lib/persistence/`; rewrite `'../types'` to `'../../types'`.
- **Green when** — `storage.test.ts` and `streak.test.ts` pass.
- **Refactor** — none.

#### Step A5 — Move `lib/presentation/`

Covers: R1, R10

- **Test first** — as A2.
- **Implement** — `git mv` `feedback.ts`, `archive.ts` and their tests into
  `lib/presentation/`; rewrite `'../types'` to `'../../types'`.
- **Green when** — `feedback.test.ts` and `archive.test.ts` pass.
- **Refactor** — none.

#### Step A6 — Move `lib/audio/`

Covers: R1, R10, AC1

- **Test first** — Step A1, still red.
- **Implement** — `git mv` `audio.ts`, `transport.ts` and their tests into
  `lib/audio/`; rewrite any `'../types'` to `'../../types'`.
- **Green when** — `audio.test.ts` and `transport.test.ts` pass, and Step A1
  goes green once Track B has cleared `grooves.generated.*` out of `lib/`.
- **Refactor** — none.

### Track B — `data/` and the generator's path constants

#### Step B1 — A test that the manifest is not in `lib/`

Covers: R2, AC2

- **Test first** — `src/features/daily-groove/structure.test.ts`: assert no file
  named `grooves.generated.ts` exists anywhere under `lib/`, and that
  `data/grooves.generated.ts` does exist. Run it: fails with
  `expected false to be true` on the `data/` half.
- **Implement** — Step B2.
- **Green when** — after B2.
- **Refactor** — none.

#### Step B2 — Move the manifest to `data/`

Covers: R2, R9, AC2

- **Test first** — Step B1, red.
- **Implement** — `git mv` `lib/grooves.generated.ts` and
  `lib/grooves.generated.test.ts` into `data/`. Rewrite the test's subject import
  to `'./grooves.generated'` and its `'../types'` to `'../types'` (unchanged
  depth — `lib/` and `data/` sit at the same level). Update the file's
  `GENERATED FILE - DO NOT EDIT` header to name the new path.
- **Green when** — Step B1 passes and `data/grooves.generated.test.ts` passes.
- **Refactor** — none. The manifest's `import type { Groove } from '../types'`
  is left exactly as it is. `lib/` and `data/` sit at the same depth under the
  feature, so the emitted specifier still resolves, and leaving it alone is what
  keeps this epic's diff to pure moves and its manifest bytes unchanged. Epic 4
  rewrites that line when `Groove` actually moves to `src/lib/groove.ts`.

#### Step B3 — Point the generator's write target at `data/`

Covers: R7, AC8

- **Test first** — `npx vitest run --project generator -- cli`: the existing
  `cli.test.ts` asserts the manifest path constant. Update its expectation to
  `data/grooves.generated.ts` first. Run it: fails with
  `expected '…/lib/grooves.generated.ts' to be '…/data/grooves.generated.ts'`.
- **Implement** — `scripts/grooves/cli.ts:24`: change the constant to
  `'../../src/features/daily-groove/data/grooves.generated.ts'`.
- **Green when** — the generator project's tests pass.
- **Refactor** — none.

#### Step B4 — Point the build guard at `data/`

Covers: R7, R8, AC6

- **Test first** — `npx vitest run --project generator -- verify-cli`: update
  the path expectation in `verify-cli.test.ts` first. Run it: fails the same way
  as B3.
- **Implement** — `scripts/grooves/verify-cli.ts:20`: change the constant to the
  `data/` path.
- **Green when** — the generator tests pass, and `npm run grooves:verify` passes
  on the working tree **without** `npm run grooves` having been run. That is the
  proof of R8: the manifest's bytes never changed, so its hash in
  `grooves.lock.json` still matches.
- **Refactor** — none.

#### Step B5 — Prove the move re-rendered nothing

Covers: R8, AC6, AC7

- **Test first** — none; this is a verification step.
- **Implement** — on a scratch branch, run `npm run grooves`. Then
  `git status --short public/grooves/ scripts/grooves/grooves.lock.json`.
- **Green when** — no `.mp3` is modified, and `grooves.lock.json` is unchanged —
  the render is deterministic and the manifest content is identical, so the
  full pipeline reproduces the committed bytes exactly. Discard the branch.
- **Refactor** — none. If an mp3 *does* change, stop: something in the generator
  moved, and that is a freeze-rule violation, not a path fix.

### Track C — The component regions

#### Step C1 — A test that components sit in regions

Covers: R4, AC4

- **Test first** — `src/features/daily-groove/structure.test.ts`: assert
  `components/` holds exactly the directories `header`, `puzzle`, `archive` and
  exactly the files `GroovePuzzle.tsx` and `GroovePuzzle.test.tsx`; then assert
  each of the other ten components resolves in the region R4 assigns it. Run it:
  fails listing 22 loose files.
- **Implement** — Steps C2–C4.
- **Green when** — after C4.
- **Refactor** — none.

#### Step C2 — Move `components/header/`

Covers: R4, R10

- **Test first** — `npm test -- components/header`: fails on unresolved imports.
- **Implement** — `git mv` `GrooveHeader.tsx`, `StreakBadge.tsx` and their tests
  into `components/header/`. Rewrite `@/components/...` design-system imports
  unchanged (they are aliased, so depth does not affect them), `'../types'` to
  `'../../types'`, `'../lib/...'` to `'../../lib/<concern>/...'` per the table,
  and `GrooveHeader`'s import of `StreakBadge` to `'./StreakBadge'`.
- **Green when** — both moved tests pass.
- **Refactor** — none.

#### Step C3 — Move `components/puzzle/`

Covers: R4, R10

- **Test first** — as C2.
- **Implement** — `git mv` `GrooveCard`, `TransportPanel`, `GuessCard`,
  `AttemptDots`, `FeedbackLine`, `NudgeBox`, `SolvedPanel` and their tests into
  `components/puzzle/`. `GuessCard`'s imports of `AttemptDots`, `FeedbackLine`
  and `NudgeBox` become `'./<Name>'`. Rewrite lib and types imports per the
  table.
- **Green when** — the seven moved tests pass.
- **Refactor** — none.

#### Step C4 — Move `components/archive/`

Covers: R4, AC4

- **Test first** — Step C1, still red.
- **Implement** — `git mv` `ArchiveStrip.tsx` and its test into
  `components/archive/`; rewrite its lib and types imports per the table.
- **Green when** — Step C1 goes green.
- **Refactor** — none.

#### Step C5 — Repoint the root component

Covers: R4, R10

- **Test first** — `npm test -- GroovePuzzle`: fails with
  `Cannot find module './GrooveHeader'`.
- **Implement** — `components/GroovePuzzle.tsx` stays where it is. Rewrite its
  six component imports to `'./header/GrooveHeader'`, `'./puzzle/GrooveCard'`,
  `'./puzzle/TransportPanel'`, `'./puzzle/GuessCard'`, `'./puzzle/SolvedPanel'`,
  `'./archive/ArchiveStrip'`, and its eight lib imports per the table.
- **Green when** — `GroovePuzzle.test.tsx` passes.
- **Refactor** — none.

### Track D — `state/`

#### Step D1 — A test that `hooks/` holds only hooks

Covers: R3, AC3

- **Test first** — `src/features/daily-groove/structure.test.ts`: assert every
  file under `hooks/` has a basename starting `use`, and that
  `state/useDailyGrooveStore.ts` exists. Run it: fails on the `state/` half —
  the store is still in `hooks/`.
- **Implement** — Step D2.
- **Green when** — after D2.
- **Refactor** — none.

#### Step D2 — Move the store factory to `state/`

Covers: R3, R10, AC3

- **Test first** — Step D1, red.
- **Implement** — `git mv hooks/useDailyGrooveStore.ts hooks/useDailyGrooveStore.test.ts
  state/`. Rewrite the moved file's `'../types'` and `'../lib/scoring'` to
  `'../types'` and `'../lib/puzzle/scoring'` (same depth, new concern folder),
  and the test's subject import to `'./useDailyGrooveStore'`.
- **Green when** — Step D1 goes green and the store's test passes.
- **Refactor** — none. The filename keeps its `use` prefix despite not being a
  hook; renaming it is a behaviour-adjacent change this epic does not make, and
  the structural test in D1 exempts `state/`.

### Track E — The guidelines section

#### Step E1 — Fill `## Feature slices`

Covers: R11, AC11

- **Test first** — none; prose.
- **Implement** — under `## Feature slices` in `docs/coding-guidelines.md`
  (creating the file with all five headings if Epic 1 has not yet landed): what
  each `lib/` concern folder holds, with the module that motivated it; that
  feature components are grouped by the screen region that renders them, and
  that the grouping follows the composition tree; that generated data lives in
  `data/` and never in `lib/`, motivated by `grooves.generated.ts`; that
  `hooks/` holds only hooks, motivated by `useDailyGrooveStore` having been
  filed there while exporting a store factory; and that a feature is reached
  only through its `index.ts`. Tag each rule *lint-enforced* (Epic 4) or
  *human-checked*.
- **Green when** — every rule names a file in this repo.
- **Refactor** — none.

## Integration and verification

- **Step I1** — `index.ts`: rewrite its `'./components/GroovePuzzle'` (unchanged)
  and `'./types'` (unchanged) imports; confirm by inspection that the exported
  name set is byte-identical to the previous version (R6, AC5).
- **Step I2** — Run `npm test`. Expect the 1005 pre-existing tests plus the
  structural tests, all green (R10, AC10).
- **Step I3** — Run `npm run lint` and `npm run build`. `prebuild` runs
  `grooves:verify`, so a stale path constant fails here (AC6, AC10).
- **Step I4** — Audit the diff (AC9): every changed line under `src/` is an
  import statement, a file move, or the manifest's path header.
- **Step I5** — `npm run dev`, play a full puzzle and replay a groove from the
  played row. Identical to before.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1–A6 |
| R2 | B1, B2 |
| R3 | D1, D2 |
| R4 | C1–C5 |
| R5 | (no step — `types.ts` is not moved by this epic) |
| R6 | I1 |
| R7 | B3, B4 |
| R8 | B4, B5 |
| R9 | B2 |
| R10 | A2–A6, C2–C5, D2, I2 |
| R11 | E1 |
| AC1 | A1 |
| AC2 | B1, B2 |
| AC3 | D1 |
| AC4 | C1 |
| AC5 | I1 |
| AC6 | B4, I3 |
| AC7 | B5 |
| AC8 | B3 |
| AC9 | I4 |
| AC10 | I2, I3 |
| AC11 | E1 |

R5 is satisfied by inaction: `types.ts` stays put and this epic moves nothing out
of it. Step I4's diff audit is what proves it.

## Assumptions

- All structural tests live in one new
  `src/features/daily-groove/structure.test.ts`, colocated with the feature so
  deleting the feature deletes them, per `docs/testing.md`.
- `state/useDailyGrooveStore.ts` keeps its filename. Renaming it to
  `dailyGrooveStore.ts` would read better but touches the store's public name,
  which is outside this epic's "no logic changes" rule.
- Tracks A–D land in one commit. Their individual green points are per-module;
  the tree only compiles once all four are in.

## Decision log

Settled architectural decisions. The sections above are the source of truth —
this records how they got there, and what each one cost.

### Cycle 1 — 2026-08-30

**Q1. What import does the generated manifest declare for `Groove`?**
Decision: **A) Leave `'../types'` untouched** — `data/` and `lib/` sit at the
same depth, so the emitted specifier still resolves; touching it would change
the manifest's bytes, force a regeneration and a lock-file hash update, and
contradict R8 and AC6, which exist to prove this epic re-renders nothing. Epic 4
rewrites the line anyway when the type moves, so changing it here pays the
regeneration cost twice.
Changed: Contracts gains an explicit note that the emitted header is out of
scope; Step B2's refactor note is now a decision rather than a pointer. No step
was added or removed.
