# Tech spec — Epic 3: The god component, dismantled

PRD: [../prd/epic-3-god-component.md](../prd/epic-3-god-component.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Three independent fixes that happen to share a folder. The hash de-duplication
touches `src/lib/`, the generator and one puzzle module, and is done in an hour.
The hook extraction touches `GroovePuzzle.tsx` and its 1,184-line test. The
route-test relocation touches `page.test.tsx` and a dozen destination test files.
None of the three needs the others, so all three run at once, and the only shared
file — `GroovePuzzle.test.tsx` — is owned by one track with the other's two
contributions deferred to integration.

The hardest part is not the extraction; it is proving nothing was lost. Two
files shrink by roughly 1,100 lines between them and their assertions reappear in
a dozen places. A whole-suite assertion count, taken before and after, is the
only honest gate, so it is a real scripted check rather than a reviewer's
impression.

## Architecture

`GroovePuzzleView` keeps composition and loses everything else:

```
components/GroovePuzzle.tsx     GroovePuzzle wrapper + GroovePuzzleView (composition)
hooks/usePuzzleSession.ts       store creation, hydration, check, retry
hooks/useTransport.ts           transport lifecycle, subscriptions, error state
hooks/useProgress.ts            unchanged
lib/audio/transport.ts          unchanged — feature-4 already put it here
src/lib/hash.ts                 hashString, shared with the generator
```

`useTransport` wraps what `GroovePuzzleView` does around `createPageTransport`
today: hold it in state so it is stable across renders, dispose it on unmount,
read `soundingId` and `position` through `useSyncExternalStore`, and own the
error flag that a failed `toggle` sets. It does not reimplement exclusivity —
that is structural in the transport itself and stays there.

`src/lib/` is created by this epic and is a leaf: it imports nothing from the
app, which is what lets `scripts/grooves/rng.ts` import it from outside the
`@/` alias by relative path.

## Contracts

```ts
// src/lib/hash.ts
export function hashString(input: string): number
```

```ts
// src/features/daily-groove/hooks/useTransport.ts
export type UseTransport = {
  soundingId: string | null
  position: number
  error: boolean
  toggle(source: PlayableSource): Promise<void>
}
export function useTransport(): UseTransport
```

`usePuzzleSession` returns a flat value object, never the store. Zustand stays
an implementation detail behind the hook, so `state/` keeps its one consumer and
the hook's test asserts on plain values rather than store internals.

```ts
// src/features/daily-groove/hooks/usePuzzleSession.ts
export type UsePuzzleSession = {
  selectedRoot: Root | null
  selectedFlavour: Flavour | null
  attempts: Attempt[]
  solved: boolean
  hydrated: boolean
  selectRoot(r: Root): void
  selectFlavour(f: Flavour): void
  canCheck: boolean
  check(): void
}
export function usePuzzleSession(groove: Groove, today: Date): UsePuzzleSession
```

**Amended during implementation.** `UsePuzzleSession` also carries `answer`,
`streak` and `history`. Forced rather than chosen: the check handler moves into
the hook and calls `recordAttempt`, so the hook must own the `useProgress`
instance. `useProgress` holds per-instance state, so a second instance in the
view would not observe the write, and the streak badge and archive strip would
stop updating on a solve. One instance is the only shape that preserves
behaviour.

The generator's import, by relative path with the extension — the mechanism
`scripts/grooves/manifest.ts` already uses:

```ts
// scripts/grooves/rng.ts
import { hashString } from '../../src/lib/hash.ts'
```

## Tracks

### Track A — The shared hash

- **Goal** — one copy of `hashString`, imported by the app and the generator,
  pinned by a test.
- **Owns** — `src/lib/**`, `scripts/grooves/rng.ts`,
  `src/features/daily-groove/lib/puzzle/selectGroove.ts` and its test
- **Depends on** — the `hashString` contract only
- **Parallel with** — B, C, D
- **Done when** — `npm test` and `npm run grooves` both pass, and the FNV
  constant appears once in the repo.

### Track B — The hook extraction

- **Goal** — `GroovePuzzleView` composes; two hooks own what it used to.
- **Owns** — `hooks/usePuzzleSession.*`, `hooks/useTransport.*`,
  `components/GroovePuzzle.tsx`, `components/GroovePuzzle.test.tsx`
- **Depends on** — the two hook contracts only
- **Parallel with** — A, C, D
- **Done when** — both hook tests pass and `GroovePuzzle.test.tsx` is green at
  materially fewer than 1,184 lines.

### Track C — The route test's assertions

- **Goal** — `page.test.tsx` tests the route; the feature's behaviour is tested
  inside the feature.
- **Owns** — `src/app/page.test.tsx`, and the destination test files in the PRD
  table *except* `GroovePuzzle.test.tsx`
- **Depends on** — nothing
- **Parallel with** — A, B, D
- **Done when** — `page.test.tsx` imports the feature only through `index.ts`.

### Track D — The guidelines sections

- **Goal** — `## Anti-patterns and their fixes` and `## Shared code` are filled.
- **Owns** — `docs/coding-guidelines.md`
- **Depends on** — nothing
- **Parallel with** — everything
- **Done when** — Step D1's checklist holds.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C, Track D
- **Wave 2:** Integration — the two deferred table rows, the count gate, the
  removability check

All four tracks own disjoint files. The two rows of the PRD's destination table
that target `GroovePuzzle.test.tsx` — "renders the designed shell…" and "reveals
neither the solved panel…" — belong to Track C by subject but to Track B by
file, so they are applied in Step I1 once B has settled that file's shape.

## Implementation

### Track A — The shared hash

#### Step A1 — Pin `hashString` before moving it

Covers: R14, AC14

- **Test first** — `src/lib/hash.test.ts` (new): assert `hashString` returns the
  values the current implementation returns for a fixed table — at minimum
  `''`, `'2026-08-30'`, `'groove-01'`, and a Unicode input like `'E♭ dorian'`.
  Generate the expected numbers once by running the existing function; commit
  them as literals. Run it: fails with
  `Cannot find module '@/lib/hash'`.
- **Implement** — `src/lib/hash.ts`: move `hashString` verbatim out of
  `lib/puzzle/selectGroove.ts`, keeping the FNV-1a body byte-for-byte. Add the
  R8 header: this function seeds the generator's RNG *and* picks the player's
  groove of the day, so editing it re-renders every groove and reassigns every
  past date's puzzle.
- **Green when** — the pin table passes, with no ffmpeg and no sample pack
  present.
- **Refactor** — none.

#### Step A2 — Point the app at the shared copy

Covers: R5, R10, AC6, AC8

- **Test first** — `selectGroove.test.ts`: add an assertion that
  `selectGrooveForDate` returns the same groove id for a fixed sweep of dates
  across a year — capture the current answers as literals first. Run it: passes
  now, and must still pass after the move. This is the regression net for R10.
- **Implement** — `lib/puzzle/selectGroove.ts`: delete the local `hashString`
  and `import { hashString } from '@/lib/hash'`. Keep it exported from
  `selectGroove` only if something imports it from there; otherwise drop the
  re-export.
- **Green when** — the year-long sweep still passes and the app suite is green.
- **Refactor** — none.

#### Step A3 — Point the generator at the shared copy

Covers: R5, R6, R7, AC6, AC7

- **Test first** — `scripts/grooves/rng.test.ts`: it already asserts `rngFor`'s
  sequences. Add an assertion that `hashString` — now imported by `rng.ts` from
  `src/lib` — matches the same pin table as `src/lib/hash.test.ts`. Run it:
  fails with `Cannot find module '../../src/lib/hash.ts'` until the import is
  written.
- **Implement** — `scripts/grooves/rng.ts`: delete the local `hashString` and
  `import { hashString } from '../../src/lib/hash.ts'`. Update the file's
  comment: it no longer asserts the two copies match, because there is one copy.
- **Green when** — `npx vitest run --project generator` passes, and
  `npm run grooves` completes with no build step. `src/lib/hash.ts` must contain
  no enum, namespace, decorator or `@/` import, because Node strips types but
  does not resolve the alias.
- **Refactor** — none.

#### Step A4 — Prove the duplication is gone and the audio did not move

Covers: R5, R10, AC6, AC7, AC11

- **Test first** — `src/lib/hash.test.ts`: add a source-reading assertion that
  the FNV constant `16777619` appears in exactly one file under `src/` and
  `scripts/`. Run it: fails if either copy survives.
- **Implement** — nothing, if A2 and A3 are complete.
- **Green when** — the assertion passes, `npm run grooves:verify` passes, and
  `git status public/grooves/` is clean.
- **Refactor** — none.

### Track B — The hook extraction

#### Step B1 — Extract `useTransport`

Covers: R1, R2, AC2

- **Test first** — `hooks/useTransport.test.ts` (new): render the hook and
  assert it returns `soundingId: null` and `position: 0` before any press; that
  `toggle({ id, src })` sets `soundingId` to that id; that a second `toggle` of
  the same id clears it; that unmounting calls the transport's `dispose`; and
  that a rejected `toggle` sets `error` true. Run it: fails with
  `Cannot find module './useTransport'`.
- **Implement** — `hooks/useTransport.ts`: move from `GroovePuzzleView` the
  `useState(() => createPageTransport())`, the dispose `useEffect`, both
  `useSyncExternalStore` calls, the `audioError` state and the toggle handler.
  Return the `UseTransport` contract. Construct nothing new — it calls
  `createPageTransport` from `lib/audio/transport`, which already exists.
- **Green when** — the new test passes and `GroovePuzzle.test.tsx`'s playback
  assertions still pass through the hook.
- **Refactor** — none. R2 is the constraint here: the adapter stays in
  `lib/audio/transport.ts` and the hook only orchestrates it.

#### Step B2 — Extract `usePuzzleSession`

Covers: R1, AC1

- **Test first** — `hooks/usePuzzleSession.test.ts` (new): assert the hook
  starts with `selectedRoot: null`, `attempts: []`, `solved: false`,
  `hydrated: false`; that `selectRoot` then `selectFlavour` makes `canCheck`
  true; that `check()` appends a scored attempt; that a stored `DailyResult`
  injected through the progress store hydrates attempts and `solved` and sets
  `hydrated` true; and that no attempt is appended once `solved`. Run it: fails
  with `Cannot find module './usePuzzleSession'`.
- **Implement** — `hooks/usePuzzleSession.ts`: move from `GroovePuzzleView` the
  `answerOf` derivation, `useState(() => createDailyGrooveStore(answer))`, the
  `useStore` reads, the `hydrated`/`hydratedRef` effect and the check handler.
  Return the `UsePuzzleSession` contract: a flat value object of fields and
  callbacks. The `StoreApi` is not returned and `useStore` is not called outside
  this file, so no consumer and no test reaches the store directly.
- **Green when** — the new test passes, asserting only on the returned values.
- **Refactor** — none. `createDailyGrooveStore` stays in `state/`; the hook
  calls it rather than absorbing it, so the store keeps its own unit test.

#### Step B3 — Reduce `GroovePuzzleView` to composition

Covers: R1, R9, R13, AC13

- **Test first** — `GroovePuzzle.test.tsx`: run it unchanged. It fails where the
  view no longer holds the state the test reaches for.
- **Implement** — `components/GroovePuzzle.tsx`: replace the extracted blocks
  with `usePuzzleSession(groove, today)` and `useTransport()`. What remains is
  the date, the derived view data (`archiveEntries`, `flavours`, `dots`,
  `feedback`, `showNudge`) and the JSX.
- **Green when** — the whole of `GroovePuzzle.test.tsx` passes again with no
  assertion changed.
- **Refactor** — this is the refactor. Nothing else.

#### Step B4 — Split the test file

Covers: R9, R13, AC13

- **Test first** — the count gate: record
  `grep -rc "expect(" src/ | awk -F: '{s+=$2} END {print s}'` before this step.
- **Implement** — move the assertions in `GroovePuzzle.test.tsx` that exercise
  session state into `usePuzzleSession.test.ts`, and those that exercise
  playback into `useTransport.test.ts`. What stays is what only holds when every
  region renders together.
- **Green when** — the recorded count is unchanged, `GroovePuzzle.test.tsx` is
  materially shorter than 1,184 lines, and the suite is green.

  **Outcome: the second clause was not met, and it was the wrong criterion.**
  The file went 1,226 → 1,189 while the suite's `expect(` count rose 1,206 →
  1,297. Both hook tests are `.ts` using `renderHook`, so only value-level
  assertions can move; the bulk of `GroovePuzzle.test.tsx` asserts through the
  DOM (`screen.getByRole`, `dotStates()`, `archiveCards()`) and moving those
  means rewriting them, which R9 and this step's own refactor note forbid. The
  criterion assumed those lines were session and playback logic; they are
  composed DOM behaviour. The half that did hold — a test file beside each hook,
  carrying real coverage — is met. AC13 is graded **Partly**.
- **Refactor** — none. An assertion that will not move without being rewritten
  is a signal the split went past a refactor; leave it in the composed test
  rather than reshaping it.

### Track C — The route test's assertions

#### Step C1 — A test that the route holds no deep import

Covers: R3, AC4

- **Test first** — extend `src/components/structure.test.ts` (Epic 1) or add
  `src/app/route-boundary.test.ts`: read `src/app/page.test.tsx` and
  `src/app/page.tsx` as text; assert every `@/features/daily-groove` specifier
  is exactly that string with no trailing path, and that no `vi.mock` names a
  path inside the feature. Run it: fails listing the four deep imports at lines
  7, 11, 12 and 15.
- **Implement** — Steps C2–C4.
- **Green when** — after C4.
- **Refactor** — none.

#### Step C2 — Relocate the component-level assertions

Covers: R4, AC5

Each moved assertion keeps the render it was written against — a composed render
of the whole feature, not an isolated component render — and arrives inside its
own `describe('through the composed page', ...)` block, separate from the
destination file's existing isolated tests.

That is deliberate. R4 forbids rewriting these assertions, and rewriting the
render *is* rewriting the assertion: a component rendered with hand-made props
does not assert what the same component asserts inside the real page.
`docs/testing.md` asks for behaviour through the rendered result rather than
isolation for its own sake, so a composed block inside a component's test file is
within the repo's conventions. The label is what keeps the difference visible.

- **Test first** — each destination test file, run after the paste, fails on the
  shared render helper it does not yet have.
- **Implement** — first extract `page.test.tsx`'s render-and-settle helper into
  `src/features/daily-groove/testing/renderFeature.tsx`, so the destinations
  import it rather than each copying it. Then move the assertions per the PRD
  table, each in its composed `describe` block, into
  `components/puzzle/GrooveCard.test.tsx`, `TransportPanel.test.tsx`,
  `GuessCard.test.tsx` (three assertions), `AttemptDots.test.tsx`,
  `components/header/GrooveHeader.test.tsx`, and
  `components/archive/ArchiveStrip.test.tsx` (three, including feature-4's two
  played-row assertions).
- **Green when** — each destination file passes and the moved assertions are
  intact, character for character.
- **Refactor** — none.

#### Step C3 — Relocate the logic-level assertions

Covers: R4, AC5

- **Test first** — as C2.
- **Implement** — move the flavour-options assertion into
  `lib/theory/music.test.ts`, the opening-guidance assertion into
  `lib/presentation/feedback.test.ts`, and the saved-record assertion into
  `hooks/usePuzzleSession.test.ts`. These three assert on values rather than
  rendered output, so unlike Step C2 they need no composed render and no
  wrapper.
- **Green when** — each destination file passes.
- **Refactor** — none.

#### Step C4 — Reduce `page.test.tsx` to the route

Covers: R3, R11, AC4

- **Test first** — Step C1, still red.
- **Implement** — delete the four deep imports and the `vi.mock` of the
  feature's audio module. What remains is the "composes the page out of
  design-system primitives" assertion and a render asserting `PageShell`,
  `Container` and `GroovePuzzle` are composed — through `@/features/daily-groove`
  only.
- **Green when** — Step C1 goes green and `page.test.tsx` passes.
- **Refactor** — none.

### Track D — The guidelines sections

#### Step D1 — Fill the anti-patterns and shared-code sections

Covers: R12, AC12

- **Test first** — none; prose.
- **Implement** — under `## Anti-patterns and their fixes`: no I/O adapter is
  constructed in a component file (motivated by `createTransport`, which lived
  in `GroovePuzzle.tsx` until feature-4); no deep import past a feature's
  `index.ts`, tests included (motivated by `page.test.tsx`'s four); tests are
  colocated with the code they cover (`docs/testing.md`, same violation); a
  component that imports most of its feature's modules is doing too much
  (motivated by `GroovePuzzle.tsx` at 358 lines with an 1,184-line test). Under
  `## Shared code (\`src/lib/\`)`: what qualifies — pure, dependency-free,
  runtime-safe TypeScript importable by both the app and the generator — and the
  freeze note on `hash.ts`. Tag each *lint-enforced* (Epic 4) or
  *human-checked*.
- **Green when** — each rule names the file that motivated it.
- **Refactor** — none.

## Integration and verification

- **Step I1** — Apply the two deferred table rows into the reduced
  `GroovePuzzle.test.tsx`: the composed half of "renders the designed shell…"
  and "reveals neither the solved panel nor the day's changes before the solve".
- **Step I2** — The count gate (R4, R9, AC5): the whole-suite `expect(` count
  must be greater than or equal to the pre-epic figure, and every assertion in
  the PRD table must be present in the file the table assigns it.
- **Step I3** — Removability (R11, AC10): `rm -rf src/features/daily-groove`
  and `rm src/app/page.tsx`, then `npx tsc --noEmit`. No unresolved import.
  Restore with `git checkout`.
- **Step I4** — Determinism (R10, AC8): the year-long date sweep from Step A2
  still returns the pre-epic groove for every date.
- **Step I5** — `npm run grooves:verify` passes with no audio or manifest change
  (AC11); `npm test`, `npm run lint`, `npm run build` all green.
- **Step I6** — Demo path (AC9): `npm run dev`, play a full puzzle — guess, miss,
  guess, solve, reload — and replay a groove from the played row.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | B1, B2, B3 |
| R2 | B1 |
| R3 | C1, C4 |
| R4 | C2, C3, I1, I2 |
| R5 | A2, A3, A4 |
| R6 | A3 |
| R7 | A3 |
| R8 | A1 |
| R9 | B3, B4, I2 |
| R10 | A2, I4, I6 |
| R11 | C4, I3 |
| R12 | D1 |
| R13 | B4 |
| R14 | A1 |
| AC1 | B2 |
| AC2 | B1 |
| AC3 | B1 (R2 already holds; the step is not to regress it) |
| AC4 | C1, C4 |
| AC5 | I2 |
| AC6 | A4 |
| AC7 | A3, A4 |
| AC8 | A2, I4 |
| AC9 | I6 |
| AC10 | I3 |
| AC11 | I5 |
| AC12 | D1 |
| AC13 | B4 |
| AC14 | A1 |

## Assumptions

- The pin table in `src/lib/hash.test.ts` is generated from the current
  implementation and committed as literals. It is a change-detector by design:
  its job is to fail when someone edits the function, not to prove the algorithm
  correct.
- `src/lib/hash.test.ts` runs under the existing `app` vitest project, whose
  include glob `src/**/*.{test,spec}.{ts,tsx}` already covers `src/lib/`.
- `src/features/daily-groove/testing/renderFeature.tsx` is a new test-support
  module inside the feature, so deleting the feature deletes it. It holds only
  what `page.test.tsx` already does to render and settle the page.
- The `expect(` count is a proxy for assertion count. It over-counts nothing and
  under-counts only assertions written without `expect`, of which this suite has
  none.
- Step A1's pin values are captured before any refactor begins; capturing them
  afterwards would pin whatever the refactor produced.

## Decision log

Settled architectural decisions. The sections above are the source of truth —
this records how they got there, and what each one cost.

### Cycle 1 — 2026-08-30

**Q1. What does `usePuzzleSession` return?**
Decision: **A) A flat value object** — it is the shape `GroovePuzzleView`
already consumes, it keeps zustand behind the hook, and it lets the hook's test
assert on plain values rather than store internals.
Changed: Contracts states it explicitly; Step B2 now forbids returning the
`StoreApi` or calling `useStore` outside the hook file, and keeps
`createDailyGrooveStore` in `state/` with its own unit test.

**Q2. What do the relocated component assertions render?**
Decision: **A) Composed renders, in a labelled `describe` block per destination
file** — R4 forbids rewriting them, and rewriting the render is rewriting the
assertion.
Changed: Step C2 gains the composed-block rule and a sub-step extracting
`testing/renderFeature.tsx`; Step C3 now says the three value-level assertions
need no wrapper; Assumptions gains the helper's placement. The count gate in
Step I2 measures like for like, because no assertion is reshaped on the way.
