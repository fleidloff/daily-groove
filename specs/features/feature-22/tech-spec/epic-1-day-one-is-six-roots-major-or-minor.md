# Tech spec — Epic 1: Day one is six roots, Major or Minor

PRD: [../prd/epic-1-day-one-is-six-roots-major-or-minor.md](../prd/epic-1-day-one-is-six-roots-major-or-minor.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

The whole epic is one rule — *stored value wins; otherwise Simple for no
results, full set for any result, and write the answer down* — and it lives in
one hook, `hooks/useSimpleMode.ts`. Two things stand in its way today. The
preference store collapses "never stored" into `false`, so the hook cannot see
the branch it needs; and the hook has no view of the results at all. The spec
fixes the first by making `simpleMode` optional on `Preferences` (absent means
never stored) and the second by handing the hook a `ResultStore` and letting it
read `getAll()` itself, alongside the preferences, in one `Promise.allSettled`.
The composer then gates the page on the hook's `loaded` flag exactly as it gates
on `hydrated` today, so the card is never drawn with a set that is about to
change.

The blast radius is not the source, it is the tests: every composed-page test in
the slice starts with an empty `localStorage` and an empty results mock, which
today means the full set and tomorrow means Simple. So the largest track is the
one that seeds `simpleMode: false` into those files' `beforeEach` before the
default flips, and writes the new first-visit tests in a file of their own,
`components/GroovePuzzle.firstVisit.test.tsx`. That track runs in Wave 1,
parallel with the store change, so the suite never passes through a red wave.

## Architecture

Nothing moves. Every file touched is already in the puzzle module or the shell,
and no new arrow is drawn in `docs/architecture.md`'s map:

- `lib/persistence/preferences.ts` — the store learns to report an absent
  `simpleMode`. It gains no new method; the read shape changes by one `?`.
- `hooks/useSimpleMode.ts` — the rule. It now imports
  `../lib/persistence/storage` for the `ResultStore` type and a default local
  store, which `hooks/useProgress.ts` already does; puzzle → puzzle, inside the
  module, named by no zone.
- `components/GroovePuzzle.tsx` — two lines: the hook call passes the route's
  result store, and the loading gate reads the hook's `loaded`. Nothing else in
  the composer changes, so Epic 2's edits to the same file (the caption under
  `PlayControl`, the credit in `GrooveCard`) do not overlap a single line.
- `testing/puzzleHarness.tsx` — gains `seedFullSet()`, the one-line seed the
  existing page tests need to keep the set they were written against.

### Why the hook reads the results itself

The PRD leaves the wiring open: the hook can take the result store or a loaded
flag. Threading a flag through `usePuzzleSession` is circular in render order —
`usePuzzleSession(groove, today, simple, resultStore)` needs `simple`, and a
`useSimpleMode(session.hasResults)` would need the session — so one of the two
would have to lag a render, and the gate would have to reason about that lag.
Reading `getAll()` a second time is a `localStorage.getItem` and a `JSON.parse`,
in the same tick as the read `useProgress` is already doing, and it makes the
hook self-contained: one input for prefs, one for results, one `loaded` that
means both are known. The shared route hands the hook the same
`createReadOnlyStore(createLocalStore())` it hands the session; `getAll`
forwards to the inner store, so a daily result counts there too (R7).

### The rule, as the hook runs it

```
on mount, allSettled([prefs.get(), results.getAll()]):
  stored   = prefs fulfilled ? prefs.simpleMode : undefined
  if stored is boolean          → simple = stored          (R4)
  else
    hasResults = results fulfilled && length > 0
    simple = !hasResults                                    (R1, R3, R8)
    if both reads fulfilled     → prefs.update({ simpleMode: simple })   (R2, R3)
  loaded = true                                             (R6)
```

The write is skipped when either read rejected: a store that cannot be read is
not one to be written to, and a results read that failed must not pin a veteran
to Simple for good. That is R8's "the choice is simply not remembered".

### Why the first-visit tests get a new file

`GroovePuzzle.firstVisit.test.tsx` needs one thing the six existing composed
tests do not: a preference store whose `get` can be held open, to prove the gate
deterministically (AC6). It gets that the way the six already get their result
store — a `vi.mock('../lib/persistence/preferences')` whose
`createLocalPreferenceStore` delegates to the real one and awaits an optional
gate first. A shell test mocking a puzzle-module path is the same arrow the
shell already draws in source (shell → every module), and the same pattern the
six files use for `../lib/persistence/storage`. Putting it in a seventh file
keeps the mock out of the six, and keeps this epic's test ownership disjoint
from Epic 2's (`GroovePuzzle.copy.test.tsx`).

## Contracts

Frozen. Every track builds against these; none may change them mid-flight.

```ts
// src/features/daily-groove/lib/persistence/preferences.ts
export type Preferences = {
  simpleMode?: boolean   // absent = never stored; a non-boolean in the blob reads as absent
  tapSounds: boolean
}

export type PreferenceStore = {
  get(): Promise<Preferences>
  update(patch: Partial<Preferences>): Promise<void>
}
// STORAGE_KEY stays 'daily-groove:v1:prefs'. update() still merges the patch
// over the current read, so update({ simpleMode: true }) on an empty store
// writes { tapSounds: true, simpleMode: true }.
```

