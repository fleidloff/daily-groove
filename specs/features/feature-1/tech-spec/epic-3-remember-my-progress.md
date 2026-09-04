# Tech spec — Epic 3: Remember my progress (browser persistence, streak & history)

PRD: [../prd/epic-3-remember-my-progress.md](../prd/epic-3-remember-my-progress.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Wrap the existing puzzle in a persistence layer without touching how a puzzle is
played. A `ResultStore` interface (localStorage-backed) is the only thing that
reads or writes storage; pure streak logic reads a list of results; three UI
pieces (streak badge, history, already-played) render derived state. A
`useProgress` hook loads today's result + all results on mount and exposes
`save`, then `GroovePuzzle` shows the already-played view when today is done and
persists on submit. Storage logic and UI atoms build in parallel behind the
`ResultStore` contract; the hook + wiring follow. Because the store interface is
the seam a future login-backed store slots into, its shape is the epic's main
architectural decision.

## Architecture

- **Single seam.** `lib/storage.ts` exposes `ResultStore`; no component or hook
  reads `localStorage` directly (R6). The future server store implements the same
  interface.
- **Derived, not stored.** Streak and history are computed from the list of
  `DailyResult`s, never persisted separately — no denormalized counters to keep
  in sync.
- **Qualifying day** = at least one attempted attribute correct
  (`isQualifying`). The streak counts back from today over consecutive
  qualifying days; a gap **or** a non-qualifying played day stops it (R3, AC7).
- **Wrapping, not replacing.** `useProgress` composes the Epic 1 daily-groove
  Zustand store (`createDailyGrooveStore`) and the `ResultStore`; the puzzle
  renders either the play view or the already-played view based on whether today
  has a saved result.

## Contracts

Builds on the Epic 1 `types.ts` (unchanged; `DailyResult` already carries
per-attribute `guesses`/`correctness`).

```ts
// lib/storage.ts
export type ResultStore = {
  get(date: string): Promise<DailyResult | null>
  getAll(): Promise<DailyResult[]>
  save(result: DailyResult): Promise<void>
}
export function createLocalStore(): ResultStore   // localStorage-backed

// lib/streak.ts
export function isQualifying(r: DailyResult): boolean          // ≥1 attempted correct
export function computeStreak(results: DailyResult[], today: string): number
```

```ts
// components/StreakBadge.tsx
type StreakBadgeProps = { streak: number }
// components/HistoryView.tsx
type HistoryViewProps = { results: DailyResult[] }   // most-recent first
// components/AlreadyPlayed.tsx
type AlreadyPlayedProps = { result: DailyResult; onReplay: () => void; isPlaying: boolean }
```

The `ResultStore` methods are `Promise`-returning so a future login-backed store
implements the same interface without changing any caller.

## Tracks

### Track A — Storage & streak logic
- **Goal** — `createLocalStore` round-tripping results, and `computeStreak` /
  `isQualifying`, unit-tested against an in-memory/`jsdom` localStorage.
- **Owns** — `src/features/daily-groove/lib/storage.ts`, `lib/streak.ts` (+tests).
- **Depends on** — Epic 1 contracts only.
- **Parallel with** — Track B.
- **Done when** — `lib/` tests pass.

### Track B — Progress UI atoms
- **Goal** — `StreakBadge`, `HistoryView`, `AlreadyPlayed`.
- **Owns** — `components/StreakBadge.tsx`, `components/HistoryView.tsx`,
  `components/AlreadyPlayed.tsx` (+tests).
- **Depends on** — the prop contracts + `PlayControl` (DS) for replay.
- **Parallel with** — Track A.
- **Done when** — component tests pass in isolation.

### Track C — Progress hook & wiring
- **Goal** — `useProgress`, and `GroovePuzzle` + route showing streak/history and
  the already-played branch, persisting on submit.
- **Owns** — `hooks/useProgress.ts`, edits to `components/GroovePuzzle.tsx`,
  `src/app/page.tsx` (+tests).
- **Depends on** — Tracks A and B (contracts; store mocked in tests).
- **Parallel with** — none (Wave 2).
- **Done when** — hook + puzzle + page tests pass; full suite green.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B.
- **Wave 2:** Track C — composes A + B into the puzzle and route.
- **Wave 3:** Integration & demo (real localStorage across a reload).

## Implementation

### Track A — Storage & streak logic

#### Step A1 — `createLocalStore` round-trip

Covers: R1, R6, R7

- **Test first** — `lib/storage.test.ts` (jsdom localStorage cleared per test):
  `save(r)` then `get(r.date)` returns `r`; `getAll()` returns all saved;
  `get('2000-01-01')` returns `null`; data read back after constructing a fresh
  `createLocalStore()` (simulating reload). Run it: fails — "createLocalStore is
  not a function".
- **Implement** — `lib/storage.ts`: store all results as one JSON blob under
  `daily-groove:v1:results` (a `{ version, byDate }` envelope); methods read /
  merge / write that blob.
- **Green when** — round-trip, getAll, null-miss, and reload assertions pass.
- **Refactor** — none.

#### Step A2 — Qualifying day & streak

Covers: R3, AC3, AC4, AC7

- **Test first** — `lib/streak.test.ts`: `isQualifying` true when any
  `correctness` value is true, false when all false / empty. `computeStreak`:
  consecutive qualifying days up to `today` → that count (AC3); a missing day
  breaks it (AC4); a played-but-non-qualifying day breaks it (AC7); today
  unplayed → counts the run ending yesterday only if contiguous, else 0. Run it:
  fails — functions missing.
- **Implement** — `lib/streak.ts`: `isQualifying`; `computeStreak` walks back
  from `today` by one calendar day at a time, stopping at the first day that is
  absent or non-qualifying.
- **Green when** — all streak cases pass.
- **Refactor** — reuse `isoDate` from `lib/selectGroove.ts` for date stepping.

### Track B — Progress UI atoms

#### Step B1 — `StreakBadge`

Covers: R3, R5

- **Test first** — `components/StreakBadge.test.tsx`: `streak={5}` renders "5";
  `streak={0}` renders a zero/empty state. Run it: fails — component missing.
- **Implement** — `components/StreakBadge.tsx`.
- **Green when** — both render states pass.
- **Refactor** — none.

#### Step B2 — `HistoryView`

Covers: R4, R5, AC6, AC7

- **Test first** — `components/HistoryView.test.tsx`: given three results
  (incl. one non-qualifying), renders a row per day, most-recent first, each
  showing its per-attribute outcome; a non-qualifying day still appears (AC7);
  empty array renders an empty state (R5). Run it: fails — component missing.
- **Implement** — `components/HistoryView.tsx`.
- **Green when** — ordering, per-row outcome, non-qualifying inclusion, and empty
  state pass.
- **Refactor** — none.

#### Step B3 — `AlreadyPlayed`

Covers: R2, AC2

- **Test first** — `components/AlreadyPlayed.test.tsx`: renders the stored
  result's breakdown, exposes a working replay control (`onReplay` fires), and
  renders **no** guess inputs. Run it: fails — component missing.
- **Implement** — `components/AlreadyPlayed.tsx`, reusing `ResultBreakdown`
  (Epic 2) and `PlayControl`.
- **Green when** — result shown, replay fires, no pickers present.
- **Refactor** — none.

### Track C — Progress hook & wiring

#### Step C1 — `useProgress` hook

Covers: R1, R3, R4, R5, AC1, AC5

- **Test first** — `hooks/useProgress.test.ts` (mock `ResultStore`): on mount,
  loads `getAll()` + today's `get(today)`; exposes `todayResult`, `streak`
  (via `computeStreak`), `history`; `save(result)` writes through the store and
  updates `todayResult`/`streak`/`history`; empty store → `streak 0`,
  `history []`, `todayResult null` (AC5). Run it: fails — hook missing.
- **Implement** — `hooks/useProgress.ts`: loads on mount, memoizes streak/history
  from results, `save` persists then updates local state.
- **Green when** — load, save-through, and empty-state assertions pass.
- **Refactor** — none.

#### Step C2 — Wire persistence into `GroovePuzzle` + route

Covers: R1, R2, R6, AC1, AC2, AC6

- **Test first** — `components/GroovePuzzle.test.tsx` (store mocked): (a) when
  `todayResult` is null, the play/guess view renders and submitting calls
  `save` once with the built `DailyResult` (R1); (b) when `todayResult` exists,
  the `AlreadyPlayed` view renders instead — no pickers, replay works (R2, AC2);
  (c) `src/app/page.test.tsx`: the page shows `StreakBadge` + `HistoryView`
  alongside the puzzle, fed from `useProgress` (AC6). Run it: fails — puzzle has
  no persistence branch.
- **Implement** — `GroovePuzzle` consumes `useProgress`: branch on
  `todayResult`, call `save` on submit; `page.tsx` renders badge + history around
  the puzzle. No component reads `localStorage` directly (R6).
- **Green when** — both branches + page composition pass; full suite green.
- **Refactor** — none.

## Integration and verification

#### Step I1 — Real reload persistence (integration test)

Covers: R7, AC1

- **Test first** — `hooks/useProgress.integration.test.ts` using the **real**
  `createLocalStore` (jsdom localStorage): save a result, re-mount `useProgress`,
  assert `todayResult` is present and guessing would be blocked. Run it: fails
  until wiring uses the real store.
- **Implement** — ensure the default store in `useProgress` is
  `createLocalStore()`.
- **Green when** — the result survives a simulated remount.
- **Refactor** — none.

#### Step I2 — Manual demo (PRD demo path)

- `npm run dev`: play today → reload → already-played view with stored result,
  guessing disabled, replay works (AC1/AC2). In devtools set a run of prior
  qualifying dates → streak shows the run (AC3); insert a non-qualifying or gap
  day → streak breaks but the day still shows in history (AC4/AC7). Clear storage
  → zero streak, empty history, playable (AC5).

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1, C1, C2 |
| R2 | B3, C2 |
| R3 | A2, B1, C1 |
| R4 | B2, C1 |
| R5 | B1, B2, C1 |
| R6 | A1, C2 |
| R7 | A1, I1 |
| AC1 | C2, I1, I2 |
| AC2 | B3, C2, I2 |
| AC3 | A2, I2 |
| AC4 | A2, I2 |
| AC5 | C1, I2 |
| AC6 | B2, C2, I2 |
| AC7 | A2, B2, I2 |

## Assumptions

- History shows all past played days, most-recent first; no pagination yet.
- Date keys reuse `isoDate` from Epic 1 so a stored day maps to its groove.
- A broken streak resets to the current run (0 when today is unplayed/
  non-qualifying).

## Decision log

### Cycle 1

**Q1. How are saved results laid out in localStorage?**
Decision: **A) One versioned JSON blob** — key `daily-groove:v1:results`, value
`{ version, byDate }`. One read/write keeps `getAll` trivial for streak/history,
and the `version` field lets the shape migrate instead of being discarded.
Reversing touches only the adapter.
Changed: nothing structurally — confirmed the `createLocalStore` design in
Contracts and Step A1; removed the "layout per Q1" marker.

**Q2. Is the `ResultStore` interface async or sync?**
Decision: **A) Async (`Promise`-returning) now** — even though localStorage is
sync. The roadmap names a future login-backed/server store; making callers
`await` today means that store slots in with no caller changes. Reversing
sync→async later would touch every call site and component effect.
Changed: confirmed the `Promise`-returning `ResultStore` in Contracts and the
awaits/effects in Steps A1, C1, C2; removed the conditional markers on the
Contracts block and Track C.
