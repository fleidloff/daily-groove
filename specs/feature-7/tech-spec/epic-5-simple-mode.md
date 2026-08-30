# Tech spec — Epic 5: Simple mode

PRD: [../prd/epic-5-simple-mode.md](../prd/epic-5-simple-mode.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Simple mode narrows two option sets and loosens one comparison. Everything else
about the day — the groove, the answer, the attempts, the nudge, the reveal, the
record — is untouched, and the spec is built to keep it that way.

The narrowing is pure: `familyOf(mode)` maps the six modes onto `'Major'` and
`'Minor'`, and `simpleRootOptions(date, answer)` reuses the same `buildOptions`
that already builds the daily mode row. Both live in `lib/theory/`, beside the
vocabulary they are defined over.

The loosening is the only part that reaches into existing behaviour.
`scoreAttempt` compares two flavour strings for equality; in simple mode it must
compare a family against a mode's family. Rather than teach the store about
modes, the comparison becomes a parameter — the store is created with a matcher,
and simple mode swaps which matcher it holds.

The preference is a third seam: a `PreferenceStore` mirroring the existing
`ResultStore`, so no component or hook touches `localStorage` directly.

## Architecture

```
lib/theory/families.ts   familyOf(mode): Family            ← pure, total over the six modes
lib/theory/music.ts      simpleRootOptions(date, answer)   ← buildOptions over ROOTS, count 6

lib/puzzle/scoring.ts    scoreAttempt(answer, guess, matchFlavour)
                         exactMatch   — a === b            (full puzzle)
                         familyMatch  — familyOf(a) === b  (simple mode)

lib/persistence/preferences.ts   PreferenceStore { get, set }  ← key: daily-groove:v1:prefs
hooks/useSimpleMode.ts           { simple, setSimple, loaded }

components/puzzle/ModeToggle.tsx ← new, in the `puzzle` region
```

**Why the matcher is a parameter.** `Attempt.flavourMatched` is what
`selectFeedback` reads to say "that flavour is close". In simple mode the
player's guess is `'Minor'`, which is not a mode and can never equal one. Making
the comparison injectable keeps one scoring path, one attempt shape, and one
feedback module; the alternative — a second scorer, or a store that knows what
simple mode is — duplicates the rule that decides whether a day is won.

**What is recorded.** `Attempt.flavour` holds what the player pressed: a mode in
the full puzzle, `'Major'` or `'Minor'` in simple mode. `Flavour` is a plain
string in `src/lib/groove.ts`, so both fit without a type change. `DailyResult`
gains nothing: the day's answer is still the groove's real mode, and whether it
was reached the easy way is not something anything reads back.

**Where the six roots come from.** `buildOptions(correct, pool, seed, count)`
already does exactly this job for the mode row. `simpleRootOptions` is a call to
it with `ROOTS` as the pool, the ISO date as the seed and `count = 6` — so the
six are stable for the day and always contain the answer, which is what keeps
every day winnable.

## Contracts

Frozen before the tracks start.

```ts
// src/features/daily-groove/lib/theory/families.ts
export type Family = 'Major' | 'Minor'
/** Total over the six modes Epic 4 leaves standing. Throws on anything else. */
export function familyOf(mode: Flavour): Family
export const FAMILIES: Family[]   // ['Major', 'Minor']
```

```ts
// src/features/daily-groove/lib/theory/music.ts
/** Six roots for the date, always including the answer's. */
export function simpleRootOptions(date: Date, answer: Answer): Root[]
```

```ts
// src/features/daily-groove/lib/puzzle/scoring.ts
export type FlavourMatcher = (answer: Flavour, guess: Flavour) => boolean
export const exactMatch: FlavourMatcher
export const familyMatch: FlavourMatcher
export function scoreAttempt(
  answer: Answer,
  guess: Answer,
  matchFlavour?: FlavourMatcher,   // defaults to exactMatch
): Attempt
```

```ts
// src/features/daily-groove/lib/persistence/preferences.ts
export type Preferences = { simpleMode: boolean }
export type PreferenceStore = {
  get(): Promise<Preferences>
  set(prefs: Preferences): Promise<void>
}
export function createLocalPreferenceStore(): PreferenceStore
```

```ts
// src/features/daily-groove/components/puzzle/ModeToggle.tsx
type ModeToggleProps = { simple: boolean; onChange(simple: boolean): void }
```

`GuessCardProps` gains `simple: boolean` and `onToggleSimple(simple: boolean): void`,
and its `roots` and `flavours` props keep their existing types — the caller
decides which set to pass.

## Tracks

### Track A — The collapse

- **Goal** — `familyOf`, `simpleRootOptions` and the injectable matcher exist
  and are proven as plain functions.
- **Owns** — `lib/theory/families.ts`, `lib/theory/music.ts`,
  `lib/puzzle/scoring.ts` and their tests.
- **Depends on** — Epic 4's vocabulary. `familyOf` is total over exactly the six
  modes Epic 4 leaves standing.
- **Parallel with** — Tracks B and C.
- **Done when** — its tests pass with nothing rendered.

### Track B — The preference

- **Goal** — the toggle's position survives a reload and a new day.
- **Owns** — `lib/persistence/preferences.ts`, `hooks/useSimpleMode.ts` and
  their tests.
- **Depends on** — the `PreferenceStore` contract only.
- **Parallel with** — Tracks A and C.
- **Done when** — the store and hook tests pass against an injected store.

### Track C — The toggle

- **Goal** — `ModeToggle` renders and `GuessCard` shows it above both rows.
- **Owns** — `components/puzzle/ModeToggle.tsx`,
  `components/puzzle/GuessCard.tsx` and their tests.
- **Depends on** — the `ModeToggleProps` and `GuessCardProps` contracts.
- **Parallel with** — Tracks A and B.
- **Done when** — its component tests pass, driven from props.

### Track D — Integration

- **Goal** — `GroovePuzzle` chooses the option sets and the matcher, and the
  feature works end to end.
- **Owns** — `components/GroovePuzzle.tsx`, `hooks/usePuzzleSession.ts`,
  `state/useDailyGrooveStore.ts`, `GroovePuzzle.test.tsx`, `structure.test.ts`.
- **Depends on** — A, B and C merged.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C
- **Wave 2:** Track D

Epic 5 as a whole is wave 2 of the feature: it needs Epic 4's vocabulary settled
and Epic 3's version of `GuessCard` to rebase onto.

## Implementation

### Track A — The collapse

#### Step A1 — Every mode has a family

Covers: R5, R6, AC6

- **Test first** — `lib/theory/families.test.ts`: assert `familyOf` returns
  `'Major'` for Ionian, Lydian and Mixolydian, and `'Minor'` for Dorian,
  Phrygian and Aeolian. Assert it throws for `'Locrian'`. Run it: fails with
  `familyOf is not a function`.
- **Implement** — `lib/theory/families.ts`: a `Record<string, Family>` over the
  six modes and a lookup that throws a named error on a miss. A throw, not a
  fallback: a mode with no family is a vocabulary bug, and silently calling it
  minor would make a day unwinnable with no signal.
- **Green when** — all seven assertions pass.
- **Refactor** — none.

#### Step A2 — Six roots, always including the answer

Covers: R2, R3, AC2

- **Test first** — `lib/theory/music.test.ts`: for twenty different dates and an
  answer rooted in `'E♭'`, assert `simpleRootOptions` returns 6 roots, that
  `'E♭'` is among them every time, and that the same date returns the same six
  in the same order. Run it: fails with `simpleRootOptions is not a function`.
- **Implement** — `music.ts`: `simpleRootOptions(date, answer)` returning
  `buildOptions(answer.root, ROOTS, isoDate(date), 6) as Root[]`.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step A3 — Scoring takes a matcher

Covers: R5, AC4, AC5

- **Test first** — `lib/puzzle/scoring.test.ts`: with an answer of
  `{ root: 'E', flavour: 'Dorian' }`, assert `scoreAttempt(answer, { root: 'E',
  flavour: 'Minor' }, familyMatch).correct` is `true`; that the same guess with
  `exactMatch` is `false`; and that a Mixolydian answer guessed `'Minor'` under
  `familyMatch` is `false`. Assert the two-argument call still behaves exactly
  as it does today. Run it: fails — `scoreAttempt` takes two arguments.
- **Implement** — `scoring.ts`: add `FlavourMatcher`, `exactMatch`,
  `familyMatch` (`familyOf(answer) === guess`), and a third optional parameter
  defaulting to `exactMatch`.
- **Green when** — all four assertions pass and every existing scoring test
  stays green untouched — the default is what guarantees that.
- **Refactor** — none.

### Track B — The preference

#### Step B1 — The preference survives a reload

Covers: R7, AC7

- **Test first** — `lib/persistence/preferences.test.ts`: `set({ simpleMode:
  true })`, then `get()` returns it. With no stored value, `get()` returns
  `{ simpleMode: false }`. With corrupt JSON under the key, `get()` returns the
  default rather than throwing. Run it: fails, the module does not exist.
- **Implement** — `lib/persistence/preferences.ts`, modelled on `storage.ts`:
  its own key `daily-groove:v1:prefs`, a guarded read that falls back to the
  default on absent, unparseable or wrong-shaped data, and a write that swallows
  quota failures.
- **Green when** — all three assertions pass.
- **Refactor** — none. `storage.ts` and this share a shape but not a payload;
  extracting a generic envelope helper is more surface than the duplication
  costs.

#### Step B2 — The hook exposes it

Covers: R7, R8a, AC7

- **Test first** — `hooks/useSimpleMode.test.ts`: render with an injected
  store, assert `simple` is `false` and `loaded` becomes `true`; call
  `setSimple(true)` and assert both the returned value and the store's saved
  value. Run it: fails with a missing module.
- **Implement** — `hooks/useSimpleMode.ts`: async load in an effect guarded
  against unmount, exactly as `useProgress` does; optimistic local update then
  write-through on `setSimple`.
- **Green when** — both assertions pass.
- **Refactor** — none.

### Track C — The toggle

#### Step C1 — The toggle renders and reports

Covers: R1, R11, AC1

- **Test first** — `components/puzzle/ModeToggle.test.tsx`: render with
  `simple={false}`, assert an accessible control whose state reads unpressed,
  press it, and assert `onChange` was called with `true`. Assert it is reachable
  and operable by keyboard. Run it: fails, the component does not exist.
- **Implement** — `components/puzzle/ModeToggle.tsx`: a `<button
  type="button" role="switch" aria-checked={simple}>` with a label naming simple
  mode. It is a feature component, not a design-system primitive: it names a
  domain concept, and `docs/architecture.md` keeps those out of
  `src/components`.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step C2 — The card carries it above both rows

Covers: R1, R11, AC1, AC11

- **Test first** — `components/puzzle/GuessCard.test.tsx`: render with `simple`
  and `onToggleSimple`, and assert the switch appears before both `radiogroup`s
  in DOM order. Assert both rows are still labelled, single-select and
  keyboard-reachable in either value of `simple`. Run it: fails, the props do
  not exist.
- **Implement** — `GuessCard.tsx`: add the two props and render `ModeToggle`
  directly under the `Heading`, above the first `ChipGroup`.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step C3 — The second row is labelled for what it holds

Covers: R4, AC3

- **Test first** — `GuessCard.test.tsx`: render with `simple` and
  `flavours={['Major', 'Minor']}` and assert the second row offers exactly two
  chips reading `Major` and `Minor`, and that no mode name is on screen in
  either row. Run it: fails if the card hardcodes anything about its options.
- **Implement** — none expected; the card renders what it is handed. If the
  row's label needs to differ between modes, set it from `simple` here.
- **Green when** — both assertions pass.
- **Refactor** — none.

### Track D — Integration

#### Step D1 — The puzzle chooses the sets and the matcher

Covers: R2, R3, R4, R5, AC2, AC3, AC4, AC5

- **Test first** — `components/GroovePuzzle.test.tsx`: with simple mode on and a
  Dorian groove, assert the root row has 6 chips including the answer's, the
  second row has 2, and that pressing the answer's root plus `Minor` solves the
  day. With simple mode off, assert 12 and 4 and that `Minor` is not offered.
  Run it: fails — nothing passes the narrowed sets.
- **Implement** — `GroovePuzzle.tsx`: read `simple` from `useSimpleMode`; choose
  `roots` from `simple ? simpleRootOptions(today, answer) : ROOTS` and
  `flavours` from `simple ? FAMILIES : flavourOptions(today, groove)`, both
  memoised. Pass the matcher down: `usePuzzleSession(groove, today, simple)`,
  which forwards `simple ? familyMatch : exactMatch` into
  `createDailyGrooveStore(answer, matchFlavour)`, which forwards it to
  `scoreAttempt`.
- **Green when** — all assertions pass.
- **Refactor** — none.

#### Step D2 — Switching mid-day keeps the day

Covers: R8, R8a, AC8, AC8a

- **Test first** — `GroovePuzzle.test.tsx`: guess wrong twice, toggle simple
  mode on, and assert the dot row still shows two spent, no new attempt was
  recorded, the groove is the same, and the toggle is still operable. Run it:
  fails if the store is recreated on a mode change, which would reset the day.
- **Implement** — `usePuzzleSession.ts`: the store is created once in `useState`
  and must **not** be recreated when `simple` changes. Hold the matcher in a ref
  the store reads at check time, so swapping it does not remount the store.
- **Green when** — all four assertions pass.
- **Refactor** — none. This step is the one most likely to be got wrong by
  putting `matchFlavour` in the `useState` initialiser's closure and then
  passing `simple` as a dependency somewhere.

#### Step D3 — Nudge, reveal and streak are unchanged

Covers: R9, R10, AC9, AC10

- **Test first** — `GroovePuzzle.test.tsx`: in simple mode, miss twice and
  assert the nudge names the day's root; miss a third time and assert the
  give-up control appears. Solve in simple mode and assert the day is recorded
  `solved` and the streak advances. Run it: passes if D1 changed only the option
  sets and the matcher — which is the point of the step.
- **Implement** — none expected.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step D4 — The structural test knows the new component

Covers: R1

- **Test first** — `src/features/daily-groove/structure.test.ts`: run it. It
  fails naming `ModeToggle` as a component in the `puzzle` directory that is not
  in `REGIONS`.
- **Implement** — add `'ModeToggle'` to the `puzzle` region list.
- **Green when** — the structural suite passes.
- **Refactor** — none.

## Integration and verification

- **Demo path** — `npm run dev`. Toggle simple mode on: six roots, two chips
  reading `Major` and `Minor`. Solve a Dorian day by pressing its root and
  `Minor`. Reload the next day: simple mode is still on. Toggle it off mid-day
  after two misses: twelve roots, four modes, and the two dots are still spent.
- **Keyboard pass** — the switch is reachable and operable, and both chip rows
  remain single-select radiogroups in either mode.
- **Full suite** — `npm test`, `npm run lint`, `npm run build` clean.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | C1, C2, D4 |
| R2 | A2, D1 |
| R3 | A2, D1 |
| R4 | C3, D1 |
| R5 | A1, A3, D1 |
| R6 | A1 |
| R7 | B1, B2 |
| R8 | D2 |
| R8a | B2, D2 |
| R9 | D3 |
| R10 | D3 |
| R11 | C1, C2 |
| AC1 | C1, C2 |
| AC2 | A2, D1 |
| AC3 | C3, D1 |
| AC4 | A3, D1 |
| AC5 | A3, D1 |
| AC6 | A1 |
| AC7 | B1, B2 |
| AC8 | D2 |
| AC8a | D2 |
| AC9 | D3 |
| AC10 | D3 |
| AC11 | C2 |

## Assumptions

- `ModeToggle` is `role="switch"`, not a two-chip `ChipGroup`. It is a binary
  preference, not a choice among options, and a switch says so to a screen
  reader.
- The preference key is `daily-groove:v1:prefs`, versioned like the results key
  so a future shape change is a clean break rather than a migration.
- Simple mode defaults to off, so a returning player sees exactly what they saw
  before.
- `familyOf` throws rather than defaulting. A mode with no family is a bug in
  the vocabulary, and a silent default would make a day unwinnable with no
  signal anywhere.
- The six roots come from `buildOptions` with `count = 6`, reusing the seeded
  shuffle Epic 1 exports. No second option builder is written.
- Nothing in `DailyResult` records that a day was played in simple mode. Nothing
  reads it back, and adding a field nobody consumes is speculative.

## Decision log

Settled architectural decisions. The sections above are the source of truth —
this records how they got there, and what each one cost. Append-only: never
rewrite or prune a past cycle.

### Cycle 1 — 2026-08-30

**Q1. How does simple mode's looser grading reach the scorer?**
Decision: **A) An injectable `FlavourMatcher`, defaulting to the exact
comparison, held in a ref so a mid-day switch does not remount the store** — it
keeps one scoring path, one `Attempt` shape and one feedback module.
Changed: nothing. The `FlavourMatcher` contract and Steps A3, D1 and D2 were
drafted against this choice; a store that branched on simple mode, or a second
scorer, would have rewritten all three and every scoring test.

**Q2. Where does the toggle's preference persist?**
Decision: **A) A `PreferenceStore` seam beside `ResultStore`, its own key, its
own module** — `docs/architecture.md` puts persistence behind a seam so no
component touches `localStorage`, and feature-A's move to Supabase then
re-implements one interface rather than every call site.
Changed: nothing. Track B and the `PreferenceStore` contract were drafted
against this choice.
