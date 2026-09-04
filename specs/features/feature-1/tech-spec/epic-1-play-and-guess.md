# Tech spec — Epic 1: Play today's groove and take a guess (walking skeleton)

PRD: [../prd/epic-1-play-and-guess.md](../prd/epic-1-play-and-guess.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Build the `daily-groove` feature slice as three disjoint tracks behind a frozen
`types.ts` contract: pure domain logic in `lib/` (deterministic groove
selection, distractor option sets, scale scoring, seed data), an audio-playback
utility plus generic design-system controls, and the feature UI that composes
them. Because every track builds against the same frozen `Groove` / `DailyResult`
types, all three run in parallel after a one-time test-runner + contracts
bootstrap, and meet at a final route-wiring step. State for the single puzzle
lives in a per-instance Zustand store so Epics 2 and 3 can widen it and Epic 3
can subscribe for persistence without a rewrite.

## Architecture

- **Feature slice** `src/features/daily-groove/`: `types.ts` (contracts), `lib/`
  (logic + seed + audio), `components/` (feature UI), `index.ts` (public
  surface). The route at `src/app/page.tsx` composes only the feature's public
  surface.
- **Design system** `src/components/`: generic, prop-driven `PlayControl` and
  `OptionGroup` — no feature imports, per `docs/architecture.md`.
- **Determinism**: the day's groove is a hash of the ISO date over the whole
  seed set (never exhausts). The distractor option set is likewise seeded by the
  date + attribute, so a reload shows identical options.
- **State**: a per-instance Zustand store, created by
  `createDailyGrooveStore(groove)`, holds `{ groove, selected, submitted,
  result }` and its actions. `GroovePuzzle` creates the store once from today's
  groove; components read it via selectors. Epic 2 widens the store's
  state/actions and Epic 3 subscribes to persist — neither replaces it.
- **Audio**: an HTML5 `Audio` element wrapped by `lib/audio.ts`; the UI never
  touches the element directly. Seed audio files are served from
  `public/grooves/`.

## Contracts

Frozen here and shared with Epics 2 and 3. Created in Step 0b before any track
starts.

```ts
// src/features/daily-groove/types.ts
export type Attribute = 'scale' | 'chord' | 'progression'

export type Groove = {
  id: string
  audioSrc: string     // URL under /grooves, e.g. "/grooves/groove-01.mp3"
  scale: string        // absolute, e.g. "C minor"
  chord: string        // absolute, e.g. "Dmaj7"
  progression: string  // absolute, e.g. "Dm–G–C"
}

export type DailyResult = {
  date: string                                    // ISO date "YYYY-MM-DD"
  guesses: Partial<Record<Attribute, string>>     // Epic 1 sets only `scale`
  correctness: Partial<Record<Attribute, boolean>>
}
```

```ts
// lib/selectGroove.ts
export function selectGrooveForDate(date: Date, grooves: Groove[]): Groove
export function isoDate(date: Date): string       // "YYYY-MM-DD", local calendar day

// lib/options.ts   — correct answer + distractors, deterministic per (seed)
export function buildOptions(correct: string, pool: string[], seed: string, count?: number): string[]

// lib/scoring.ts
export function scoreAttribute(groove: Groove, attribute: Attribute, guess: string): boolean

// lib/audio.ts   — UI-facing playback wrapper
export type AudioPlayer = { play(): Promise<void>; stop(): void; dispose(): void }
export function createAudioPlayer(src: string): AudioPlayer
```

Design-system component props (frozen):

```ts
// src/components/OptionGroup.tsx
type OptionGroupProps = {
  options: string[]
  value: string | null
  onChange: (v: string) => void
  disabled?: boolean
  name: string
}
// src/components/PlayControl.tsx
type PlayControlProps = { onPlay: () => void; isPlaying: boolean; label?: string }
```

Puzzle state store (frozen; requires the `zustand` dependency, added in Step C1):

```ts
// hooks/useDailyGrooveStore.ts   (Zustand, one store instance per puzzle)
import type { StoreApi } from 'zustand'
export type DailyGrooveState = {
  groove: Groove
  selected: string | null
  submitted: boolean
  result: DailyResult | null
  select(value: string): void
  submit(): void          // scores via scoreAttribute, builds the DailyResult
}
export function createDailyGrooveStore(groove: Groove): StoreApi<DailyGrooveState>
```

## Tracks

### Track A — Domain logic & seed data
- **Goal** — deterministic selection, option sets, scale scoring, and a seed set,
  all unit-tested in isolation.
- **Owns** — `src/features/daily-groove/lib/selectGroove.ts`, `lib/options.ts`,
  `lib/scoring.ts`, `lib/seed.ts` (+ their `.test.ts`).
- **Depends on** — the `types.ts` contract only.
- **Parallel with** — Tracks B and C.
- **Done when** — its own `lib/` tests pass, with no UI present.

### Track B — Audio utility & design-system controls
- **Goal** — an audio wrapper with error handling, and generic `PlayControl` /
  `OptionGroup` components.
- **Owns** — `src/features/daily-groove/lib/audio.ts` (+test),
  `src/components/PlayControl.tsx` (+test), `src/components/OptionGroup.tsx`
  (+test).
- **Depends on** — nothing beyond the DS prop contracts.
- **Parallel with** — Tracks A and C.
- **Done when** — audio + component tests pass in isolation.

### Track C — Feature UI
- **Goal** — `ScalePicker`, `ResultReveal`, `GroovePuzzle`, the
  `createDailyGrooveStore` Zustand store, and the feature's `index.ts`, tested
  with lib/audio mocked.
- **Owns** — `src/features/daily-groove/components/**`,
  `hooks/useDailyGrooveStore.ts`, `index.ts` (+ their tests).
- **Depends on** — the `types.ts`, `lib/`, and DS prop contracts (mocks the
  implementations in tests).
- **Parallel with** — Tracks A and B.
- **Done when** — component/hook tests pass with mocked collaborators.

## Execution waves

- **Wave 0 (setup):** Step 0 (test runner) → Step 0b (contracts file). Blocks all
  tracks.
- **Wave 1 (parallel):** Track A, Track B, Track C.
- **Wave 2:** Integration — wire real modules into `GroovePuzzle` and the route;
  run the demo path.

## Implementation

### Wave 0 — setup

#### Step 0 — Test runner exists

Covers: infrastructure for every step

- **Test first** — `src/lib/sanity.test.ts`: `expect(1 + 1).toBe(2)`. Run it:
  fails with "vitest: command not found" / no `test` script.
- **Implement** — add dev deps `vitest`, `@vitejs/plugin-react`,
  `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`. Add
  `vitest.config.ts` (jsdom environment, `setupFiles` importing
  `@testing-library/jest-dom`, React plugin). Add `"test": "vitest run"` and
  `"test:watch": "vitest"` to `package.json`.
- **Green when** — `npm test` runs and the sanity test passes.
- **Refactor** — delete `src/lib/sanity.test.ts` once a real test exists.

#### Step 0b — Freeze the contracts

Covers: R6 (shape), enables parallel tracks

- **Test first** — `src/features/daily-groove/types.test.ts`: a type-level
  assertion that a literal `DailyResult` object with `date`, `guesses.scale`,
  `correctness.scale` is assignable. Run it: fails — `types.ts` does not exist.
- **Implement** — create `src/features/daily-groove/types.ts` exactly as in
  Contracts.
- **Green when** — the type test compiles and passes.
- **Refactor** — none.

### Track A — Domain logic & seed data

#### Step A1 — Deterministic groove for a date

Covers: R3, AC1

- **Test first** — `lib/selectGroove.test.ts`: given a fixed `grooves` array of
  3, assert `selectGrooveForDate(new Date('2026-08-21'), grooves)` equals itself
  across repeated calls; assert a date far in the future
  (`new Date('2099-01-01')`) still returns a member of `grooves`; assert
  `isoDate(new Date('2026-08-21T23:00'))` === `'2026-08-21'`. Run it: fails —
  "selectGrooveForDate is not a function".
- **Implement** — `lib/selectGroove.ts`: `isoDate` formats the local calendar
  day; `selectGrooveForDate` hashes `isoDate(date)` to an index
  `hash % grooves.length` and returns that groove.
- **Green when** — determinism, non-exhaustion, and `isoDate` assertions pass.
- **Refactor** — extract the string hash into a private helper if Step A2 reuses
  it.

#### Step A2 — Deterministic option set with distractors

Covers: R4

- **Test first** — `lib/options.test.ts`: assert `buildOptions('C minor',
  pool, 'seed-1', 4)` returns 4 items, includes `'C minor'`, has no duplicates,
  and returns the identical array for the same seed. Run it: fails —
  "buildOptions is not a function".
- **Implement** — `lib/options.ts`: return the correct answer plus
  seed-shuffled distractors drawn from `pool` (excluding the correct value),
  trimmed to `count` (default 4), order seeded by `seed`.
- **Green when** — count, inclusion, uniqueness, and determinism assertions pass.
- **Refactor** — none.

#### Step A3 — Score a scale guess

Covers: R5, R6

- **Test first** — `lib/scoring.test.ts`: with a groove `{ scale: 'C minor', … }`
  assert `scoreAttribute(groove, 'scale', 'C minor') === true` and
  `scoreAttribute(groove, 'scale', 'A dorian') === false`. Run it: fails —
  "scoreAttribute is not a function".
- **Implement** — `lib/scoring.ts`: `scoreAttribute` compares `guess` to
  `groove[attribute]` by exact string equality.
- **Green when** — both assertions pass.
- **Refactor** — none (Epic 2 reuses this for chord/progression as-is).

#### Step A4 — Seed set

Covers: R1–R5 (data they operate on)

- **Test first** — `lib/seed.test.ts`: import `GROOVES`; assert length ≥ 5, every
  entry has non-empty `id`, `audioSrc` starting `'/grooves/'`, and non-empty
  `scale`, `chord`, `progression`; assert all `id`s are unique. Run it: fails —
  "GROOVES is not exported".
- **Implement** — `lib/seed.ts`: export `const GROOVES: Groove[]` with ≥5
  entries referencing files in `public/grooves/`. Also export
  `SCALE_POOL: string[]` (the distractor pool of scale values).
- **Green when** — all seed assertions pass.
- **Refactor** — none. (Audio files added in integration; tests don't load them.)

### Track B — Audio utility & design-system controls

#### Step B1 — Audio player plays and replays

Covers: R2, AC4

- **Test first** — `lib/audio.test.ts`: stub `window.Audio` with a spy; assert
  `createAudioPlayer('/grooves/x.mp3').play()` calls the element's `play()`, and
  calling `play()` twice triggers two playbacks (resetting `currentTime`). Run
  it: fails — "createAudioPlayer is not a function".
- **Implement** — `lib/audio.ts`: wrap an `Audio` element; `play()` resets
  `currentTime = 0` then calls `.play()`; `stop()` pauses; `dispose()` releases.
- **Green when** — play/replay spies fire as asserted.
- **Refactor** — none.

#### Step B2 — Audio load/play failure surfaces

Covers: R7, AC5

- **Test first** — `lib/audio.test.ts`: make the stub's `play()` reject; assert
  `play()` returns a rejected promise the caller can catch. Run it: fails —
  errors are swallowed.
- **Implement** — `lib/audio.ts`: `play()` returns the element's play promise
  (or a rejection on load error) so the UI can show a retry.
- **Green when** — the rejection propagates.
- **Refactor** — none.

#### Step B3 — `PlayControl` (design system)

Covers: R2

- **Test first** — `src/components/PlayControl.test.tsx`: render with
  `onPlay` spy; click the button → `onPlay` called; when `isPlaying` the button
  shows the playing label/state. Run it: fails — component missing.
- **Implement** — `src/components/PlayControl.tsx` per the prop contract; no
  feature imports.
- **Green when** — click and state assertions pass.
- **Refactor** — none.

#### Step B4 — `OptionGroup` (design system)

Covers: R4

- **Test first** — `src/components/OptionGroup.test.tsx`: render 4 options,
  `value=null`; click one → `onChange` called with it; with `disabled` clicks do
  nothing; only one option shows selected. Run it: fails — component missing.
- **Implement** — `src/components/OptionGroup.tsx` per the prop contract
  (radio-group semantics, single select).
- **Green when** — selection and disabled assertions pass.
- **Refactor** — none.

### Track C — Feature UI

#### Step C1 — `createDailyGrooveStore` (Zustand)

Covers: R6, R8

- **Test first** — `hooks/useDailyGrooveStore.test.ts`: create a store from a
  groove; initial state is `{ selected: null, submitted: false, result: null }`;
  `getState().select('C minor')` sets `selected`; `getState().submit()` sets
  `submitted: true` and a `result` `DailyResult` with
  `guesses.scale`/`correctness.scale` populated; `submit()` before any `select`
  is a no-op. Uses a mocked `scoreAttribute`. Run it: fails —
  "createDailyGrooveStore is not a function".
- **Implement** — add the `zustand` dependency. `hooks/useDailyGrooveStore.ts`:
  `createDailyGrooveStore(groove)` returns a vanilla `createStore` instance with
  `select`/`submit` actions; `submit` builds the `DailyResult` via
  `scoreAttribute` + `isoDate`.
- **Green when** — state transitions and result shape assertions pass.
- **Refactor** — none.

#### Step C2 — `ScalePicker`

Covers: R4

- **Test first** — `components/ScalePicker.test.tsx`: render with `options`,
  `value`, `onSelect`; picking calls `onSelect` with the value; renders exactly
  the given options via `OptionGroup`. Run it: fails — component missing.
- **Implement** — `components/ScalePicker.tsx`: wraps `OptionGroup` with scale
  labelling.
- **Green when** — options render and selection fires.
- **Refactor** — none.

#### Step C3 — `ResultReveal`

Covers: R5, R8

- **Test first** — `components/ResultReveal.test.tsx`: given `{ correct: true,
  answer: 'C minor' }` shows a correct state and the answer; given
  `{ correct: false, answer: 'C minor' }` shows incorrect and still reveals
  `'C minor'`. Run it: fails — component missing.
- **Implement** — `components/ResultReveal.tsx`.
- **Green when** — both states render as asserted.
- **Refactor** — none.

#### Step C4 — `GroovePuzzle` composition

Covers: R1, R2, R5, R7, R8, AC2, AC3, AC5

- **Test first** — `components/GroovePuzzle.test.tsx` (lib/audio + scoring
  mocked): (a) renders `PlayControl` + `ScalePicker`; (b) selecting the correct
  scale and submitting shows `ResultReveal` "correct" and locks the picker
  (AC2, R8); (c) a wrong selection shows "incorrect" + answer, picker locked
  (AC3); (d) when the mocked player rejects, an error with a retry button
  renders and the picker still shows (AC5, R7); (e) pre-submit, the answer is
  not in the DOM (R8). Run it: fails — component missing.
- **Implement** — `components/GroovePuzzle.tsx` (a `'use client'` component):
  creates a `createDailyGrooveStore(groove)` instance once (via `useRef`) and
  reads it through selectors; composes `PlayControl` (wired to
  `createAudioPlayer`), `ScalePicker` (options via `buildOptions`), a submit
  button, `ResultReveal`, and an audio-error/retry banner.
- **Green when** — all five assertions pass.
- **Refactor** — extract the error banner if the route needs it too.

#### Step C5 — Public surface

Covers: R1

- **Test first** — `index.test.ts`: assert `import { GroovePuzzle } from '.'`
  resolves to a component and that `lib`/`components` internals are **not**
  re-exported. Run it: fails — `index.ts` missing.
- **Implement** — `index.ts` exports only `GroovePuzzle` and the shared types.
- **Green when** — the import resolves; deep internals stay private.
- **Refactor** — none.

## Integration and verification

#### Step I1 — Route wiring & audio assets

Covers: R1, R2, R3 (end to end)

- **Test first** — `src/app/page.test.tsx`: render the page; assert it shows the
  Daily Groove layout with a play control and scale options for **today's**
  selected groove (real `selectGrooveForDate` + `GROOVES`, audio mocked). Run
  it: fails — page still renders the Next starter.
- **Implement** — replace `src/app/page.tsx` to render `GroovePuzzle`. Because
  the local-calendar-day selection must run client-side (a server `new Date()`
  would risk an SSR/CSR mismatch), `GroovePuzzle` selects today's groove via
  `selectGrooveForDate(new Date(), GROOVES)` on the client; the page composes
  only the feature's public surface. Add the seed audio files under
  `public/grooves/`. (Consult `node_modules/next/dist/docs/` for Next 16
  route/page conventions.)
- **Green when** — the page test passes and the full suite is green.
- **Refactor** — none.

#### Step I2 — Manual demo (PRD demo path)

- Run `npm run dev`; open the app. Press play → hear today's groove; replay works
  (R2/AC4). Pick a scale → submit → correct/incorrect with the answer revealed
  (AC2/AC3). Reload → same groove, same options (R3). Temporarily point one
  `audioSrc` at a missing file → error + retry shows (AC5).

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | C4, C5, I1 |
| R2 | B1, B3, C4, I1, I2 |
| R3 | A1, I1, I2 |
| R4 | A2, B4, C2, C4 |
| R5 | A3, C3, C4 |
| R6 | 0b, A3, C1 |
| R7 | B2, C4 |
| R8 | C1, C3, C4 |
| AC1 | A1 |
| AC2 | C4, I2 |
| AC3 | C4, I2 |
| AC4 | B1, I2 |
| AC5 | B2, C4, I2 |

## Assumptions

- **Audio**: HTML5 `Audio` element behind `lib/audio.ts`; files served from
  `public/grooves/` and referenced by the `audioSrc` URL contract. Moving them
  later only changes seed URLs.
- **"Today"** is the client's local calendar day; `selectGrooveForDate` takes an
  injected `Date` so tests are deterministic.
- **Distractors** come from `SCALE_POOL` in `seed.ts`; the option count is 4.
- The interactive puzzle is a client component (`'use client'`); today's date is
  read on the client so the local-calendar-day selection is stable and avoids an
  SSR/CSR mismatch.
- Next 16 route/page specifics are confirmed against
  `node_modules/next/dist/docs/` at Step I1 rather than assumed from memory.

## Decision log

### Cycle 1

**Q1. How is the single puzzle's state held?**
Decision: **C) External store (Zustand), one instance per puzzle** — created by
`createDailyGrooveStore(groove)`. Chosen over feature-local `useReducer` so Epic
2 can widen state/actions and Epic 3 can subscribe to persist without prop
threading or a rewrite; the cost is a new `zustand` dependency.
Changed: Architecture (State), Contracts (added the store contract), Track C
goal/owns (`useDailyGroove.ts` → `useDailyGrooveStore.ts`), Step C1 (rewritten
as a Zustand store with a `zustand` install), Step C4 (`GroovePuzzle` creates and
selects from the store), and the route note (client-side store + date). The
cascade also updates Epic 2's Track C and Epic 3's `useProgress`.
