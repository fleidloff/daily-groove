# Tech spec — Epic 6: New grooves mix into the rota, this release and every one after

PRD: [../prd/epic-6-new-grooves-mix-into-the-rota.md](../prd/epic-6-new-grooves-mix-into-the-rota.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Two independent changes to the rota, both small, one of which has a timing trap.
The epoch is one exported integer in `lib/puzzle/selectGroove.ts`: the per-lap
shuffle seed goes from `lap:${lap}` to `` `${epoch}:lap:${lap}` ``, and the
lap-boundary guard's second seed is built the same way from the same epoch, so
the two can never diverge. `src/lib/hash.ts` is not opened. The pin is a pure
third argument on `selectGrooveForDate` — a groove id that wins when it names a
groove in the catalogue and is ignored otherwise — plus one synchronous reader,
`pinnedGrooveId(date)`, in `lib/persistence/storage.ts`, which is where the
envelope already lives and where the read is already synchronous under an
`async` wrapper.

The trap is *when* the pin is applied. `GroovePuzzle` resolves the groove in a
`useSyncExternalStore` client snapshot, and `GroovePuzzleView` builds the
session — including the zustand store, from `answerOf(groove)` in a `useState`
initialiser — the moment it mounts. A groove that arrived later would leave the
session holding the previous groove's answer, which is the unsolved-board flip
R12 forbids. So the pin is read *at selection time*, synchronously, before
`GroovePuzzleView` exists: no promise, no extra render phase, no swap. That is
the one design decision in this epic worth arguing about, and it is why
`ResultStore` is left alone.

One resolver, `lib/puzzle/dailyGroove.ts`, joins the reader to the selector, and
both consumers — the composer and `isTodaysGroove` — call it. Two callers that
each compose the pin themselves would be two chances to disagree; one function
makes AC12 structural.

## Architecture

```
GroovePuzzle.tsx ──── dailyGroove(new Date())
isTodaysGroove.ts ─┘        │
                            ├── pinnedGrooveId(iso)        lib/persistence/storage.ts  (sync, impure)
                            └── selectGrooveForDate(date, GROOVES, pinnedId)
                                        │
                                        ├── pinned id names a groove → that groove
                                        └── otherwise → orderFor(lap, grooves, ROTA_EPOCH)[position]
                                                            seed `${epoch}:lap:${lap}`
                                                            guard reads `${epoch}:lap:${lap - 1}`
```

- **`lib/puzzle/selectGroove.ts`** — `ROTA_EPOCH` (integer, `2`), `orderFor`
  exported with an `epoch` parameter defaulted to it, `selectGrooveForDate` with
  a third optional `pinnedId`. Still pure: a function of the date, the
  catalogue, the epoch and the id it is handed. Its imports do not change
  (`../../types`, `@/lib/date`, `@/lib/theory/options`).
- **`lib/persistence/storage.ts`** — one new export, `pinnedGrooveId(date)`,
  reading the private `readEnvelope()`. `ResultStore` is unchanged, the
  `daily-groove:v2:results` key and envelope are unchanged, and
  `createReadOnlyStore` is untouched — its `get()` refuses to answer on purpose,
  and the shared route never selects a groove anyway.
- **`lib/puzzle/dailyGroove.ts`** (new) — `dailyGroove(now: Date): Groove`, the
  epic's only impure module. It names `GROOVES` directly rather than taking a
  catalogue, so the whole-catalogue guard in `src/lib/theory/music.test.ts`
  still has a call site to find.
- **`lib/puzzle/isTodaysGroove.ts`** — signature unchanged; the body calls
  `dailyGroove(now)`. `SharedGroove.tsx` is not touched, which its own guard
  (`SharedGroove.test.tsx`, "contains `isTodaysGroove`, matches neither
  `selectGrooveForDate` nor `GROOVES`") requires.
- **`components/GroovePuzzle.tsx`** — one line. The client snapshot becomes
  `groove ?? dailyGroove(new Date())`; the server snapshot stays `() => groove`,
  so nothing reads `localStorage` during SSR. The `hydrated && modeLoaded &&
  instrumentKeyLoaded` gate at line 233 is not moved, not extended, and gains no
  companion.
- **Untouched, deliberately** — `hooks/useProgress.ts`,
  `hooks/usePuzzleSession.ts`, `types.ts`, `src/lib/hash.ts`,
  `src/lib/theory/options.ts`, `src/lib/groove.ts`, both generated manifests,
  `catalogue.json`, `grooves.lock.json` and every mp3. `DailyResult.grooveId`
  stays optional and `useProgress` keeps writing it exactly as it does.

**Module map.** All new arrows are inside the puzzle module as
`docs/architecture.md` draws it (`lib/puzzle/`, `lib/persistence/`, `state/` and
the four session hooks are one module), so no zone changes and no `index.ts` is
earned: `dailyGroove.ts → lib/persistence/storage.ts` is intra-module,
`dailyGroove.ts → data/grooves.generated` is the already-drawn **puzzle →
catalogue** arrow that `grooveByUuid.ts` and `isTodaysGroove.ts` draw today, and
the shell keeps importing one module from `lib/puzzle/` per file. Zone 8's
target is `lib/puzzle` and `lib/persistence` *from* coaching and audio; neither
is involved.

## Contracts

Frozen before Wave 1 starts. Track D and Track E build against these without
waiting for A or B to be green.

```ts
// src/features/daily-groove/lib/puzzle/selectGroove.ts — frozen
// The rota epoch. The one value in the rota that deliberately moves: bumping it
// remaps every unplayed date, past and future. Every release that mints grooves
// bumps it. Epoch 1 names the order that existed before the epoch did and is
// never rendered by the seed, which is why this release's bump is 1 → 2.
export const ROTA_EPOCH = 2

export function orderFor(lap: number, grooves: Groove[], epoch?: number): Groove[]
// seeds `${epoch}:lap:${lap}`, and the boundary guard `${epoch}:lap:${lap - 1}`

export function selectGrooveForDate(
  date: Date,
  grooves: Groove[],
  pinnedId?: string,          // wins when it names a groove in `grooves`; ignored otherwise
): Groove
// unchanged for two-argument callers; still throws on an empty catalogue
```

```ts
// src/features/daily-groove/lib/persistence/storage.ts — frozen
export function pinnedGrooveId(date: string): string | undefined
// synchronous. undefined when: no result for that date, a result with no
// grooveId, an unreadable or wrong-version envelope, or no localStorage at all.
// ResultStore, the storage key and the envelope shape do not change.
```

```ts
// src/features/daily-groove/lib/puzzle/dailyGroove.ts — frozen, new
export function dailyGroove(now: Date): Groove
// = selectGrooveForDate(now, GROOVES, pinnedGrooveId(isoDate(now)))
```

Unchanged and depended on: `isTodaysGroove(groove: Groove, now: Date): boolean`,
`DailyResult.grooveId?: string`.

## Tracks

### Track A — The epoch, the boundary, and the pure pin

- **Goal** — `selectGroove.ts` carries `ROTA_EPOCH = 2`, seeds both the lap and
  the lap before it from that epoch, and resolves a pinned id with all three
  fallbacks — proved over a 60-groove fixture and a 5,000-day seam sweep.
- **Owns** — `src/features/daily-groove/lib/puzzle/selectGroove.ts`,
  `src/features/daily-groove/lib/puzzle/selectGroove.test.ts`
- **Role** — `implementer`
- **Depends on** — nothing
- **Parallel with** — Tracks B, C
- **Done when** — `selectGroove.test.ts` green, including the two recaptured
  year-long sweeps; `src/lib/hash.test.ts` green with no edit;
  `data/grooves.generated.test.ts` green (its year of dates still resolves to a
  playable file).

### Track B — The pin, read without a promise

- **Goal** — `pinnedGrooveId(date)` answers synchronously from the existing
  envelope, and answers `undefined` for every way a day can fail to name a
  groove.
- **Owns** — `src/features/daily-groove/lib/persistence/storage.ts`,
  `src/features/daily-groove/lib/persistence/storage.test.ts`
- **Role** — `implementer`
- **Parallel with** — Tracks A, C
- **Depends on** — nothing
- **Done when** — the new cases green and every existing case in
  `storage.test.ts` green and unedited; `hooks/useProgress.test.ts` and
  `hooks/usePuzzleSession.test.ts` green untouched.

### Track C — The two rows in `docs/music.md`

- **Goal** — a person minting grooves finds the bump without reading this spec:
  the epoch is named beside "What must never change" as the thing that
  deliberately may, and "Where to change what" sends the daily order to it.
- **Owns** — `docs/music.md`
- **Role** — `implementer`
- **Parallel with** — Tracks A, B
- **Depends on** — the `ROTA_EPOCH` contract only (the name and the file it
  lives in)
- **Done when** — both sections read as specified in C1 and C2; nothing else in
  `docs/music.md` changed.

### Track D — One resolver, two consumers

- **Goal** — `dailyGroove` exists, `isTodaysGroove` answers under the pin, and
  the whole-catalogue guard still finds its call site.
- **Owns** — `src/features/daily-groove/lib/puzzle/dailyGroove.ts` (new),
  `src/features/daily-groove/lib/puzzle/dailyGroove.test.ts` (new),
  `src/features/daily-groove/lib/puzzle/isTodaysGroove.ts`,
  `src/features/daily-groove/lib/puzzle/isTodaysGroove.test.ts`,
  `src/lib/theory/music.test.ts`
- **Role** — `implementer`
- **Depends on** — Track A (the third argument), Track B (`pinnedGrooveId`)
- **Parallel with** — nothing in its wave
- **Done when** — `dailyGroove.test.ts` and `isTodaysGroove.test.ts` green;
  `src/lib/theory/music.test.ts` green; `src/app/groove/[uuid]/*.test.tsx` and
  `src/app/layout.language.test.tsx` green untouched.

### Track E — The composer, inside the wait it already has

- **Goal** — a played day opens on the groove it was played on, already solved,
  on the first render that shows a puzzle; an unplayed day reaches the board in
  the same number of phases as before.
- **Owns** — `src/features/daily-groove/components/GroovePuzzle.tsx`,
  `src/features/daily-groove/components/GroovePuzzle.pinned.test.tsx` (new),
  `src/features/daily-groove/structure.test.ts`
- **Role** — `implementer`
- **Depends on** — Track D (`dailyGroove`)
- **Parallel with** — nothing
- **Done when** — `GroovePuzzle.pinned.test.tsx` green; all eight existing
  `GroovePuzzle.*.test.tsx` files and `components/puzzle/GuessCard.test.tsx`
  green and unedited; `structure.test.ts` green.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C
- **Wave 2:** Track D — needs A's third argument and B's reader as real code,
  not stubs, because its tests assert against the shipped catalogue
- **Wave 3:** Track E — needs `dailyGroove`
- **Wave 4:** Integration and verification

## Implementation

### Track A — The epoch, the boundary, and the pure pin

#### Step A1 — the seed carries an epoch, and bumping it reshuffles every lap

Covers: R1, R2, AC1

- **Test first** — `src/features/daily-groove/lib/puzzle/selectGroove.test.ts`,
  new `describe('the rota epoch')`: `expect(ROTA_EPOCH).toBe(2)`; over
  `makeGrooves(60)` and laps 0–5, `orderFor(lap, grooves, 1).map((g) => g.id)`
  differs from `orderFor(lap, grooves, 2).map((g) => g.id)` for **every** lap,
  not merely one; and `orderFor(3, grooves)` equals
  `orderFor(3, grooves, ROTA_EPOCH)` element for element, so the default is the
  shipped epoch. Run it: fails at import — `ROTA_EPOCH` and `orderFor` are not
  exported from `selectGroove.ts`.
- **Implement** — `selectGroove.ts`: `export const ROTA_EPOCH = 2` with the
  comment from Contracts; `export function orderFor(lap: number, grooves:
  Groove[], epoch: number = ROTA_EPOCH)`; the lap seed becomes
  `` `${epoch}:lap:${lap}` ``, the `size === 2` special case becomes
  `` `${epoch}:lap:0` ``. `selectGrooveForDate` passes no epoch, so it takes the
  default.
- **Green when** — all three assertions pass. The rest of the file's rotation
  and degenerate suites still pass; the two year-long sweep fixtures now fail,
  which Step A4 owns.
- **Refactor** — none. Do not extract a `rotaSeed` helper: three call sites of
  one template literal in one function is not a duplication, and a second
  exported name would be a second thing a future bump has to notice.

#### Step A2 — the boundary guard reads the lap before it under the same epoch

Covers: R6, AC6

- **Test first** — same file, in the epoch describe: for each of epochs 1, 2 and
  3 and each lap 1–12 over `makeGrooves(60)`, assert
  `orderFor(lap, grooves, epoch)[0].id !== orderFor(lap - 1, grooves, epoch)[59].id`,
  collecting failures into an array and asserting `[]` so the message names the
  lap and the epoch. Run it: to see it red, temporarily seed the closing lookup
  `` `lap:${lap - 1}` `` (epoch dropped) — the array comes back non-empty, which
  is the guard silently not guarding. It is the only failure mode this step has,
  and it is invisible without this test.
- **Implement** — `selectGroove.ts`: the closing lookup becomes
  ``seededShuffle(grooves, `${epoch}:lap:${lap - 1}`)[size - 1]``.
- **Green when** — the array is empty for all three epochs, and the two existing
  seam cases (16 and 18 grooves, 5,000 days, through `selectGrooveForDate`) stay
  green.
- **Refactor** — none.

#### Step A3 — sixty grooves, once a lap, same answer every time

Covers: R5, AC4, AC5

- **Test first** — same file, extending the existing `selectGrooveForDate
  rotation` describe to the catalogue's shipped size: over `makeGrooves(60)` and
  the 60 consecutive days from `lapStart(60, 20_000)`, `new Set(ids).size` is 60
  and the sorted ids equal the sorted catalogue ids; and, for one fixed date,
  100 repeated `selectGrooveForDate` calls all return the same object
  (`toBe`, not `toEqual`). Run it: fails to run until the 60-groove fixture and
  the 60-day window exist. It asserts no new behaviour — it asserts the
  behaviour survives A1 and A2 at the size this release ships.
- **Implement** — nothing in `selectGroove.ts`. A1 and A2 changed the seed
  string only, and `seededShuffle` is a permutation whatever it is seeded with.
- **Green when** — both cases pass, and the 16- and 18-groove cases still do.
- **Refactor** — none.

#### Step A4 — the year-long sweeps move exactly once, and only with the epoch

Covers: R4, R5, AC1, AC3

- **Test first** — the two existing fixtures, `SWEEP_OVER_THREE` and
  `SWEEP_OVER_SIXTEEN`, fail after A1: 365 characters each, both wrong at
  character 1, because the seed changed. That failure **is** AC1 over a full
  year, and it is the evidence the reshuffle happened.
- **Implement** — recapture both strings from the run, and bind them to the
  epoch so this is the last silent recapture: rename the describe to
  `selectGrooveForDate determinism (under ROTA_EPOCH)`, add
  `it('pins the epoch the sweeps were captured under', () => expect(ROTA_EPOCH).toBe(2))`
  in it, and put a comment above the two constants — *these move only in a
  commit that also moves `ROTA_EPOCH`; if they fail and the epoch did not move,
  something else reshuffled the rota, and the fix is to find it, not to
  regenerate this.*
- **Green when** — both sweeps and the epoch pin pass; `npm test` shows
  `src/lib/hash.test.ts` green with `git diff --name-only` naming neither
  `src/lib/hash.ts` nor `src/lib/hash.test.ts`. That last part is AC3, and it is
  the whole difference between this epic and a re-release.
- **Refactor** — none.

#### Step A5 — a pinned id wins, and every way it can be absent falls back

Covers: R8, R9, R10, AC7, AC8, AC9

- **Test first** — same file, new `describe('selectGrooveForDate with a pinned
  groove')` over `makeGrooves(60)` and one fixed date. Let `mix =
  selectGrooveForDate(day, grooves)` and `other` be any groove with a different
  id. Then: `selectGrooveForDate(day, grooves, other.id)` is `other` (AC7);
  `selectGrooveForDate(day, grooves, undefined)` is `mix` (AC8);
  `selectGrooveForDate(day, grooves, 'groove-does-not-exist')` is `mix` and does
  not throw (AC9); `selectGrooveForDate(day, grooves, '')` is `mix`; and
  `selectGrooveForDate(day, grooves, mix.id)` is `mix`, so a pin that agrees
  with the mix is not a special case. Run it: fails to compile — `selectGrooveForDate`
  takes two arguments.
- **Implement** — `selectGroove.ts`: third parameter `pinnedId?: string`. After
  the empty-catalogue throw and before the day arithmetic:
  `if (pinnedId) { const pinned = grooves.find((g) => g.id === pinnedId); if (pinned) return pinned }`.
  Order matters — an empty catalogue must still throw, which the file's existing
  degenerate case asserts.
- **Green when** — all five assertions pass; the empty-rotation throw, the
  single-groove case and the two-groove alternation still pass.
- **Refactor** — none. Resist making the parameter an options object: the PRD
  asks for one optional third argument, and an `epoch` option would be a
  test-only door into a constant that is meant to be edited in the source.

### Track B — The pin, read without a promise

#### Step B1 — a stored day's groove id, synchronously

Covers: R8, R9, R10, R13, AC7, AC8

- **Test first** —
  `src/features/daily-groove/lib/persistence/storage.test.ts`, new
  `describe('pinnedGrooveId')`, five cases: after
  `await createLocalStore().save({ ...resultA, grooveId: 'groove-07' })`,
  `pinnedGrooveId(resultA.date)` is `'groove-07'` — assigned with no `await`, so
  the type itself is the proof it is not a promise; a date never saved is
  `undefined`; a saved result with no `grooveId` (the file's existing `resultA`,
  which has none) is `undefined`; with `localStorage.getItem` stubbed to throw
  it is `undefined` and nothing throws; and with the raw key set to
  `'{"version":1,"byDate":{}}'` it is `undefined`. Run it: fails at import —
  `pinnedGrooveId` is not exported.
- **Implement** — `storage.ts`:
  `export function pinnedGrooveId(date: string): string | undefined { return readEnvelope().byDate[date]?.grooveId }`.
- **Green when** — all five pass, and every existing case in the file passes
  unedited. `readEnvelope` stays private; the version-2 envelope, the storage
  key and the `ResultStore` type are untouched.
- **Refactor** — none. Do not add a synchronous method to `ResultStore`: it
  would force `createReadOnlyStore` to answer a question it refuses on purpose
  ("a shared groove is never recorded"), and eight component test files mock
  `createLocalStore` through that type.

### Track C — The two rows in `docs/music.md`

#### Step C1 — the epoch beside "What must never change"

Covers: R7, R14, AC13

- **Test first** — none; a prose section has no failing test. Verified by the
  read in *Integration and verification*, which is what AC13 asks for.
- **Implement** — `docs/music.md`, after the four frozen bullets and before the
  `grooves.lock.json` sentence, a short paragraph headed **What deliberately
  may**: `ROTA_EPOCH` in
  `src/features/daily-groove/lib/puzzle/selectGroove.ts` is the one value in the
  rota that is *meant* to move. Bumping it remaps every unplayed date, past and
  future, to a different groove. It re-renders nothing and reassigns no answer —
  it changes a seed string, not `hashString` — so it is not one of the
  re-releases above. Every release that mints grooves bumps it, so the whole
  catalogue reshuffles instead of new grooves being appended to an order players
  already know. A date the player has already played keeps its groove, pinned
  from the stored result.
- **Green when** — the section names `ROTA_EPOCH`, its file, what bumping does,
  and that it is not a re-release. The four frozen bullets are unedited.
- **Refactor** — none.

#### Step C2 — "Where to change what" gains the row

Covers: R7, R15, AC13

- **Test first** — none, as C1.
- **Implement** — `docs/music.md`, one row appended to the table:

  ```
  | the daily order, after minting grooves | `ROTA_EPOCH` in `src/features/daily-groove/lib/puzzle/selectGroove.ts` — bump it by one, every release that mints |
  ```

  It goes last, after `add a voice`, because it is the step *after* the others
  rather than one of them.
- **Green when** — the table has the row and no other row changed; the two
  sentences under the table are unedited.
- **Refactor** — none.

### Track D — One resolver, two consumers

#### Step D1 — one place resolves the groove for a date

Covers: R8, R9, R10, AC7, AC8, AC9

- **Test first** — new
  `src/features/daily-groove/lib/puzzle/dailyGroove.test.ts`, against the real
  `GROOVES`, with `localStorage.clear()` in `beforeEach`. Fix `DAY = new
  Date(2026, 8, 1)` and `MIX = selectGrooveForDate(DAY, GROOVES)`. Four cases:
  with nothing stored, `dailyGroove(DAY)` is `MIX`; after saving a result for
  `isoDate(DAY)` naming a real groove with a different uuid, `dailyGroove(DAY)`
  is that groove; after saving a result for that date with no `grooveId`,
  `dailyGroove(DAY)` is `MIX`; after saving one with
  `grooveId: 'groove-nope'`, `dailyGroove(DAY)` is `MIX` and nothing throws.
  Run it: fails at import — the module does not exist.
- **Implement** — new `src/features/daily-groove/lib/puzzle/dailyGroove.ts`:
  `dailyGroove(now)` returns
  `selectGrooveForDate(now, GROOVES, pinnedGrooveId(isoDate(now)))`, importing
  `GROOVES` from `../../data/grooves.generated`, `isoDate` from `@/lib/date` and
  `pinnedGrooveId` from `../persistence/storage`. `GROOVES` is named on the
  `selectGrooveForDate` line, not taken as a parameter — Step D3 explains why.
- **Green when** — the four cases pass.
- **Refactor** — none.

#### Step D2 — a shared link to the pinned groove is today's puzzle

Covers: R8, AC12

- **Test first** — `isTodaysGroove.test.ts`: add `localStorage.clear()` in a
  `beforeEach` (the file has none, and the pin makes stored state relevant to
  every case in it), then a new case — save a result for `isoDate(DAY)` naming
  `PINNED`, a real groove whose uuid differs from the day's mix, and assert
  `isTodaysGroove(PINNED, DAY)` is `true` **and** `isTodaysGroove(MIX, DAY)` is
  `false`. Run it: the first assertion fails, `false` — `isTodaysGroove` asks the
  mix and the mix has not heard of the pin. That failure is exactly the bug
  AC12 names: the shared route would offer the player "somebody else's shared
  groove" for the groove they are playing today.
- **Implement** — `isTodaysGroove.ts`: `return dailyGroove(now).uuid ===
  groove.uuid`. Drop the `selectGrooveForDate` and `GROOVES` imports, add
  `dailyGroove`. The signature does not change, so `SharedGroove.tsx`,
  `src/app/groove/[uuid]/page.tsx` and `src/app/layout.language.test.tsx` are
  not touched, and `SharedGroove.test.tsx`'s source guards still hold.
- **Green when** — both new assertions pass and the file's five existing cases
  pass with the cleared store.
- **Refactor** — none.

#### Step D3 — the catalogue still reaches the pick whole

Covers: R3, AC2

- **Test first** — `npm test` after D1: `src/lib/theory/music.test.ts`, "hands
  the whole catalogue to the day's pick and to the pool", fails with
  `expected 0 to be greater than 0`. Its regex is
  `/selectGrooveForDate\([^\n]*\bGROOVES\b\s*\)/` — it requires `GROOVES` to be
  the *last* argument, and the pin is now third. Nothing is wrong with the code;
  the guard is spelt too tightly for a third argument to exist.
- **Implement** — `src/lib/theory/music.test.ts`: widen that one regex's tail
  from `\s*\)` to `[^\n]*\)`. Leave the three assertions in "filters the
  rotation nowhere" exactly as they are — they are what would catch a
  `GROOVES.filter(...)` or a per-flavour subset in `dailyGroove.ts`, and they are
  the half of R3 that matters.
- **Green when** — the case passes and the hit it reports is
  `src/features/daily-groove/lib/puzzle/dailyGroove.ts`. The whole file green.
- **Refactor** — none.

### Track E — The composer, inside the wait it already has

#### Step E1 — a played day opens on the groove it was played on, already solved

Covers: R8, R11, R12, AC7, AC10

- **Test first** — new
  `src/features/daily-groove/components/GroovePuzzle.pinned.test.tsx`. It
  deliberately does **not** `vi.mock('../lib/persistence/storage')`, unlike the
  other eight composed suites, so the pin and the session hydrate from one
  `localStorage` — which is the situation AC10 describes. Setup: `clearStored()`,
  `seedFullSet()`, `installPuzzleAudio()`; `MIX = selectGrooveForDate(new
  Date(), GROOVES)`; `PINNED = GROOVES.find((g) => g.uuid !== MIX.uuid && g.name
  !== MIX.name)` — the catalogue has repeated names, so the name has to differ
  for the heading assertion to mean anything; `await seedDay({ date: TODAY(),
  answer: answerOf(PINNED), attempts: [solving attempt for PINNED], solved:
  true, grooveId: PINNED.id })`. Then:
  1. `const { container } = render(<GroovePuzzle />)` — **synchronously, before
     any flush**: `screen.queryByRole('heading', { level: 2 })` is `null` and
     `screen.getByText(puzzle.loading)` is present. No board of any kind on
     screen yet.
  2. `await settleFeature()` — the level-2 heading reads `PINNED.name`; the
     solved panel is present (`screen.getByText(solved.changes)`);
     `container.textContent` does not contain `MIX.name`; and the guess card is
     the post-solve one, not an unsolved board — assert
     `screen.getByRole('button', { name: coaching.checkSolved })`.

  Run it: assertion 2 fails — the heading reads `MIX.name`, the solved panel is
  absent and the control is `coaching.pickRootAndMode`, because the composer
  selected the mix and then hydrated a result belonging to a groove that is not
  on screen.
- **Implement** — `GroovePuzzle.tsx`, one line: the client snapshot becomes
  `() => groove ?? dailyGroove(new Date())`; replace the
  `import { selectGrooveForDate } from '../lib/puzzle/selectGroove'` with
  `import { dailyGroove } from '../lib/puzzle/dailyGroove'`. The server snapshot
  stays `() => groove`, so no `localStorage` read happens during SSR. Nothing
  else in the file moves — not the gate at line 233, not `usePuzzleSession`, not
  the store creation.
- **Green when** — both phases pass, and all eight existing
  `GroovePuzzle.*.test.tsx` files plus `components/puzzle/GuessCard.test.tsx`
  pass **unedited**. They keep passing because they either pass a `groove` prop
  (so no selection happens) or mock `createLocalStore`, which leaves the real
  `localStorage` — the only thing `pinnedGrooveId` reads — empty. If any of them
  needs a change, stop: the pin has reached further than this epic allows.
- **Refactor** — none.

#### Step E2 — an ordinary first visit costs no extra phase

Covers: R13, AC11

- **Test first** — same new file, an unplayed day: `clearStored()`,
  `seedFullSet()`, `render(<GroovePuzzle />)`, then flush microtasks one at a
  time — `await act(async () => { await Promise.resolve() })` in a loop, up to a
  small cap — counting flushes until `screen.queryByRole('radiogroup', { name:
  puzzle.rootGroup })` is non-null, and assert the count equals a module
  constant `PHASES_TO_PLAYABLE`. Set that constant by running this test on
  `main` **before** E1 lands and recording what it takes today; that recorded
  number is the contract, and the test's job from then on is to stay green.
  The failure it exists to produce: resolve the pin through
  `ResultStore.get()` and swap the groove after `useProgress` settles, and the
  count rises — and E1's phase-1 assertion breaks too, because the board
  appears before the pin does.
- **Implement** — nothing. E1's implementation is synchronous by construction;
  this step is the assertion that it stayed that way.
- **Green when** — the count matches `PHASES_TO_PLAYABLE` both before and after
  E1, and E1 stays green.
- **Refactor** — none.

#### Step E3 — the composed suite knows the new file

Covers: R11, AC10

- **Test first** — `structure.test.ts`, "holds only the root component at the
  components/ root": its `composedTests` list is the declared inventory of the
  composed suites, and `GroovePuzzle.pinned.test.tsx` is missing from it. Here
  the test file *is* the source — add the entry and the case fails while E1's
  file does not exist, which is the ordering guard.
- **Implement** — the one list entry.
- **Green when** — `structure.test.ts` green; `files` still equals
  `['GroovePuzzle.tsx']`, since the filter excludes test files.
- **Refactor** — none.

## Integration and verification

The tracks meet in one line of `GroovePuzzle.tsx` and one line of
`isTodaysGroove.ts`, so there is no wiring step. What is left is proof, and then
a handover: this epic going green is not the feature being done.

1. **The pin reaches both consumers from one place.** Read
   `dailyGroove.ts`'s consumers: `grep -rn "dailyGroove" src` returns exactly
   `components/GroovePuzzle.tsx`, `lib/puzzle/isTodaysGroove.ts` and the two
   test files. No third composition of `pinnedGrooveId` + `selectGrooveForDate`
   exists anywhere (`grep -rn "pinnedGrooveId" src` returns `storage.ts`,
   `dailyGroove.ts` and their tests only). This is AC12's structural half.
2. **AC2, by diff.** `git diff --name-only` for the epic names no `.mp3`, no
   `public/grooves/**`, no `scripts/grooves/catalogue.json`, no
   `scripts/grooves/grooves.lock.json`, no
   `src/features/daily-groove/data/*.generated.ts`, and neither `types.ts` nor
   `src/lib/groove.ts`. `git diff src/lib/groove.ts` is empty, so `Groove` has no
   new field.
3. **AC3, by diff and by test.** `git diff --name-only | grep hash` is empty and
   `npm test` reports `src/lib/hash.test.ts` green. The fixed table passed
   unmodified — the proof this was a reshuffle and not a re-release.
4. **AC14, the four commands.** `npm test`, `npm run lint`, `npm run build` and
   `npm run grooves:verify` — all pass, and `grooves:verify` reports no drift.
   No track owns anything under `scripts/grooves/`, so `npm run test:gen` is not
   this epic's gate; run it once anyway to confirm the generator is where Epics
   1–5 left it.
5. **AC13, by reading.** Open `docs/music.md` and confirm the epoch appears
   twice: as "what deliberately may" beside "What must never change", and as the
   last row of "Where to change what".
6. **The demo path, by hand** (the roadmap's validation):
   - `localStorage.clear()`, open `/`, note the groove. Fake the clock forward
     one day and then two, and note three grooves whose order the old rota does
     not predict — cross-check against the pre-epoch order by running
     `orderFor(lap, GROOVES, 1)` in a scratch script.
   - Solve today's groove. Reload. Same groove, still solved, on first paint.
   - Copy the share link for today's pinned groove and open it: it redirects to
     `/` rather than rendering as somebody else's shared groove (AC12, in the
     browser).
   - With a saved solved result for today, edit its `grooveId` in
     `localStorage` to a groove id that is not in the catalogue, reload, and see
     a playable groove with no error (AC9, in the browser).
7. **Hand over to the feature-wide listening pass.** When 1–6 are green the
   build stops, and it stops before the feature is finished. Epic 6 ships the
   rota change and closes on its own tests; the last thing in feature-25 is
   `roadmap.md`'s *Wave 5 — the feature-wide listening pass*, run by hand after
   this epic. What it inherits: a catalogue of **sixty grooves, thirty of them
   minted by Epics 1–5 and none of the thirty heard by anyone**, and **five
   per-style briefs**, one written by each of those epics, saying what to listen
   for in that style's six and where the mp3s are. It plays the thirty grouped
   by style, five styles back to back, and records a verdict per groove in the
   listener's own words — which is what discharges Epic 1's R24/AC17, Epic 2's
   R12/AC10, Epic 3's R10/AC10, Epic 4's R10/AC9 and Epic 5's R16/AC13. It is
   also where Epic 4's retune loop (R9/R9a/R9b) runs, where a style's six
   grooves can still be pulled, and where the list of proposed changes — each
   naming the template field to move and the re-render cost -- is written.

   **Epic 6 defers nothing of its own, because it has nothing to defer.** No
   requirement in its PRD asks a person to listen to anything: R1–R6 are the
   rota, R8–R13 the pin, R14--R15 the documents, and AC14 is four commands.
   Item 6's demo path is by hand but it is not a listening gate -- it checks
   *which* groove a date serves, never how one sounds — so it stays here rather
   than moving to Wave 5. What changes is only the framing the roadmap gave this
   epic: it is the last epic, not the end of the feature.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1 |
| R2 | A1, A4 |
| R3 | D3, plus Integration 2 (the diff) |
| R4 | A4, Integration 3 |
| R5 | A3, A4 |
| R6 | A2 |
| R7 | C1, C2 |
| R8 | A5, B1, D1, D2, E1 |
| R9 | A5, B1, D1 |
| R10 | A5, B1, D1 |
| R11 | E1, E3 |
| R12 | E1 |
| R13 | B1, E2 |
| R14 | C1 |
| R15 | C2 |
| AC1 | A1, A4 |
| AC2 | D3, Integration 2 |
| AC3 | A4, Integration 3 |
| AC4 | A3 |
| AC5 | A3 |
| AC6 | A2 |
| AC7 | A5, B1, D1, E1 |
| AC8 | A5, B1, D1 |
| AC9 | A5, D1, Integration 6 |
| AC10 | E1, E3 |
| AC11 | E2 |
| AC12 | D2, Integration 1, Integration 6 |
| AC13 | C1, C2, Integration 5 |
| AC14 | Integration 4 |

## Assumptions

- **The epoch is an integer, `ROTA_EPOCH`, exported from
  `lib/puzzle/selectGroove.ts`, and this release sets it to `2`.** An integer
  next to the seed it feeds is the most visible thing a release can trip over,
  and `docs/music.md` sends people to it by name. Reversing the type is a
  one-line change plus recapturing two sweep fixtures.
- **Epoch 1 names the order that existed before the epoch did, and the seed
  never renders it.** The pre-epoch seed was `lap:${lap}`; no epoch value
  produces that string. Reserving 1 keeps R2's "bumped exactly once" literally
  true and keeps AC1's old-versus-new comparison a real bump of the real
  mechanism, without a special case in the seed builder for a string that is
  never wanted again.
- **`selectGrooveForDate` gets a plain third argument, not an options object,
  and no `epoch` parameter.** The PRD asks for one optional defaulted argument.
  An `epoch` option would exist only for tests, and it would let a future bump
  slip past a fixture that names its own epoch. The epoch is testable where it
  belongs, on the exported `orderFor`.
- **The two year-long sweep fixtures are recaptured once, here, and bound to
  `ROTA_EPOCH` by a comment and an adjacent pin.** They are change-detectors and
  recapturing one is normally the wrong move; the epoch is precisely the licence
  to move them, and pinning the epoch beside them in the same describe means the
  pair can only move together. A future release bumps one integer and recaptures
  two strings, and the commit says why.
- **The pin is read synchronously, and that is the load-bearing call.**
  `readEnvelope()` is already synchronous under an `async` wrapper, so
  `pinnedGrooveId` adds no new I/O model. The alternative — reaching the pin
  through `ResultStore.get()` — cannot work without moving groove resolution
  after hydration, and `GroovePuzzleView` builds the zustand session store from
  `answerOf(groove)` in a `useState` initialiser, so a late groove would leave
  the board holding the wrong answer. That is R12's flip, and it is why this is
  stated as a decision rather than an implementation detail.
- **`GroovePuzzle`'s server snapshot stays `() => groove`.** Selection is
  already client-only, so nothing reads `localStorage` during SSR and the pin
  needs no guard of its own.
- **The eight existing composed suites need no edit.** They pass a `groove` prop
  (no selection) or mock `createLocalStore` while `pinnedGrooveId` reads the real
  `localStorage`, which their `clearStored()`/mocked-store setup leaves empty.
  If one of them turns red, treat it as a finding, not a fixture to update.
- **`dailyGroove` names `GROOVES` rather than taking a catalogue.** It keeps the
  whole-catalogue guard in `src/lib/theory/music.test.ts` pointed at a real call
  site, and the module has nothing to inject: its two tests use the shipped
  catalogue and real storage on purpose, because that is what the consumers use.
- **`dailyGroove` is not exported from the slice's `index.ts`.** No consumer
  outside the slice resolves a date; the route asks `isTodaysGroove`, which is
  already exported.
- **AC13 is verified by reading, not by a test.** Nothing in the repo asserts
  `docs/music.md`'s prose today, and a doc guard for two rows is scope the PRD
  did not ask for. The mechanical half — that the epoch exists and is one
  value — is pinned by A1 and A4.
- **`hooks/useProgress.ts` and `hooks/usePuzzleSession.ts` are not opened.**
  `DailyResult.grooveId` is read by a new synchronous path that runs before
  either hook exists; nothing about how it is written changes.
- **A style pulled at Wave 5 shrinks the catalogue from sixty to fifty-four
  *after* this epic's epoch bump and its checks, and nothing in this epic
  breaks.** Epic 4's AC8a outcome is now reached at the feature-wide listening
  pass, so this is a case the epic ships into rather than a hypothetical. Settled
  fact, in five parts:
  - **The epoch does not move again, and does not need to.** `ROTA_EPOCH` is a
    constant, not a function of the catalogue. A length change already reshuffles
    every date on its own — `lap = floor(dayIndex / grooves.length)` and
    `position = dayIndex % grooves.length` both read the length — so pulling six
    grooves re-mixes the rota whether or not the epoch is touched, and a second
    bump would buy nothing. R2's "bumped exactly once" survives literally: both
    reshuffles land inside one unreleased release, and the player sees exactly
    one order, the one that ships.
  - **The two year-long sweep fixtures are untouched.** `SWEEP_OVER_THREE` and
    `SWEEP_OVER_SIXTEEN` sweep `['a', 'b', 'c']` and `'0123456789abcdef'` mapped
    through the file's own `sweepGroove` — synthetic sets of three and sixteen.
    `selectGroove.test.ts` imports no `GROOVES` and never has, so no fixture in
    Track A is captured against the shipped catalogue. `makeGrooves(60)` in Steps
    A1, A2, A3 and A5 is a fixture *size* chosen to match what the release ships,
    not an assertion about it, and Step A3's "the sorted catalogue ids" means the
    sixty ids `makeGrooves` handed in. At fifty-four the whole file passes
    unedited; A3 merely stops describing the shipped size, which is cosmetic and
    is not worth a recapture.
  - **`dailyGroove`, the pin and `isTodaysGroove` are length-blind.** Each
    resolves against `GROOVES` as it finds it, and their tests compute
    `MIX = selectGrooveForDate(DAY, GROOVES)` at run time rather than naming a
    groove, so they follow the catalogue down. A pinned id is resolved by
    `grooves.find((g) => g.id === pinnedId)`, never by index, so no stored result
    depends on a length either.
  - **A stored `grooveId` naming a pulled groove is exactly AC9's fallback.** The
    date takes the current mix and nothing throws — that path is specified, and
    Steps A5 and D1 test it. What the fallback cannot keep is AC10's promise for
    that one date: the day hydrates a solved result whose answer belongs to a
    groove that is no longer on screen. Nobody outside this machine can be in
    that state, because a pulled groove never reaches production — Wave 5 runs
    before the release — so the exposure is the tester's own `localStorage` and
    the repair is `localStorage.clear()`.
  - **Two files go red outside this epic, and only one of them is cheap.**
    `data/grooves.generated.test.ts`'s `covers all N catalogued grooves` is a
    literal that Epics 1–5 walk 30 → 60, so a pull reports `expected length 54 to
    be 60` and the repair is one number (its `lets no mode dominate the answers`
    cap can also tip, since removing six answers removes their modes' counts —
    same conversation Epic 1 already had at `DOMINANCE_RATIO`, not a new
    mechanism). The expensive one is `data/pastPuzzles.test.ts`, the repo's only
    catalogue-sized record: `3 × GROOVES.length` consecutive days, each pinned to
    the groove it resolved to at `98a8d20`, asserting both `DAYS.length === 3 *
    GROOVES.length` and that every recorded day still resolves to the groove it
    names. Any length change reassigns all of them, and so does this epic's epoch
    bump. It is therefore already red from Epic 1's mint onward and must be
    re-baselined for the sixty-groove catalogue by whoever ships that growth; a
    Wave 5 pull makes it red once more and costs one further run of the procedure
    its own `provenance.ifTheCatalogueGrows` carries. No spec in feature-25 names
    that file — recorded here as a finding, not repaired here.
  - **Epic 6's verification is not durable across a pull, and re-running it is
    the whole repair.** AC14's four commands, `grooves:verify` above all, have to
    run again once six grooves leave `catalogue.json`, the lock and the manifest,
    because a pull edits exactly the files that command watches. Not one line of
    this epic's code changes.

## Decision log

### Cycle 1 — 2026-09-05

**Q1. How does the stored `grooveId` reach groove selection, given that
`ResultStore.get` is a promise and selection happens in a
`useSyncExternalStore` snapshot?**
Decision: **A synchronous `pinnedGrooveId(date)` in
`lib/persistence/storage.ts`, read at selection time** — `readEnvelope()` is
already synchronous, and the async alternative would have to move groove
resolution after hydration, which breaks R12: `GroovePuzzleView` creates the
session store from `answerOf(groove)` in a `useState` initialiser, so a groove
that arrives late leaves the board holding the previous groove's answer, and
either the solved panel flips or the answer is wrong. Cost of reversal: high —
it is the difference between one line in the composer and restructuring
hydration.
Changed: Contracts (`pinnedGrooveId`), Track B, Track E, Steps B1/E1/E2.

**Q2. Do both consumers compose the pin themselves, or share a resolver?**
Decision: **One resolver, `lib/puzzle/dailyGroove.ts`** — AC12 requires the
composer and `isTodaysGroove` to agree, and two compositions are two chances to
drift. It costs one new module and one widened regex in
`src/lib/theory/music.test.ts`; reversal is inlining two lines.
Changed: Contracts (`dailyGroove`), Track D, Steps D1/D2/D3, Step E1.

**Q3. Where is the epoch testable, given the year-long sweep fixtures?**
Decision: **Export `orderFor` with an `epoch` parameter; leave
`selectGrooveForDate` epoch-free and recapture the two sweeps once** — the
alternative, an `epoch` option on the public selector, exists only for tests and
would let a silent bump pass a fixture that names its own epoch. Reversal is
cheap either way; the choice is about which guard stays honest.
Changed: Contracts (`orderFor`), Steps A1/A2/A4, Assumptions.

### Cycle 2 — 2026-09-06 — the feature does not end with this epic

**Q4. Epic 6 is the last epic. Is it the end of the feature?**
Decision: **No — it hands over.** Every human listening sign-off in feature-25
has moved out of its own epic into one feature-wide listening pass, written up as
`roadmap.md`'s *Wave 5 — the feature-wide listening pass*, so the build runs from
Epic 1 to the end of Epic 6 without waiting for a person. Epic 6 has nothing of
its own to defer: no requirement in its PRD asks anyone to listen, and item 6's
demo path checks which groove a date serves rather than how one sounds, so it
stays. What changed is the framing the roadmap gave this epic — "it is last, and
it is the release" is now only half true, because the release has one more thing
after it. *Integration and verification* gained item 7, naming what the pass
inherits: sixty grooves, thirty of them unheard, and five per-style briefs.
Cost of reversal: near zero — the epic's tracks, contracts, steps and coverage
table are untouched, and folding the sign-offs back into their epics would be a
change to Epics 1–5, not to this one.
Changed: *Integration and verification* (the opening line and a new item 7).

**Q5. Wave 5 can still pull a style's six grooves. What does that cost, arriving
after this epic's epoch bump and its checks?**
Decision: **Nothing in this epic, and it is written into Assumptions as settled
fact rather than guarded against.** Sixty → fifty-four leaves `ROTA_EPOCH`
alone; a length change already reshuffles every date by itself, so no second bump
is wanted and R2 stays literally true. The two year-long sweeps are synthetic
three- and sixteen-groove sets and `selectGroove.test.ts` imports no `GROOVES` at
all, so nothing recaptured in Step A4 is catalogue-sized. `dailyGroove`, the pin
and `isTodaysGroove` read the catalogue as they find it, and a pinned id is
resolved by `find`, not by index. A stored id naming a pulled groove is AC9's
fallback, and only a local tester can hold one, since a pulled groove never
ships. The bill lands elsewhere: one literal in `data/grooves.generated.test.ts`,
and a re-baseline of `data/pastPuzzles.test.ts`, which this feature already owes
once for the growth to sixty and would owe a second time for the pull. Deliberately
no mechanism was added to prevent any of it. Cost of reversal: an assumption is
prose — deleting it costs nothing and changes no code.
Changed: Assumptions (one entry, five parts).