```ts
// src/features/daily-groove/hooks/useSimpleMode.ts
export type UseSimpleMode = {
  simple: boolean
  setSimple: (simple: boolean) => void
  loaded: boolean          // true only once prefs AND results are known
}

export type UseSimpleModeDeps = {
  prefs?: PreferenceStore  // default: createLocalPreferenceStore(), module-level
  results?: ResultStore    // default: createLocalStore(), module-level
}

export function useSimpleMode(deps?: UseSimpleModeDeps): UseSimpleMode
```

```ts
// src/features/daily-groove/testing/puzzleHarness.tsx — added
export async function seedFullSet(): Promise<void>
// = seedPreferences({ simpleMode: false }). The one seed a page test needs to
// keep today's twelve-root card while starting from an empty localStorage.
```

```tsx
// src/features/daily-groove/components/GroovePuzzle.tsx — the only two edits
const { simple, setSimple, loaded: modeLoaded } = useSimpleMode({ results: resultStore })
// …
if (!hydrated || !modeLoaded) return <PuzzleLoading />
```

`PuzzleSessionValue`, `UsePuzzleSession`, `ResultStore`, `ModeToggle`,
`Switch` and every snippet are unchanged.

## Tracks

### Track A — The store tells "absent" from "false"

- **Goal** — `createLocalPreferenceStore().get()` on an empty, corrupt or
  legacy blob returns a `Preferences` with no `simpleMode` key; a stored
  boolean comes back as itself; `update` merges as before.
- **Owns** — `src/features/daily-groove/lib/persistence/preferences.ts`,
  `src/features/daily-groove/lib/persistence/preferences.test.ts`
- **Role** — `implementer`
- **Depends on** — the `Preferences` contract only
- **Parallel with** — Track C
- **Done when** — `preferences.test.ts` passes with the rewritten cases,
  `useTapSounds.test.ts` still passes untouched, and `npx tsc --noEmit` is clean.

### Track B — The hook decides, and writes the decision down

- **Goal** — `useSimpleMode` implements the rule above, takes `{ prefs, results }`,
  and reports `loaded` only once both reads have settled.
- **Owns** — `src/features/daily-groove/hooks/useSimpleMode.ts`,
  `src/features/daily-groove/hooks/useSimpleMode.test.ts`
- **Role** — `implementer`
- **Depends on** — Track A's `Preferences` type (its fixtures omit `simpleMode`,
  which does not compile against today's type)
- **Parallel with** — nothing; Wave 2 alone
- **Done when** — `useSimpleMode.test.ts` passes; the composer still compiles
  because `useSimpleMode()` with no argument remains valid.

### Track C — The page tests keep their set, and the first visit gets its own

- **Goal** — every existing composed-page test seeds `simpleMode: false` so the
  flip in Wave 3 changes nothing it asserts; `seedFullSet` exists;
  `GroovePuzzle.firstVisit.test.tsx` exists and is red for the right reasons.
- **Owns** — `src/features/daily-groove/testing/puzzleHarness.tsx`,
  `src/features/daily-groove/components/GroovePuzzle.firstVisit.test.tsx` (new),
  `src/features/daily-groove/structure.test.ts` (one entry in `composedTests`),
  and the `beforeEach` of these seven files and nothing else in them:
  `components/GroovePuzzle.page.test.tsx`, `GroovePuzzle.guessing.test.tsx`,
  `GroovePuzzle.sounding.test.tsx`, `GroovePuzzle.intro.test.tsx`,
  `GroovePuzzle.header.test.tsx`, `GroovePuzzle.copy.test.tsx`,
  `components/puzzle/GuessCard.test.tsx`
- **Role** — `test-writer`
- **Depends on** — the contracts only. It writes against the frozen
  `seedFullSet` and the page's behaviour, not against Track B's code.
- **Parallel with** — Track A
- **Done when** — `npm test` is green in every file except
  `GroovePuzzle.firstVisit.test.tsx`, whose cases fail with the failures each
  step names below (not with a compile or import error).

### Track D — The composer waits for the mode

- **Goal** — the page passes the route's result store to the hook and shows the
  loading line until `modeLoaded`.
- **Owns** — `src/features/daily-groove/components/GroovePuzzle.tsx` — the hook
  call and the gate line only
- **Role** — `implementer`
- **Depends on** — Track B (the `deps` signature), Track C (the red tests it
  turns green, and the seeds that keep the rest green)
- **Parallel with** — nothing; Wave 3 alone
- **Done when** — `npm test`, `npm run lint`, `npx tsc --noEmit` and
  `npm run build` are all clean, and the demo path below holds.

## Execution waves

- **Wave 1 (parallel):** Track A, Track C
- **Wave 2:** Track B — needs A's `Preferences` type
- **Wave 3:** Track D — needs B's signature and C's tests
- **Wave 4:** Integration — the demo path, `/verify-epic`

## Implementation

### Track A — The store tells "absent" from "false"

#### Step A1 — Nothing stored means no `simpleMode` key

Covers: R1, R4 (the store half), AC1

