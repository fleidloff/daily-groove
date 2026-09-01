# Tech spec — Epic 2: The puzzle's tests stop being one file

PRD: [../prd/epic-2-the-puzzles-tests-stop-being-one-file.md](../prd/epic-2-the-puzzles-tests-stop-being-one-file.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

This is a move, not a rewrite, and the spec is shaped to keep it one. The
preamble — 223 lines of fixtures, fake audio, query helpers and one `beforeEach`
— is extracted into the feature's `testing/` folder first, and the existing file
is made to *use* it while still holding all 119 cases. That intermediate state is
green and committed to nothing, but it is the step that proves the helper is
faithful: if the helper is wrong, 119 cases say so immediately, while they are
still in one place and the diff is small.

Only then do the four destination files get carved out, one at a time, each
taking its cases from a still-green file. The case count is asserted at every
step, so a case cannot be lost between two of them.

**One constraint shapes the helper design:** `vi.mock` is hoisted per test file
and cannot be called from a helper — `renderFeature.tsx`'s own docstring already
says so. So the mock *factory* is shared and the `vi.mock` *call* is repeated in
each of the four files. Four identical five-line blocks is the cost; there is no
version of this where the call itself moves.

## Architecture

```
src/features/daily-groove/
├── testing/
│   ├── fakeAudioContext.ts          unchanged
│   ├── renderFeature.tsx            unchanged
│   └── puzzleHarness.tsx            NEW — the extracted preamble
└── components/
    ├── GroovePuzzle.tsx             UNCHANGED — not split, by decision
    ├── GroovePuzzle.page.test.tsx   NEW — ~30 composition cases
    ├── GroovePuzzle.puzzle.test.tsx NEW — ~51 cases
    ├── GroovePuzzle.intro.test.tsx  NEW — 30 cases
    ├── GroovePuzzle.header.test.tsx NEW — ~10 cases
    └── GroovePuzzle.test.tsx        DELETED
```

All four render the composed feature through `GroovePuzzle`. They are not tests
of a region component in isolation — `header/GrooveHeader.test.tsx`,
`puzzle/GuessCard.test.tsx` and the rest already are that, and this epic does not
touch them. The `GroovePuzzle.` prefix is what makes the two kinds tellable
apart at a glance, which is R6b.

The four files sit at the `components/` root rather than inside the region
folders for the same reason: a `header/` file that renders the whole page would
stand beside `GrooveHeader.test.tsx`, which renders one component, and the
distinction would be lost within a feature or two.

## Contracts

Frozen before any track starts. Track B and Track C write cases against this
while Track A implements it.

```ts
// src/features/daily-groove/testing/puzzleHarness.tsx

/** The fixture groove every composed case has always run against. */
export const GROOVE: Groove

/** Derived fixtures, unchanged in value from the original preamble. */
export const CHANGES_READ: string
export const CAPTION: string
export const NOTE_GLYPH: string
export const GROOVE_LOOP_SECONDS: number
export const SOLVING: Attempt
export function miss(root: Root, flavour: string, rootMatched: boolean): Attempt
export function flavours(): string[]
export function wrongFlavour(): string
export function otherWrongFlavour(): string
export function TODAY(): string

/** The persistence double. Each test FILE still writes its own vi.mock. */
export type MockStore = {
  get: Mock; getAll: Mock; save: Mock
}
export function createMockStore(): MockStore
/** Reset a store to the default empty-and-writable state. */
export function resetMockStore(store: MockStore): void

/** Audio + frame control. */
export function installPuzzleAudio(): { fake: FakeContext; frame: () => void }
export function teardownPuzzleAudio(): void

/** Render and settle. */
export function settle(): Promise<void>
export function renderPuzzle(ui?: ReactElement): Promise<RenderResult>

/** Queries — the accessible-name helpers every file needs. */
export function rootGroup(): HTMLElement
export function flavourGroup(): HTMLElement
export function control(): HTMLElement
export function nudge(): HTMLElement | null
export function dotStates(): (string | null)[]
export function chipLabel(chip: Element): string
export function chipAdornment(chip: Element): string | null
export function guess(user: UserEvent, root: string, flavour: string): Promise<void>
```

**The one thing the harness cannot provide.** Each of the four files opens with
its own copy of:

```ts
const { mockStore } = vi.hoisted(() => ({ mockStore: createMockStore() }))
vi.mock('../lib/persistence/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/persistence/storage')>()),
  createLocalStore: () => mockStore,
}))
```

`vi.hoisted` and `vi.mock` are lifted to the top of the file that calls them, so
neither survives being wrapped in a helper. `createReadOnlyStore` stays real in
all four, as it is today — the shared-groove session depends on the real
decorator.

## Tracks

### Track A — The harness

- **Goal** — `puzzleHarness.tsx` exists, and `GroovePuzzle.test.tsx` uses it with
  all 119 cases still passing in place.
- **Owns** — `src/features/daily-groove/testing/puzzleHarness.tsx`, and
  `components/GroovePuzzle.test.tsx` until Track B takes it
- **Depends on** — nothing
- **Parallel with** — nothing. This is wave 1 alone.
- **Done when** — 119 cases pass, the preamble in `GroovePuzzle.test.tsx` is
  gone, and its imports come from the harness.

### Track B — The carve-out

- **Goal** — the four files exist with the cases distributed by region, and
  `GroovePuzzle.test.tsx` is deleted.
- **Owns** — all four new `components/GroovePuzzle.*.test.tsx`, and
  `components/GroovePuzzle.test.tsx` (to delete it)
- **Depends on** — Track A's harness, in full
- **Parallel with** — nothing. One track owns all four files because a case moved
  by two agents is a case duplicated or lost, and the count assertion is the
  epic's whole safety net.
- **Done when** — 119 across four files, `GroovePuzzle.test.tsx` gone.

### Track C — The structural rule

- **Goal** — `structure.test.ts` requires the new shape, and the grouping rule is
  written where a contributor will find it.
- **Owns** — `src/features/daily-groove/structure.test.ts`
- **Depends on** — Track B's filenames only, which the Architecture section fixes
- **Parallel with** — Track B
- **Done when** — its rewritten assertion passes against the four files.

> **This epic is deliberately not very parallel.** Its subject is one file, and
> the thing that makes it safe — 119 cases counted at every step — is exactly
> what two agents cannot both hold. The parallelism it buys is for *later*
> features, not for itself.

## Execution waves

- **Wave 1:** Track A
- **Wave 2 (parallel):** Track B, Track C
- **Wave 3:** Integration

## Implementation

### Track A — The harness

#### Step A1 — The harness holds the fixtures

Covers: R5, AC6

- **Test first** — none of its own. The harness is test support, and
  `docs/testing.md` does not ask for tests of test helpers; its proof is that 119
  existing cases still pass against it. Step A4 is the assertion.
- **Implement** — create `testing/puzzleHarness.tsx` and move the value fixtures
  from `GroovePuzzle.test.tsx` lines 48–105 verbatim: `GROOVE`, `CHANGES_READ`,
  `flavours`, `wrongFlavour`, `otherWrongFlavour`, `TODAY`, `miss`, `SOLVING`,
  `GROOVE_LOOP_SECONDS`.
- **Green when** — `npx vitest run src/features/daily-groove` is green; the
  harness is not yet imported anywhere.
- **Refactor** — none.

#### Step A2 — The harness owns the audio and frame control

Covers: R5

- **Implement** — move `installFrames`, the `fake`/`frame` module state, and the
  fake-context install/teardown into `installPuzzleAudio` and
  `teardownPuzzleAudio`. `installPuzzleAudio` returns `{ fake, frame }` so a case
  that drives the clock still can.
- **Green when** — still green, still unimported.
- **Refactor** — none.

#### Step A3 — The harness owns the queries and the render

Covers: R5

- **Implement** — move `settle`, `renderPuzzle`, `NOTE_GLYPH`, `CAPTION`,
  `chipLabel`, `chipAdornment`, `rootGroup`, `flavourGroup`, `control`,
  `dotStates`, `nudge`, `guess`. Add `createMockStore` and `resetMockStore`
  carrying the `beforeEach` body's three `mockReset().mockResolvedValue(...)`
  calls.
- **Green when** — still green, still unimported.
- **Refactor** — none.

#### Step A4 — The existing file uses the harness, unchanged in behaviour

Covers: R2, R3, R5, AC2, AC3, AC6

- **Test first** — record the baseline: `npx vitest run
  src/features/daily-groove/components/GroovePuzzle.test.tsx` reports **119
  passed**. Write that number down; every later step re-checks it.
- **Implement** — delete lines 48–223 of `GroovePuzzle.test.tsx` and import their
  replacements from `../testing/puzzleHarness`. Keep the `vi.hoisted` /
  `vi.mock` block where it is — it cannot move. The `beforeEach` becomes
  `resetMockStore(mockStore)` plus the audio install.
- **Green when** — **119 passed**, the same 119 names, none skipped. Any case
  that needed a body change to survive the extraction is listed by name with what
  changed — that list is AC4's and AC8a's evidence.
- **Refactor** — none. Resist tidying case bodies here; this step's value is that
  its diff is all deletion and import.

> This is the step that de-risks the epic. If the harness is unfaithful, 119
> cases fail now — in one file, against a small diff — rather than four files
> later against a large one.

### Track B — The carve-out

Each step moves one group. After every one: run the four files together and
assert the total is still 119.

#### Step B1 — The intro file

Covers: R1, R6, R2, AC1, AC2, AC7

- **Test first** — create `components/GroovePuzzle.intro.test.tsx` with the
  `vi.hoisted`/`vi.mock` block, harness imports, and an empty
  `describe('the how-to-play box')`. Run it: passes with 0 tests — which is the
  failure to notice. Confirm the total across the feature is still 119.
- **Implement** — move the 30 cases of `describe('how to play (F8 E3)')`
  (lines 1627–2313) into it, verbatim.
- **Green when** — the intro file reports 30, `GroovePuzzle.test.tsx` reports 89,
  and the sum is 119.
- **Refactor** — none.

#### Step B2 — The header file

Covers: R1, R6, AC1, AC7

- **Test first** — create `GroovePuzzle.header.test.tsx` the same way.
- **Implement** — move `describe('sharing the groove (F12 E2)')` (6 cases), the
  streak and header cases from the flat block — *"renders the header with the
  streak beside the puzzle"*, *"reads \"N days streak\" once a day has been
  won"* — and the header-facing cases of `describe('the framing on a shared
  groove (F12 E3)')`.
- **Green when** — the sum across all files is 119.
- **Refactor** — none.

#### Step B3 — The puzzle file

Covers: R1, R6, AC1, AC7

- **Implement** — move everything about the guessing surface: option offering and
  selection, attempt dots, feedback, the nudge and the auto-selected root, the
  way out, the solved panel, simple mode, playback and transport, the error and
  retry, the progress track, the loading control, the loop head delay, and
  `describe('a shared groove (F12 E1)')`'s puzzle-facing cases.
- **Green when** — the sum is 119, and this file holds no more than 59 — half of
  119 — which is AC1's bound. The classification in the PRD puts it at ~51; if it
  lands above 59, that is the signal that `puzzle/` is too coarse and the epic
  should stop and report rather than push on.
- **Refactor** — none.

#### Step B4 — The page file, and the old file goes

Covers: R1, R6a, R7, AC1, AC2, AC7a, AC7b

- **Implement** — move what remains into `GroovePuzzle.page.test.tsx`: hydration
  and the fresh-game guard, the storage-failure cases, the pre-rename store, the
  page title's typeface and the serif headings, column stacking, the landmark
  name, the fallback to today's groove, the day shown in the header matching the
  one used to pick the groove, `describe('through the composed page')`, and the
  three assertions that removed features stay removed. Then delete
  `GroovePuzzle.test.tsx`.
- **Green when** — four files, **119 cases**, `GroovePuzzle.test.tsx` absent, and
  `npx vitest run src/features/daily-groove` green.
- **Refactor** — none.

#### Step B5 — The rule is written down

Covers: R6, AC7

- **Implement** — a docblock at the top of `GroovePuzzle.page.test.tsx` stating
  the rule: *a case goes in the file for the region it exercises; a case about
  the composition rather than a region goes here*. Name the four files and give
  the one-line test for choosing between them.
- **Green when** — the rule is where someone adding case 120 will read it.
- **Refactor** — none.

### Track C — The structural rule

#### Step C1 — The structure test requires the four files

Covers: R7, R8, AC7a, AC8, AC11

- **Test first** — in `structure.test.ts`, replace
  `expect(existsSync(join(COMPONENTS, 'GroovePuzzle.test.tsx'))).toBe(true)`
  with an assertion that the four `GroovePuzzle.<name>.test.tsx` files all exist
  and that `GroovePuzzle.test.tsx` does not. Run it before Track B finishes:
  fails, the new files do not exist yet — which is the point.
- **Implement** — nothing here; Track B makes it pass.
- **Green when** — green once B4 lands.
- **Refactor** — leave the sibling assertion,
  `expect(files).toEqual(['GroovePuzzle.tsx'])`, exactly as it is. It filters
  `.test.tsx` out already, so it needs no change, and touching it would widen the
  diff into a rule this epic is not revisiting.

## Integration and verification

#### Step I1 — The count, one last time

Covers: R2, AC2, AC3

- `npx vitest run src/features/daily-groove/components` reports 119 from the four
  files. No `.skip`, no `.todo`: grep for both and expect none.

#### Step I2 — The boundaries hold

Covers: R4, R8, R10, AC5, AC9, AC11

- `structure.test.ts`, `route-boundary.test.ts`, `src/components/structure.test.ts`
  and `scripts/grooves/boundary.test.ts` all pass.
- Grep the four files for `vi.mock`: the only path mocked is
  `../lib/persistence/storage`.
- Delete `src/features/daily-groove/` on a scratch branch and confirm
  `npm run build` fails only on the route's import — the removability standard.
  Restore.

#### Step I3 — The app is unchanged

Covers: R2, R3, AC12

- Run the app. Play a full puzzle: first visit, a wrong guess, a solve, a
  give-up, and a shared link. Nothing differs. The tests are the proof; this is
  the cross-check that they were the right tests.

#### Step I4 — Runtime did not get worse

Covers: R9, AC10

- Time the app tier before Track A and after Track B. After must be no greater.
  Expect an improvement: one 10.2s file becomes four that run in parallel across
  worker threads.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | B1, B2, B3, B4 |
| R2 | A4, B1, B4, I1 |
| R3 | A4, I3 |
| R3a | A4 |
| R4 | I2 |
| R5 | A1, A2, A3, A4 |
| R6 | B1, B2, B3, B5 |
| R6a | B4 |
| R6b | Architecture (the `GroovePuzzle.` prefix and root placement) |
| R7 | B4, C1 |
| R8 | C1, I2 |
| R9 | I4 |
| R10 | I2 |
| AC1 | B1, B2, B3, B4 |
| AC2 | A4, B4, I1 |
| AC3 | A4, I1 |
| AC4 | A4 |
| AC5 | I2 |
| AC6 | A1, A4 |
| AC7 | B1, B2, B3, B5 |
| AC7a | B4, C1 |
| AC7b | B4 |
| AC7c | Architecture |
| AC8 | C1 |
| AC8a | A4 |
| AC9 | I2 |
| AC10 | I4 |
| AC11 | C1, I2 |
| AC12 | I3 |

## Assumptions

- Filenames are `GroovePuzzle.page.test.tsx`, `GroovePuzzle.puzzle.test.tsx`,
  `GroovePuzzle.intro.test.tsx`, `GroovePuzzle.header.test.tsx`. The PRD fixed
  the placement and left the exact names here.
- `puzzleHarness.tsx` is `.tsx` because `renderPuzzle` returns JSX, as
  `renderFeature.tsx` already does.
- The harness is not itself unit-tested. Its correctness is 119 existing cases,
  which is a stronger assertion than anything written for it would be.
- Case counts per file are approximate in this spec (~51 / 30 / ~10 / ~30). The
  binding numbers are the total, 119, and AC1's ceiling of 59 in any one file.
- `GroovePuzzle.tsx` is untouched. Every one of these steps is a test-file
  change, so the component's own churn hotspot is unaffected — which the PRD
  records as this epic's known residual.

## Decision log

### Cycle 1 — 2026-09-01

**The preamble is extracted before anything is carved out.**
Decided while writing. The alternative — create four files and copy setup into
each — makes the first failure appear in four places at once and the diff
unreadable. Extract-then-carve keeps the risky step small and the safety net
(119 in one file) intact while the harness is proved.
Changed: added Track A as a wave of its own; Track B depends on it in full.

**The `vi.mock` call is repeated in all four files.**
Not a preference: `vi.hoisted` and `vi.mock` are hoisted to the top of the file
that calls them and do not survive being wrapped in a helper —
`renderFeature.tsx`'s docstring already records this. Only the factory is shared.
Changed: Contracts names `createMockStore` and the per-file block explicitly, so
the duplication is understood as required rather than sloppy.

**Track B is one track, not four.**
The epic's safety net is a case count that must hold across every move, and two
agents moving cases concurrently cannot both hold it. This epic buys parallelism
for later features rather than for itself.
Changed: Execution waves — B and C in wave 2, B undivided.