- **Test first** — `lib/persistence/preferences.test.ts`: replace
  `'defaults to off when nothing was ever stored (E5 A3, F16 E2 R2, AC2)'` with
  `'holds no simpleMode when nothing was ever stored (F22 E1 R1, R4)'`:
  `await expect(createLocalPreferenceStore().get()).resolves.toStrictEqual({ tapSounds: true })`
  and `expect('simpleMode' in prefs).toBe(false)`. Run it: fails with
  `expected { simpleMode: false, tapSounds: true } to strictly equal { tapSounds: true }`.
- **Implement** — `lib/persistence/preferences.ts`: `Preferences.simpleMode`
  becomes optional. `defaultPreferences()` returns `{ tapSounds: true }`.
  `readPreferences()` builds the result as
  `{ tapSounds: booleanField(parsed, 'tapSounds'), ...(typeof parsed.simpleMode === 'boolean' ? { simpleMode: parsed.simpleMode } : {}) }`
  so the key is *absent*, not `undefined`. `booleanField` narrows to
  `key: 'tapSounds'` or is replaced by an inline check — either, as long as no
  default for `simpleMode` survives in the file.
- **Green when** — the new case passes; `'round-trips a saved preference'`,
  `'merges a patch…'`, `'persists across a fresh store…'` and the legacy-blob
  cases pass unchanged (they all store a boolean).
- **Refactor** — none.

#### Step A2 — A corrupt or wrong-shaped `simpleMode` reads as absent

Covers: R4, R8

- **Test first** — `preferences.test.ts`: in
  `'defaults to off when the stored value is corrupt JSON'`,
  `'defaults to off when the stored blob is the wrong shape'` and
  `'one corrupt field does not cost the good one beside it'`, every expected
  `{ simpleMode: false, tapSounds: X }` becomes `toStrictEqual({ tapSounds: X })`;
  rename the first two to `'holds no simpleMode when…'`. Run: each fails with
  the strict-equal diff naming `simpleMode: false`.
- **Implement** — falls out of A1; no further source change expected.
- **Green when** — all three pass; `'falls back to the default when getItem
  throws'` is updated the same way and passes.
- **Refactor** — none.

#### Step A3 — A patch onto an empty store writes only what it names, plus `tapSounds`

Covers: R2, R5

- **Test first** — `preferences.test.ts`, new case
  `'writes the first-visit decision as a patch, beside the default tapSounds (F22 E1 R2, R5)'`:
  `await store.update({ simpleMode: true })`; then
  `JSON.parse(localStorage.getItem(PREFS_KEY))` `toStrictEqual({ tapSounds: true, simpleMode: true })`;
  and a second case `update({ tapSounds: false })` on an empty store yields
  `toStrictEqual({ tapSounds: false })` — no `simpleMode` invented by the write.
  Run: the second fails with `simpleMode: false` in the diff.
- **Implement** — falls out of A1 (`update` spreads `readPreferences()`, which
  no longer carries a `simpleMode`).
- **Green when** — both pass.
- **Refactor** — none.

### Track B — The hook decides, and writes the decision down

All fixtures in `useSimpleMode.test.ts` move to the new signature:
`useSimpleMode({ prefs: store })` where they read `useSimpleMode(store)` today,
and `makeStore` gains a second helper `makeResults(results: DailyResult[] = [])`
returning a `ResultStore` mock (`get`, `getAll: vi.fn(async () => results)`,
`save`). A `DailyResult` fixture `SOME_DAY` with `date: '2026-08-20'` is enough;
a `LAPSED_DAY` with `date: '2026-01-01'` covers the lapse case. The existing
seven cases stay, with `makeStore()` now defaulting to
`{ simpleMode: false, tapSounds: true }` (a *stored* false), so they keep
meaning what they meant.

#### Step B1 — No stored value, no results: Simple, and written

Covers: R1, R2, AC1, AC2

- **Test first** — `'starts Simple, and writes that down, when nothing is stored and nothing is saved (F22 E1 R1, R2, AC1, AC2)'`:
  `makeStore({ tapSounds: true })`, `makeResults([])`; render
  `useSimpleMode({ prefs: store, results })`; `waitFor(loaded === true)`;
  `expect(result.current.simple).toBe(true)`;
  `expect(store.update).toHaveBeenCalledTimes(1)` and
  `toHaveBeenCalledWith({ simpleMode: true })`; `saved()` `toEqual({ simpleMode: true, tapSounds: true })`.
  Run: fails on the first assertion (`useSimpleMode` ignores the argument shape
  today and reads `prefs.simpleMode` as `undefined`, so `simple` is
  `undefined`) — `expected undefined to be true`.
- **Implement** — `hooks/useSimpleMode.ts`: new signature per the contract; a
  module-level `defaultResults = createLocalStore()` imported from
  `../lib/persistence/storage`; the effect runs
  `Promise.allSettled([prefs.get(), results.getAll()])` and applies the rule in
  *The rule, as the hook runs it*. Keep the existing
  `react-hooks/set-state-in-effect` disable block and the `active` unmount
  guard. The write goes through the same `void Promise.resolve(…).catch(() => {})`
  shape `setSimple` uses.
- **Green when** — B1 passes and the seven pre-existing cases still pass.
- **Refactor** — pull the decision into a pure `decide(stored, hasResults)`
  inside the file if the effect body reads longer than the rule; do not export
  it.

#### Step B2 — No stored value, any result: full set, and written

Covers: R3, AC3

- **Test first** — `'keeps the full set, and writes that down, for a player with results and nothing stored (F22 E1 R3, AC3)'`:
  `makeStore({ tapSounds: true })`, `makeResults([SOME_DAY])`; `simple` is
  `false`, `store.update` called once with `{ simpleMode: false }`. Run: fails
  with `expected 0 to be 1` on the call count (B1's implementation done first
  makes this green — so write B2's test *before* B1's implementation and watch
  both go red together; the spec lists them apart for traceability).
- **Implement** — covered by B1.
- **Green when** — passes.
- **Refactor** — none.

#### Step B3 — A stored value wins over any result count

Covers: R4, AC4

- **Test first** — two cases.
  `'a stored false stays the full set with no results (F22 E1 R4, AC4)'`:
  `makeStore({ simpleMode: false, tapSounds: true })`, `makeResults([])` →
  `simple` `false`, `store.update` **not called**.
  `'a stored true stays Simple with forty results (F22 E1 R4, AC4)'`:
  `makeResults(Array.from({ length: 40 }, (_, i) => day(i)))` → `simple` `true`,
  `update` not called. Run against a hook that always applies the result rule:
  the first case fails on `update` having been called.
- **Implement** — covered by B1's "stored is boolean → use it" branch.
- **Green when** — both pass.
- **Refactor** — none.

#### Step B4 — A lapsed player is not a first-time player

Covers: R4 (the roadmap's "lapsed player untouched")

- **Test first** — `'gives the full set to a lapsed player with nothing stored — a lapse is not a first visit (F22 E1 R4)'`:
  `makeStore({ tapSounds: true })`, `makeResults([LAPSED_DAY])` → `simple`
  `false`, `update` called with `{ simpleMode: false }`. Run: same failure shape
  as B2.
- **Implement** — nothing beyond B1; the hook never reads a date. The test is
  what keeps someone from wiring `isNewOrLapsed` in later.
- **Green when** — passes.
- **Refactor** — none.

#### Step B5 — `loaded` waits for both reads

Covers: R6, AC6

- **Test first** — two cases with a held promise, in the shape of the existing
  `'a load that resolves after unmount sets no state'`.
  `'is not loaded while the results are still pending, even with a stored preference (F22 E1 R6, AC6)'`:
  prefs resolve `{ simpleMode: true, tapSounds: true }` at once; `getAll` is a
  pending promise. After `await act(settle)`, `loaded` is `false`; release with
  `[]`; `waitFor(loaded)`; `simple` is `true`.
  `'is not loaded while the preferences are still pending, even with results known (F22 E1 R6)'`:
  the mirror image. Run against a hook that sets `loaded` on the prefs read
  alone: the first fails with `expected true to be false`.
- **Implement** — covered by `allSettled` in B1.
- **Green when** — both pass.
- **Refactor** — none.

#### Step B6 — A rejecting read still decides, and writes nothing

Covers: R8, AC8

- **Test first** — three cases.
  `'a preference read that rejects still lands on Simple for no results, without writing (F22 E1 R8, AC8)'`:
  `get: vi.fn(async () => { throw new Error('SecurityError') })`,
  `makeResults([])` → `loaded` `true`, `simple` `true`, `update` not called.
  `'a results read that rejects still decides for the session, without writing (F22 E1 R8)'`:
  `getAll` rejects, prefs `{ tapSounds: true }` → `simple` `true`, `loaded`
  `true`, `update` not called.
  `'a first-visit write that rejects costs nothing (F22 E1 R8)'`: `update`
  throws, prefs `{ tapSounds: true }`, no results → `simple` `true`, `loaded`
  `true`, no unhandled rejection (the test passes without vitest reporting
  one). Run against today's `store.get().then(…)`: the first never sets
  `loaded`, so `waitFor` times out — `Timed out in waitFor`.
- **Implement** — covered by `allSettled` and the both-fulfilled write guard in
  B1; the write's `.catch(() => {})` covers the third.
- **Green when** — all three pass.
- **Refactor** — none.

#### Step B7 — Flipping the switch writes a patch, and leaves `tapSounds` alone

Covers: R5, AC5

- **Test first** — the existing
  `'setSimple(true) updates the returned value and writes through'` and
  `'writes a patch, so the preference beside it is left alone'` stay as they
  are. Add one: `'a flip after a first-visit default is written once more, as a patch (F22 E1 R5, AC5)'`:
  `makeStore({ tapSounds: false })`, `makeResults([])`; `waitFor(loaded)`;
  `saved()` is `{ tapSounds: false, simpleMode: true }`; `act(setSimple(false))`;
  `store.update` called twice, last with `{ simpleMode: false }`; `saved()` is
  `{ tapSounds: false, simpleMode: false }`. Run before B1: fails on
  `saved()` still lacking `simpleMode`.
- **Implement** — nothing new; `setSimple` is unchanged.
- **Green when** — passes.
- **Refactor** — none.

### Track C — The page tests keep their set, and the first visit gets its own

#### Step C1 — `seedFullSet` in the harness

Covers: R3 (keeps the veteran path testable), scaffolding for every C step

- **Test first** — none of its own; it is a fixture. Its red is C2.
- **Implement** — `testing/puzzleHarness.tsx`:
  `export async function seedFullSet() { await seedPreferences({ simpleMode: false }) }`.
- **Green when** — the file compiles.
- **Refactor** — none.

#### Step C2 — The seven composed-page test files start from a stored full set

Covers: R3, R9 (nothing about the full puzzle changes for a player who has it)

- **Test first** — this step exists so the tests in these files keep their
  subject when Wave 3 lands. Before editing, note the count `npm test` reports
  for the seven files; that number is the assertion.
- **Implement** — in each of the six `GroovePuzzle.*.test.tsx` files the
  `beforeEach(() => { resetMockStore(mockStore); installPuzzleAudio() })`
  becomes `beforeEach(async () => { resetMockStore(mockStore); await seedFullSet(); installPuzzleAudio() })`
  with `seedFullSet` added to the harness import. In
  `components/puzzle/GuessCard.test.tsx` the `beforeEach` gains
  `await seedFullSet()` directly after `clearStored()`. **No other line in
  these files changes.** Cases that later call `seedPreferences({ simpleMode: true })`
  or write a legacy blob with `localStorage.setItem` override the seed, since
  `update` merges and `setItem` replaces; cases that assert the prefs blob
  after a flip see `{ simpleMode: …, tapSounds: … }` exactly as before, because
  the old code's default `false` and the new seed's stored `false` merge to the
  same bytes.
- **Green when** — `npm test` reports the same pass count for the seven files
  as before the edit.
- **Refactor** — none. The four region tests that also render the page
  (`header/GrooveHeader.test.tsx`, `puzzle/GrooveCard.test.tsx`,
  `puzzle/SharedGrooveNotice.test.tsx`, `puzzle/TransportPanel.test.tsx`)
  assert nothing about the root or mode groups and get no seed; if Wave 3
  proves one of them wrong, it gets the same one-line `beforeEach` edit and the
  epic report says which.

#### Step C3 — The new file, its mocks, and the structural entry

Covers: scaffolding for C4–C10; keeps `structure.test.ts` honest

- **Test first** — `structure.test.ts`, case
  `'holds only the root component at the components/ root'`: add
  `'GroovePuzzle.firstVisit.test.tsx'` to `composedTests`. Run: fails with
  `expected [ 'GroovePuzzle.firstVisit.test.tsx' ] to deeply equal []`.
- **Implement** — create `components/GroovePuzzle.firstVisit.test.tsx` with the
  same header as `GroovePuzzle.page.test.tsx`: `vi.hoisted` `mockStore`,
  `vi.mock('../lib/persistence/storage', …)` swapping `createLocalStore`. Add
  the second mock:

  ```ts
  const { prefsGate } = vi.hoisted(() => ({ prefsGate: { hold: null as Promise<void> | null } }))
  vi.mock('../lib/persistence/preferences', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../lib/persistence/preferences')>()
    return {
      ...actual,
      createLocalPreferenceStore: () => {
        const real = actual.createLocalPreferenceStore()
        return {
          async get() { if (prefsGate.hold) await prefsGate.hold; return real.get() },
          update: (patch) => real.update(patch),
        }
      },
    }
  })
  ```

  `beforeEach`: `resetMockStore(mockStore)`, `prefsGate.hold = null`,
  `installPuzzleAudio()`. No `seedFullSet` here — this file is about the empty
  store. Helpers: `modeSwitch()` as in `GroovePuzzle.guessing.test.tsx:673`,
  `chipTexts(group)` as in `GroovePuzzle.sounding.test.tsx:96`,
  `renderShared()` = `renderPuzzle(<GroovePuzzle groove={GROOVE} mode="shared" />)`,
  `storedPrefs()` = `JSON.parse(localStorage.getItem('daily-groove:v1:prefs') ?? 'null')`,
  and `day(daysAgo)` building a solved `DailyResult` for `isoDate(new Date() - daysAgo)`.
- **Green when** — the structure case passes and the new file loads with zero
  cases (`passWithNoTests` is on).
- **Refactor** — none.

#### Step C4 — Empty storage: six roots, two modes, switch on

Covers: R1, AC1

- **Test first** — `'gives a first-time player six roots, Major or Minor, and the switch on (F22 E1 R1, AC1)'`:
  `await renderPuzzle()`; `chipTexts(rootGroup())` `toHaveLength(6)` and
  `toEqual(simpleRootOptions(new Date(), ANSWER))`; `chipTexts(flavourGroup())`
  `toEqual(FAMILIES)`; `modeSwitch()` `toHaveAttribute('aria-checked', 'true')`.
  Run: fails with `expected [ 'C', 'D♭', … ] to have a length of 6 but got 12`.
- **Implement** — Track D. This step is red until Wave 3.
- **Green when** — D1 lands.
- **Refactor** — none.

#### Step C5 — The decision is written, and holds on day two

Covers: R2, AC2

- **Test first** — `'writes simpleMode: true on the first visit, and is still Simple tomorrow with a result saved (F22 E1 R2, AC2)'`:
  `const first = await renderPuzzle()`; `storedPrefs()` `toEqual({ tapSounds: true, simpleMode: true })`;
  `first.unmount()`; `mockStore.getAll.mockResolvedValue([day(1)])`;
  `await renderPuzzle()`; `chipTexts(rootGroup())` `toHaveLength(6)`;
  `modeSwitch()` checked. Run: fails on `storedPrefs()` being `null`.
- **Implement** — Track D.
- **Green when** — D1 lands.
- **Refactor** — none.

#### Step C6 — A result and no preference: the full set, written down

Covers: R3, AC3

- **Test first** — `'keeps the full set for a player with a result and nothing stored, and writes that down (F22 E1 R3, AC3)'`:
  `mockStore.getAll.mockResolvedValue([day(1)])`; `await renderPuzzle()`;
  `chipTexts(rootGroup())` `toHaveLength(12)`; `chipTexts(flavourGroup())`
  `toEqual(flavours())`; `modeSwitch()` `aria-checked` `'false'`;
  `storedPrefs()` `toEqual({ tapSounds: true, simpleMode: false })`. Run: the
  chips pass today; fails on `storedPrefs()` being `null`.
- **Implement** — Track D.
- **Green when** — D1 lands.
- **Refactor** — none.

#### Step C7 — A stored value is the only thing consulted

Covers: R4, AC4

- **Test first** — `it.each` over two rows:
  `['false with no results', { simpleMode: false }, [], 12]` and
  `['true with forty results', { simpleMode: true }, Array.from({ length: 40 }, (_, i) => day(i)), 6]`:
  `await seedPreferences(prefs)`; `mockStore.getAll.mockResolvedValue(results)`;
  `await renderPuzzle()`; `chipTexts(rootGroup())` `toHaveLength(expected)`;
  `storedPrefs().simpleMode` `toBe(prefs.simpleMode)`. Run: both pass today
  (a stored value already wins). This case is a regression guard, and the spec
  says so rather than inventing a red; its red is B3 at the hook.
- **Implement** — none.
- **Green when** — stays green through Wave 3.
- **Refactor** — none.

#### Step C8 — Flipping the first-time switch off is remembered, `tapSounds` untouched

Covers: R5, AC5

- **Test first** — `'remembers a first-time player turning the switch off, and leaves tapSounds alone (F22 E1 R5, AC5)'`:
  `await seedPreferences({ tapSounds: false })` (so the field has a non-default
  value to lose); `const first = await renderPuzzle()`; `modeSwitch()` checked;
  `await user.click(modeSwitch())`; `await settle()`; `storedPrefs()`
  `toEqual({ tapSounds: false, simpleMode: false })`; `first.unmount()`;
  `await renderPuzzle()`; `chipTexts(rootGroup())` `toHaveLength(12)`;
  `modeSwitch()` unchecked. Run: fails on the first `modeSwitch()` check —
  `expected … to have attribute aria-checked="true", received "false"`.
- **Implement** — Track D.
- **Green when** — D1 lands.
- **Refactor** — none.

#### Step C9 — The card is not drawn until the mode is known

Covers: R6, AC6

- **Test first** — `'shows the loading line, and no root group, until the preference is read (F22 E1 R6, AC6)'`:
  `await seedPreferences({ simpleMode: true })`; `let release!: () => void`;
  `prefsGate.hold = new Promise((r) => { release = r })`;
  `await renderPuzzle()` (results resolve, prefs do not);
  `screen.getByText(puzzle.loading)` is in the document;
  `screen.queryByRole('radiogroup', { name: puzzle.rootGroup })` is `null`;
  then `await act(async () => { release(); })`; `await settle()`;
  `chipTexts(rootGroup())` `toHaveLength(6)`. Run today: `hydrated` is true
  and `simple` is still its initial `false`, so the page draws twelve chips —
  fails with `Unable to find an element with the text: Loading today's groove…`.
  This is the deterministic red the gate line needs; the hook's B5 is its
  twin.
- **Implement** — Track D's gate.
- **Green when** — D1 lands.
- **Refactor** — none.

#### Step C10 — The shared route follows the same rule

Covers: R7, AC7

- **Test first** — two cases.
  `'starts a first-time player in Simple on a shared groove (F22 E1 R7, AC7)'`:
  `await renderShared()`; six root chips; `modeSwitch()` checked;
  `storedPrefs()` `toEqual({ tapSounds: true, simpleMode: true })` — the
  preference is written even though the result store is read-only.
  `'gives a player with a daily result the full set on a shared groove (F22 E1 R7, AC7)'`:
  `mockStore.getAll.mockResolvedValue([day(1)])`; `await renderShared()`;
  twelve chips; `storedPrefs().simpleMode` `toBe(false)`. Run: the first fails
  with `…to have a length of 6 but got 12`.
- **Implement** — Track D (the hook receives the read-only store, whose
  `getAll` forwards).
- **Green when** — D1 lands.
- **Refactor** — none.

#### Step C11 — Storage that throws still lands on Simple, quietly

Covers: R8, AC8

- **Test first** — `'lands on Simple, and says nothing, when storage cannot be read (F22 E1 R8, AC8)'`:
  `const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new Error('SecurityError') })`;
  `const complained = vi.spyOn(console, 'error').mockImplementation(() => {})`;
  in a `try`: `await renderPuzzle()`; six root chips; `modeSwitch()` checked;
  `complained` not called; `finally` restore both. Run: fails on the chip count.
- **Implement** — Track D; the store already swallows the throw (Track A keeps
  that), and the hook's `allSettled` covers a store that rejects.
- **Green when** — D1 lands.
- **Refactor** — none.

#### Step C12 — A first-time Simple solve records like any Simple solve

Covers: R9, AC9

- **Test first** — `'solves and records the day for a first-time player checking root and family (F22 E1 R9, AC9)'`:
  `await renderPuzzle()`; `await guess(user, 'C', 'Minor')`; `control()`
  `toHaveAccessibleName(coaching.checkSolved)`; `screen.getByRole('heading', { name: 'C Aeolian' })`
  present; `mockStore.save` called once with `expect.objectContaining({ solved: true, grooveId: GROOVE.id })`
  and `attempts` of length 1 with `correct: true`. Run: fails at `guess` —
  `Unable to find an accessible element with the role "button" and name "Minor"`
  (the full set offers `flavours()`, not `FAMILIES`).
- **Implement** — Track D; nothing about scoring changes.
- **Green when** — D1 lands.
- **Refactor** — none.

### Track D — The composer waits for the mode

#### Step D1 — Wire the store in, gate the page on `loaded`

Covers: R1, R2, R3, R6, R7, AC1–AC3, AC5–AC9 (turns C4–C6, C8–C12 green)

- **Test first** — the Track C file, red as left by Wave 1. Run
  `npx vitest run src/features/daily-groove/components/GroovePuzzle.firstVisit.test.tsx`
  and confirm the nine failures named in C4–C6 and C8–C12 before touching the
  composer.
- **Implement** — `components/GroovePuzzle.tsx`, two edits and no other:
  `const { simple, setSimple, loaded: modeLoaded } = useSimpleMode({ results: resultStore })`
  and `if (!hydrated || !modeLoaded) return <PuzzleLoading />`. `resultStore`
  is already `undefined` on the daily route (the hook falls back to its default
  local store, which the tests' `vi.mock` also swaps) and the read-only wrapper
  on the shared route.
- **Green when** — `npm test` is fully green, including the seven seeded files
  and the four unseeded region tests. If `settle()`'s three microtask ticks
  prove one short for `allSettled` plus the gate (a symptom would be
  `renderPuzzle()` returning with the loading line still up in a case that does
  not hold the gate), add one `await Promise.resolve()` to `settle()` and
  `settleFeature()` in the harness rather than sprinkling `waitFor` — and say
  so in the report. Track C owns the harness, so this is a hand-back, not a
  second owner.
- **Refactor** — none. Epic 2 owns every other line of this file this wave.

## Integration and verification

- **Sequencing with Epic 2.** Both epics edit `components/GroovePuzzle.tsx`.
  This epic's edit is two lines — the `useSimpleMode` call (line 104 today)
  and the `if (!hydrated)` gate (line 210 today) — and touches neither the
  `PlayControl` block Epic 2 removes the caption from nor the `GrooveCard`
  Epic 2 adds the credit to. `/implement-feature` should land Track D after
  or before Epic 2's shell unit, not concurrently; a three-way merge is
  trivial but a concurrent write to one file is not safe. No other file
  overlaps: Epic 2's tests are `ModeToggle.test.tsx`, `Switch.test.tsx`,
  `HowToPlay.test.tsx`, `GrooveCard.test.tsx`, `GroovePuzzle.copy.test.tsx`
  (Epic 2 rewrites caption assertions there; Track C adds one `await
  seedFullSet()` to its `beforeEach` — two disjoint hunks in one file, so
  sequence, do not parallelise, those two units either).
- **The demo path**, run in the browser after D1:
  1. DevTools → Application → clear `localStorage`. Reload `/`. Six root
     chips, Major and Minor, switch on. `daily-groove:v1:prefs` now reads
     `{"tapSounds":true,"simpleMode":true}`.
  2. Reload. Same card.
  3. Flip the switch off. Reload. Twelve roots, four modes; the blob reads
     `simpleMode: false`.
  4. Clear storage again; set `daily-groove:v2:results` to a v2 envelope with
     one solved day. Reload. Twelve roots, switch off, and the prefs blob
     now holds `simpleMode: false` it did not hold before.
  5. Open a `/groove/<uuid>` link for a groove that is not today's, with
     storage cleared. Six roots. The result envelope stays absent after a
     guess; the prefs blob holds `simpleMode: true`.
  6. At no point during a reload does a twelve-chip group flash before a
     six-chip one — throttle to "Slow 3G" in DevTools and watch the loading
     line hold instead.
- **Full checks**: `npm test`, `npm run lint`, `npx tsc --noEmit`,
  `npm run build`. Then `/verify-epic feature-22 epic-1`.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1, B1, C4, D1 |
| R2 | A3, B1, C5, C10, D1 |
| R3 | B2, C2, C6, C10, D1 |
| R4 | A1, A2, B3, B4, C7 |
| R5 | A3, B7, C8 |
| R6 | B5, C9, D1 |
| R7 | C10, D1 |
| R8 | A2, B6, C11 |
| R9 | C2, C12 |
| AC1 | A1, B1, C4 |
| AC2 | B1, C5 |
| AC3 | B2, C6 |
| AC4 | B3, C7 |
| AC5 | B7, C8 |
| AC6 | B5, C9 |
| AC7 | C10 |
| AC8 | B6, C11 |
| AC9 | C12 |

## Assumptions

- **The hook reads `getAll()` itself** rather than receiving a flag from
  `useProgress`. The second read is a `localStorage.getItem` in the same tick;
  the alternative is a render-order lag between two hooks that feed each other.
  Reversible in an afternoon if `useProgress` ever grows a shared results
  context.
- **`simpleMode` becomes optional on `Preferences`; `tapSounds` does not.**
  The asymmetry is honest: `tapSounds` still has a default the store owns, and
  `simpleMode` no longer does — its default is a rule about results, which is
  the hook's business, not the store's.
- **A non-boolean `simpleMode` in the blob reads as "never stored"**, so a
  corrupt field gets the first-visit rule and is rewritten. Today it reads as
  `false`. No player has a corrupt field on purpose.
- **The first-visit write is skipped when either read rejected.** A store that
  cannot be read should not be written to, and a failed results read must not
  pin a veteran to Simple. The local stores never reject, so in production this
  branch is reached only by an injected store; the cost is one `status` check.
- **`hooks/useSimpleMode.ts` importing `lib/persistence/storage`** is filed
  under puzzle → puzzle in the module map and named by no zone. No entry in
  `docs/architecture.md` changes. The "five `GroovePuzzle.*.test.tsx` files"
  sentence there was already six and becomes seven; it is a count in a doc,
  not a guard, and is left for a later sweep.
- **The seven existing files get `seedFullSet()` in `beforeEach`** rather
  than a global seed in `vitest.setup.ts`. A global seed would hide the new
  default from every test in the repo, including the ones that exist to see it.
- **The new composed test mocks `../lib/persistence/preferences`** the way the
  six existing ones mock `../lib/persistence/storage`. It is the only way to
  hold the preference read open at page level, and it is an intra-slice mock
  from the shell, which reaches every module in source too. If the project
  later decides shell tests may mock no `lib/` path, C9's page-level case is
  deleted and B5 carries AC6 alone.
- **The four region tests that render the page get no seed** because none
  asserts on the root or mode group. Wave 3 is the check; a false assumption
  costs one line per file.
- **`Promise.allSettled`** is available: `tsconfig` targets `esnext` libs and
  the app runs in browsers that have had it since 2020.

## Decision log

### Cycle 1 — 2026-09-03

**Q1. How does the hook learn whether any result exists?**
Decision: **the hook takes a `ResultStore` and reads `getAll()` itself.** The
PRD offered this or a loaded flag from `useProgress`; the flag is circular in
render order with `usePuzzleSession`'s `simple` argument. Cost: one duplicate
`localStorage` read per mount, and `useSimpleMode` growing an import it did not
have (`../lib/persistence/storage`, same module).
Changed: Contracts (`UseSimpleModeDeps`), Track B, Track D's one-line call.

**Q2. How does the store tell "never stored" from "stored false"?**
Decision: **`Preferences.simpleMode` becomes optional; absent means never
stored.** Rejected: a separate `has()`/`stored()` method (a third method every
mock must implement, for one field) and a nullable `boolean | null` (a
sentinel the type would carry into every consumer). Cost: `preferences.test.ts`
rewrites its four "defaults to off" expectations; `useTapSounds.test.ts` and
every other `Preferences` fixture keep compiling because the field is optional.
Changed: Contracts, Track A.

**Q3. Where do the page-level first-visit tests live, and how is AC6 made
deterministic?**
Decision: **a seventh composed test file, `GroovePuzzle.firstVisit.test.tsx`,
with a delegating mock of `createLocalPreferenceStore` that can hold `get()`
open.** Without a held read, the composer's gate has no reliable red: `act`
flushes intermediate commits, and prefs and results resolve within a tick of
each other. Cost: one more `vi.mock` of an intra-slice path in the shell's
tests, in one file; one list entry in `structure.test.ts`.
Changed: Track C (C3, C9), Architecture (*Why the first-visit tests get a new
file*).

**Q4. What keeps the existing suite green when the default flips?**
Decision: **`seedFullSet()` in the `beforeEach` of the seven files that render
the page against an empty results mock and assert on the set.** Rejected: a
seed in `vitest.setup.ts` (hides the default from the whole repo) and having
`resetMockStore` return one result (flips `newOrLapsed`, which the intro tests
assert on). Cost: one line in seven files, landed in Wave 1 so the flip in
Wave 3 changes nothing they see.
Changed: Track C (C1, C2).
