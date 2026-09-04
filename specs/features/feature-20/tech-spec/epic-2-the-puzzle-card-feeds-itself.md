# Tech spec — Epic 2: The puzzle card feeds itself

PRD: [../prd/epic-2-the-puzzle-card-feeds-itself.md](../prd/epic-2-the-puzzle-card-feeds-itself.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Three things get built and one thing gets taken apart.

Built: a pure function `guessCardView` at
`src/features/daily-groove/lib/presentation/index.ts` that takes the session and
the two settings and returns the guess card's whole view model; a session
context at `src/features/daily-groove/state/PuzzleSessionContext.tsx` that
carries what `GroovePuzzleView` already creates; and a set of harness helpers
that put a mounted feature at any rung by seeding **real** `localStorage`
through the persistence module's own `save`/`update`, so no test needs a
`vi.mock` of an internal path.

Taken apart: nine `useMemo`s and three offered-value expressions leave
`GroovePuzzle.tsx`, and twenty-five props leave the `GuessCard` call site.

The order is forced. The door and the context are independent files behind
frozen contracts and go first, in parallel. Everything else is **one track**:
the moment `GuessCardProps` shrinks to two members, `GroovePuzzle.tsx` stops
type-checking and all 120 blocks of `GuessCard.test.tsx` fail together, and no
`vi.mock` is available to hold one side still while the other moves. Handing
those four files to separate agents in one wave would give each a red suite it
cannot make green alone.

**Three measured corrections to the PRD, all of them load-bearing.** They are in
*Architecture* with the numbers; in short:

1. The call site passes **27** props, not 28, and **15** of them are derived, not
   13. Feature-19 removed `dots` (−1 prop, −1 derived) and the PRD's thirteen
   omitted the three offered values it names separately.
2. `GuessCard.test.tsx` runs **138** cases, not 115 and not 142. R8's floor is
   therefore 138, and this spec's checks use that number.
3. **`GuessCard.test.tsx` contains no assertion about what the coaching says.**
   Every one of its feedback, coaching, verdict and nudge cases hands the card a
   synthetic `Feedback` fixture (`OPENING`, `MOVE`, `ROOT_MATCHED`, `SOLVED`) and
   asserts the card renders what it was given. The real wording is already
   asserted in `coaching.test.ts`, `moves.test.ts`, `coachingMoves.test.ts`,
   `feedback.test.ts`, `verdict.test.ts` and `GroovePuzzle.guessing.test.tsx`.
   So the PRD's Q3 answer — "coaching-text cases move to the entry point" —
   describes a set that is **empty in this file**. Five cases move (the check
   button's label truth table); the rest are rewritten in place against real
   text at a seeded rung, and the entry point's test is net-new coverage rather
   than a relocation. The file does not shrink much, and it gets slower. That is
   the honest cost of Q1's and Q5's answers, and *Case reconciliation* states it
   as a rule plus two measured numbers rather than as a shrinkage claim.

## Architecture

### The measured tree, before

Taken on the working tree of 2026-09-03 with feature-19's implementation
uncommitted and feature-18 merged.

| | Now |
| :-- | :-- |
| `GroovePuzzle.tsx` | 406 lines, 40 import statements, 23 sideways into `../lib/`, `../data/`, `../hooks/`, `../types` |
| `GuessCard` call site | **27 props** |
| — of them derived | **15**: 12 `useMemo`'d in the parent, 3 computed inline as the offered selection |
| `useMemo` in `GroovePuzzle.tsx` | 11, of which **9** compute values only `GuessCard` renders |
| `../lib/presentation/*` imports in `GroovePuzzle.tsx` | 5 (`feedback`, `coaching`, `verdict`, `confirmed`, `ruledOut`) + 1 (`date`) |
| `GuessCard.tsx` | 198 lines, 27-member prop type, its own `optionStatesFor`, `label` and `tone` |
| `GuessCard.test.tsx` | 2341 lines, 120 `it`/`it.each` blocks, **138 executed cases**, file duration **5.41s** |
| `lib/presentation/` | 11 modules + 11 colocated test files |
| App suite (`npm test`) | 114 files, 2306 tests, wall clock **40.03s** |

The 27, listed, with the derived ones marked:

| Prop | Derived? | Where it comes from today |
| :-- | :-- | :-- |
| `roots` | ✔ memo | `simple ? simpleRootOptions(today, answer) : ROOTS` |
| `flavours` | ✔ memo | `simple ? FAMILIES : flavourOptions(today, groove)` |
| `selectedRoot` | ✔ inline | `offeredRoot` — session's selection, filtered by `roots` |
| `selectedFlavour` | ✔ inline | `offeredFlavour` — session's selection, filtered by `flavours` |
| `canCheck` | ✔ inline | `canCheckOffered` — session's `canCheck` ∧ both offered |
| `feedback` | ✔ memo | `selectFeedback(attempts, solved)` |
| `coaching` | ✔ memo | `selectCoaching({ attempts, tapSounds, simple })` |
| `showVerdict` | ✔ memo | `shouldShowVerdict(attempts)` |
| `showNudge` | ✔ memo | `shouldShowNudge(narrowing.eliminatedCount, solved, confirmed.roots.length > 0)` |
| `showReveal` | ✔ memo | `shouldOfferReveal(attempts, solved, revealed)` |
| `ruledOutRoots` | ✔ memo | `ruledOut({…}).roots` |
| `ruledOutFlavours` | ✔ memo | `ruledOut({…}).flavours` |
| `eliminated` | ✔ memo | `ruledOut({…}).eliminatedCount` |
| `confirmedRoots` | ✔ memo | `confirmedHalves(attempts).roots` |
| `confirmedFlavours` | ✔ memo | `confirmedHalves(attempts).flavours` |
| `onSelectRoot` | | `session.selectRoot` |
| `onSelectFlavour` | | `session.selectFlavour` |
| `onCheck` | | `session.check` |
| `onReveal` | | `session.reveal` |
| `solved` | | `session.solved` |
| `revealed` | | `session.revealed` |
| `simple` | | `useSimpleMode().simple` |
| `onToggleSimple` | | `useSimpleMode().setSimple` |
| `tapSounds` | | `useTapSounds().tapSounds` |
| `onToggleTapSounds` | | `useTapSounds().setTapSounds` |
| `onHearRoot` | | shell callback over the transport clock — **stays** |
| `onHearMode` | | shell callback over the transport clock — **stays** |

`dots` was the PRD's thirteenth derived prop. Feature-19 deleted it, `dotStates`
and `AttemptDots` in the work now uncommitted in this tree, so it is not in the
list and not in the count.

### The measured tree, after

| | After |
| :-- | :-- |
| `GuessCard` call site | **2 props** — `onHearRoot`, `onHearMode` |
| `useMemo` in `GroovePuzzle.tsx` | **2** — `source`, `passes` (plus one for the context value) |
| `../lib/presentation/*` imports in `GroovePuzzle.tsx` | **1** — `date` (`metaLine`, not coaching, per the PRD's out-of-scope) |
| `GuessCard.tsx` | 2-member prop type, one `OptionState → ChipOptionState` mapping, no `optionStatesFor`, no `label`/`tone` derivation |
| New | `lib/presentation/index.ts`, `lib/presentation/index.test.ts`, `state/PuzzleSessionContext.tsx`, `state/PuzzleSessionContext.test.tsx` |

### The one arrow that is new

```
GroovePuzzleView
  ├─ usePuzzleSession / useSimpleMode / useTapSounds   (once each, unchanged)
  └─ <PuzzleSessionProvider value={…}>                  ← new
         …
         └─ GuessCard  ── usePuzzleSessionContext() ───┐  reads the session
                       ── guessCardView(…) ────────────┘  opens the door
                          from lib/presentation/index.ts
```

`GuessCard` gains two imports and loses twenty-five props. It stays a feature
component, not a design-system primitive, so no boundary moves — the roadmap
already named this as the reflex worth overriding out loud.

### Store lifetime does not change

`usePuzzleSession` still runs exactly once, in `GroovePuzzleView`, and still
creates the store inside its own `useState` initialiser on first render. The
provider carries the hook's **result**, not the hook. So:

- one `createDailyGrooveStore` per mount of `GroovePuzzle`, as today;
- `hydrate(todayResult)` still runs once, in `usePuzzleSession`'s effect, when
  `useProgress` reports `loaded`;
- shared mode still builds `createReadOnlyStore(createLocalStore())` in
  `GroovePuzzleView`'s `useState` and passes it into `usePuzzleSession`
  unchanged;
- `if (!hydrated) return <PuzzleLoading />` still guards the tree, above the
  provider.

A component that called `usePuzzleSession` itself would get a *second* store.
That is exactly why the card reads a context instead of calling the hook, and it
is the whole content of the PRD's Q4.

### Why the view model is one object and one call

`guessCardView` composes eight existing modules and one lifted merge:

```
guessCardView(input)
  ├─ roots    ← simple ? simpleRootOptions(date, answer) : ROOTS
  ├─ flavours ← simple ? FAMILIES : flavourOptions(date, groove, GROOVES)
  ├─ ruledOut({ attempts, answer, roots, date })      → roots, flavours, eliminatedCount
  ├─ confirmedHalves(attempts)                        → roots, flavours
  ├─ optionStates(options, ruledOut, confirmed)        ← lifted from GuessCard
  ├─ selectFeedback(attempts, solved) + shouldShowVerdict(attempts)
  ├─ selectCoaching({ attempts, tapSounds, simple })
  ├─ shouldShowNudge(eliminatedCount, solved, rootConfirmed)
  ├─ shouldOfferReveal(attempts, solved, revealed)
  └─ label / tone / enabled                            ← lifted from GuessCard
```

No `useMemo` anywhere. The card calls it on every render; every input is either
a primitive or an array the store already holds by reference, and the heaviest
thing inside is `buildOptions`' deterministic shuffle over twelve items. If a
profile ever disagrees, a `useMemo` inside the card is a one-line change that
does not move the door.

### The per-option state is domain-shaped

`GuessCard.optionStatesFor` today distinguishes exactly two *rendered* outcomes
(dimmed or not) from three *domain* conditions. The union keeps all three,
because the third is what "the confirmed chip stays live and selectable" means:

```
confirmed ∩ options ≠ ∅   →  those options are 'confirmed', every other is 'out'
confirmed ∩ options = ∅   →  options in ruledOut are 'out', every other is 'open'
```

`GuessCard` maps `'out' → { unavailable: true }` and the other two to no entry —
byte-identical to what `optionStatesFor` produces today, and the only place in
the epic that knows the name `ChipOptionState`.

### How a rendered case reaches a rung, with no mock

`hydrate()` restores `attempts`, `solved`, `revealed` and the matched halves of
the last attempt's selection. The five `GroovePuzzle.*.test.tsx` files reach
rungs by `vi.mock`ing `../lib/persistence/storage` and handing back a mock
store. **`GuessCard.test.tsx` does not get to do that** — R10a rules it out — so
it seeds the real thing instead:

```ts
await seedDay({ date: TODAY(), answer: ANSWER, attempts: [...], solved: false, grooveId: GROOVE.id })
await renderPuzzle()
```

`seedDay` calls `createLocalStore().save(result)` — the persistence module's own
public function, writing real `localStorage`, which jsdom provides and
`useProgress.integration.test.ts` already exercises. `useProgress`'s
`defaultStore` reads it on mount. No mock, no test-only seam in any component,
and the seam that does exist lives in `testing/` exactly where R10a asks for it.

Two mount helpers survive, and they mean different things:

| Helper | Renders | Used by |
| :-- | :-- | :-- |
| `renderPuzzle()` — `testing/puzzleHarness.tsx` | `<GroovePuzzle groove={GROOVE} />`, the fixture groove, answer `C Aeolian` | every rung-dependent case |
| `renderFeature()` — `testing/renderFeature.tsx` | `<GroovePuzzle />`, today's real groove | the three "through the composed page" cases that deliberately assert against the live catalogue |

`groove` is a real prop — the shared route passes it — not a test seam. AC9's
"`renderFeature()`" is read as "a feature mount from `testing/`", which is what
both helpers are; the spec names the specific one per step.

### The taps: what R5 keeps, and what it costs

`onHearRoot` and `onHearMode` stay props, but a feature-mounted card gets the
shell's real ones, so the 15 blocks that spy on them cannot spy any more. Their
observable becomes the fake `AudioContext`, which is how
`GroovePuzzle.sounding.test.tsx` has always asserted sounding. Its two local
helpers move into the harness so there is one definition:

```ts
export const soundedNotes = async (count: number) => {
  await waitFor(() => expect(fake.sources).toHaveLength(count))
  return fake.sources
}
export const startedAt = (node: FakeSourceNode) => /* the node's scheduled start */
```

`docs/testing.md` prefers this: "test rendered behaviour, not implementation
details… not which hook fired". Converting `expect(onSelectRoot)
.toHaveBeenCalledWith('E♭')` into `expect(chip).toHaveAttribute('aria-pressed',
'true')` moves *toward* the standard, not away from it.

**Named as a finding, not fixed here:** several of those rewritten blocks end up
close to cases `GroovePuzzle.sounding.test.tsx` already has (`selects the tapped
root and sounds its note`, `sounds each of simple mode's six roots`, `still
sounds a root a confirmed half locked out`). They stay in `GuessCard.test.tsx`
because R8 counts that file and R10b keeps it, and the overlap goes in the
epic's report for a later cycle to resolve. Deleting them here would be dropping
coverage under a tidiness argument, which is the failure mode R8 exists to stop.

### Case reconciliation

The rule, applied block by block. It replaces "coaching-text cases move",
which — see *Approach* correction 3 — has no members in this file.

| The block's subject | Where it goes |
| :-- | :-- |
| **A truth table over the state of play**: which label, which tone, which option state, which text for which attempt history | `lib/presentation/index.test.ts`, as a pure call on `guessCardView`. Subject preserved: it was always a fact about the derivation. |
| **What the card renders and how the player acts on it**: roles, order, live regions, `aria-pressed`, `disabled`, columns, the glyph, geometry, focus, the give-up disarm sequences | stays in `GuessCard.test.tsx`, mounted through the feature at a seeded rung. |
| **Both at once** | splits into one case on each side. The count goes up, never down. |
| **Anything else** | stays, with its mechanism changed and its assertion intact. |

Nothing is deleted. Concretely:

| Group | Blocks | Cases | Destination |
| :-- | :-- | :-- | :-- |
| `it.each(CTA_CASES)` at line 212 — the label truth table | 1 | 5 | **moves** to `index.test.ts` (R3c). Its rendered counterparts at lines 161, 169 and 186 stay. |
| Blocks that assert on a callback spy | 42 | — | stay; mechanism becomes the rendered effect (27 blocks) or the audio fake (15 blocks) |
| Blocks that use a synthetic `Feedback` fixture | 30 | — | stay; the fixture becomes the real constant imported from `moves.ts` / `coachingMoves.ts` / `feedback.ts`, read at a seeded rung — the pattern `GroovePuzzle.guessing.test.tsx` already uses |
| `is never given the day's root` at line 370 (reads `GuessCardProps` from disk) | 1 | 1 | stays, strengthened into AC5's own check |
| Everything else | 76 | — | stays, seeded-rung mount instead of `props()` |

**The check, and it is mechanical.** Before the first edit, record
`npx vitest run src/features/daily-groove/components/puzzle/GuessCard.test.tsx`
→ `138 passed`. After, the same command plus
`npx vitest run src/features/daily-groove/lib/presentation/index.test.ts` must
sum to **≥ 138**, with `GuessCard.test.tsx` alone at **≥ 133** (138 − the 5 that
move). `GroovePuzzle.guessing.test.tsx` stays at **82 blocks** and
`GroovePuzzle.sounding.test.tsx` at **63 blocks**, both untouched except
sounding's two-line helper import (AC10a).

### Suite time

Measured before, same command, same machine, cold:

- `npm test` → 114 files, 2306 tests, **40.03s** wall clock.
- `GuessCard.test.tsx` alone → 138 tests, **5.41s** file duration (3.39s of test
  time).

Projection, not a budget: ~133 cases move from a bare `render` (~15ms) to a
feature mount (~94ms, the rate `GroovePuzzle.guessing.test.tsx` runs at), so the
file lands near **13s** and becomes the slowest in the repo, and the app suite's
wall clock lands somewhere in the low-to-mid **40s**. R10c asks for the numbers,
not a ceiling. Step C12 records the real ones.

### What must not move

- `lib/presentation/date.ts` and `staffLabel.ts`. Not coaching, not imported by
  the view model. **Superseded for `date.ts` by Epic 3 (2026-09-03):** its
  per-folder door rule (R2) makes `metaLine` the shell's last presentation
  residue, so the door now re-exports it and `GroovePuzzle.tsx` imports
  `'../lib/presentation'` rather than `'../lib/presentation/date'`. It is one
  named function, pinned by its own case; `staffLabel.ts` is unaffected and
  stays outside the door.
- `lib/presentation/nearMiss.ts`. Read by the solved panel, not the guess card.
- Every module behind the door keeps its name, its exports and its own test file.
  The epic adds `index.ts` beside them and changes none of them.
- `NudgeBox`, `FeedbackLine`, `ModeToggle`, `TapSoundsToggle` — unchanged, prop
  for prop. `NudgeBox` keeps importing `type Feedback` from `./feedback`; that
  is a sibling component's own import and Epic 3's business, not this epic's.
- The feature's `index.ts`. Nothing new is exported, so the slice's public
  surface and its removability check are untouched.
- `src/components/**`, `src/app/**`, `scripts/**`. Not one line.

### Epic 1 dependency, stated once

Epic 1 moves all thirteen theory modules to `src/lib/theory/` and gives
`flavourOptions` its grooves argument. Two lines in this epic depend on that:

```ts
// src/features/daily-groove/lib/presentation/index.ts — post-Epic-1 paths
import { ROOTS, flavourOptions, simpleRootOptions } from '@/lib/theory/music'
import { FAMILIES } from '@/lib/theory/families'
// …
flavourOptions(date, groove, GROOVES)
```

If Epic 1 lands a different argument order or shape for `flavourOptions`, Step
A2's one call line changes and nothing else does. Everything else this epic
imports comes from `../../types` (which Epic 1 keeps as a re-export) or from
`lib/presentation/` itself.

## Contracts

Frozen before Track C starts. C1 and C2 are the two that A, B and C would
otherwise disagree about.

### C1 — `lib/presentation/index.ts`, the door

**Amended by Epic 3 (2026-09-03).** This contract froze eight type exports.
Five of them — `CheckTone`, `CheckView`, `HintView`, `GuessCardView` and the
`Feedback` re-export — turned out to have no importer anywhere in the repo, and
Epic 3's narrow-door guard (its R4 and C4) makes an unimported export exactly
the failure condition. Epic 3 dropped the `export` keyword from those five;
their declarations are untouched and still type `guessCardView`'s signature.
The door also gained one runtime export, `metaLine`, which Epic 3's R2
sanctions as the shell's last presentation residue. So the surface is
`guessCardView`, `metaLine`, `OptionState`, `OptionView` and
`GuessCardViewInput` — each with a live importer. Epic 2's AC10 still holds:
its load-bearing clause is that the door re-exports nothing from *behind* it.

```ts
// src/features/daily-groove/lib/presentation/index.ts
import type { Answer, Attempt, Flavour, Groove, Root } from '../../types'
import type { Feedback } from './feedback'

export type OptionState = 'open' | 'confirmed' | 'out'

export type OptionView<T extends string = string> = {
  value: T
  state: OptionState
}

export type CheckTone = 'idle' | 'ready' | 'solved'

export type CheckView = {
  label: string
  tone: CheckTone
  enabled: boolean
}

export type HintView = {
  show: boolean
  feedback: Feedback | null
  coaching: Feedback | null
  eliminated: number | null
}

export type GuessCardViewInput = {
  groove: Groove
  answer: Answer
  attempts: readonly Attempt[]
  date: Date
  selectedRoot: Root | null
  selectedFlavour: Flavour | null
  solved: boolean
  revealed: boolean
  canCheck: boolean
  simple: boolean
  tapSounds: boolean
}

export type GuessCardView = {
  roots: readonly OptionView<Root>[]
  flavours: readonly OptionView<Flavour>[]
  selectedRoot: Root | null
  selectedFlavour: Flavour | null
  check: CheckView
  hint: HintView
  giveUp: boolean
  over: boolean
}

export type { Feedback }

export function guessCardView(input: GuessCardViewInput): GuessCardView
```

**Narrow, and the test says so (R11, AC10).** The module's runtime exports are
exactly `['guessCardView']`. Its type exports are exactly the seven named above
plus the one re-export of `Feedback`, which is admitted because it is part of the
view model's own shape — `hint.feedback` has that type and `NudgeBox` takes it.
No `export *`, and no re-export of any of the eleven modules behind the door.

**Derivation rules, in full, so the assertions are checkable.** `offeredRoot`
and `offeredFlavour` are the input selection filtered by the current option
list; `rootValues` and `flavourValues` are those lists before wrapping.

1. `rootValues = simple ? simpleRootOptions(date, answer) : ROOTS`
2. `flavourValues = simple ? FAMILIES : flavourOptions(date, groove, GROOVES)`
3. `narrowing = ruledOut({ attempts, answer, roots: rootValues, date })`
4. `confirmed = confirmedHalves([...attempts])`
5. `optionStates(values, ruledOutList, confirmedList)`:
   - `locked = values.filter(v => confirmedList.includes(v))`
   - if `locked.length > 0`: `locked` → `'confirmed'`, every other value → `'out'`
   - else: values in `ruledOutList` → `'out'`, every other → `'open'`
6. `selectedRoot = offeredRoot`, `selectedFlavour = offeredFlavour`
7. `check.enabled = canCheck && offeredRoot !== null && offeredFlavour !== null && !revealed`
8. `check.label`:
   `solved` → `'Solved'`;
   both offered → `` `Check ${offeredRoot} ${offeredFlavour}` ``;
   root only → `'Pick a mode'`;
   flavour only → `'Pick a root'`;
   neither → `'Pick a root and a mode'`
9. `check.tone = solved ? 'solved' : check.enabled ? 'ready' : 'idle'`
10. `over = solved || revealed`
11. `hint.show = !over`
12. `hint.feedback = shouldShowVerdict(attempts) ? selectFeedback([...attempts], solved) : null`
13. `hint.coaching = selectCoaching({ attempts, tapSounds, simple })`
14. `hint.eliminated = shouldShowNudge(narrowing.eliminatedCount, solved, confirmed.roots.length > 0) ? narrowing.eliminatedCount : null`
15. `giveUp = shouldOfferReveal([...attempts], solved, revealed) && !revealed`

Rules 7 and 9 deserve a note: today the card computes `tone` from
`solved ? 'solved' : canCheck && !revealed ? 'ready' : 'idle'` where `canCheck`
is already `canCheckOffered`, and `disabled={!canCheck || revealed}`. Because the
store's own `canCheck()` returns `false` whenever `solved || revealed`, the
`!revealed` clauses are redundant *given that rule*. They are kept explicit here
so the derivation does not silently depend on the store's internals. Output is
identical either way.

### C2 — `state/PuzzleSessionContext.tsx`, the session context

```ts
// src/features/daily-groove/state/PuzzleSessionContext.tsx
'use client'

import type { ReactNode } from 'react'
import type { Groove } from '../types'
import type { UsePuzzleSession } from '../hooks/usePuzzleSession'

export type PuzzleSessionValue = {
  groove: Groove
  today: Date
  session: UsePuzzleSession
  simple: boolean
  setSimple(simple: boolean): void
  tapSounds: boolean
  setTapSounds(on: boolean): void
}

export function PuzzleSessionProvider(props: {
  value: PuzzleSessionValue
  children: ReactNode
}): ReactNode

export function usePuzzleSessionContext(): PuzzleSessionValue
```

- Default context value is `null`, and `usePuzzleSessionContext` throws when it
  reads `null`:
  `new Error('usePuzzleSessionContext must be used inside <PuzzleSessionProvider>')`.
  It never returns a default (R4c).
- `UsePuzzleSession` is imported **type-only**, so `state/` gains no runtime edge
  to `hooks/` and no cycle exists.
- The context object identity is stable per render of the value: the provider is
  handed a `useMemo`'d object.

### C3 — `GuessCardProps`, after

```ts
type GuessCardProps = {
  onHearRoot(r: Root): void
  onHearMode(f: Flavour): void
}
```

Exactly two members, in that order. This is what AC5 reads off disk.

### C4 — the harness's new exports

```ts
// src/features/daily-groove/testing/puzzleHarness.tsx
export const ANSWER: Answer                                   // { root: 'C', flavour: 'Aeolian' }
export function clearStored(): void                            // localStorage.clear()
export async function seedDay(result: DailyResult): Promise<void>
export async function seedPreferences(patch: Partial<Preferences>): Promise<void>
export function storedDay(over?: Partial<DailyResult>): DailyResult
export const soundedNotes: (count: number) => Promise<readonly FakeSourceNode[]>
export const startedAt: (node: FakeSourceNode) => number
```

- `seedDay` → `createLocalStore().save(result)`. `seedPreferences` →
  `createLocalPreferenceStore().update(patch)`. Real modules, real
  `localStorage`, no mock.
- `storedDay()` builds a `DailyResult` for `TODAY()` against `GROOVE` with
  `answer: ANSWER`, `attempts: []`, `solved: false`, `grooveId: GROOVE.id`, and
  spreads `over`.
- `clearStored()` runs in every `beforeEach` of `GuessCard.test.tsx`; jsdom keeps
  `localStorage` across cases in a file, and a leaked rung is the bug class this
  guards.
- `soundedNotes` and `startedAt` are *moved* from
  `GroovePuzzle.sounding.test.tsx`, which then imports them. One definition.

### C5 — the stored shapes, frozen

Unchanged, field for field. `DailyResult` and `Attempt` as
`src/features/daily-groove/types.ts` declares them today; `hydrate`'s
restoration rule (attempts, `solved`, `revealed`, and the last attempt's matched
halves as the selection) is what makes a seeded day reach a rung and is not
touched.

## Tracks

### Track A — The door

- **Goal** — `lib/presentation/index.ts` matches C1, returns the whole view
  model, is pure, is narrow, and has its own test file asserting every
  derivation rule as a truth table.
- **Owns** —
  `src/features/daily-groove/lib/presentation/index.ts` (new),
  `src/features/daily-groove/lib/presentation/index.test.ts` (new)
- **Role** — `implementer`
- **Depends on** — C1, and Epic 1 landed (the two `@/lib/theory/` imports and
  `flavourOptions`' third argument).
- **Parallel with** — Track B
- **Done when** — its own cases pass with `npx vitest run
  src/features/daily-groove/lib/presentation/index.test.ts`, without Track B or
  C existing. It touches nothing any other track reads, so the app suite stays
  green throughout.

### Track B — The session context

- **Goal** — `state/PuzzleSessionContext.tsx` matches C2: one provider, one hook,
  the hook throws outside the provider, every consumer under one provider reads
  the same instance.
- **Owns** —
  `src/features/daily-groove/state/PuzzleSessionContext.tsx` (new),
  `src/features/daily-groove/state/PuzzleSessionContext.test.tsx` (new)
- **Role** — `implementer`
- **Depends on** — C2 only.
- **Parallel with** — Track A
- **Done when** — its three cases pass and nothing else in the suite moves. The
  file has no consumer yet; Track C adds it.

### Track C — The card feeds itself

- **Goal** — `GuessCard` reads the session through the context and the derived
  state through the door, its prop type is C3, `GroovePuzzle` provides the
  context and computes nothing the card renders, `GuessCard.test.tsx` drives the
  card through a feature mount at seeded rungs with no case lost, and the four
  gates are clean.
- **Owns** —
  `src/features/daily-groove/components/puzzle/GuessCard.tsx`,
  `src/features/daily-groove/components/puzzle/GuessCard.test.tsx`,
  `src/features/daily-groove/components/GroovePuzzle.tsx`,
  `src/features/daily-groove/testing/puzzleHarness.tsx`,
  `src/features/daily-groove/components/GroovePuzzle.sounding.test.tsx`
  (helper import only — no case added, changed or removed)
- **Role** — `implementer`
- **Depends on** — Tracks A and B landed. C1, C2, C3, C4, C5.
- **Parallel with** — nothing.
- **Done when** — `npm test`, `npx tsc --noEmit`, `npm run lint` and
  `npm run build` are clean; `GuessCard.test.tsx` is at ≥ 133 cases;
  `grep -n "props(" GuessCard.test.tsx` returns nothing; the guessing and
  sounding files' block counts are 82 and 63.

**Why this is one track and not five.** `GuessCardProps` shrinking to two
members breaks `GroovePuzzle.tsx`'s type check and all 138 cases of
`GuessCard.test.tsx` in the same commit, and the only tool that could hold one
side still — a `vi.mock` of `./GuessCard` or of
`../../lib/presentation/index` — is a mock of an internal path, which
`docs/testing.md` forbids and R10a names explicitly. The harness is in the same
track because its new helpers have no consumer until the card test uses them, and
`GroovePuzzle.sounding.test.tsx` is in it because the two helpers move out of
that file in the same edit. This is the "real dependency is output, not a file"
case: it has to be modelled inside one unit.

### Track D — The structure knows what changed

- **Goal** — `structure.test.ts` names what this epic created and guards what it
  removed: the two new `state/` modules, the door's presence, the door's freedom
  from `@/components/`, and `GroovePuzzle.tsx`'s missing coaching imports and
  offered values.
- **Owns** —
  `src/features/daily-groove/structure.test.ts`
- **Role** — `implementer`
- **Depends on** — Tracks A, B and C landed. D3's assertions are red until C is
  done, which is why D is a wave of its own rather than parallel with C.
- **Parallel with** — nothing.
- **Done when** — its four new cases pass, the file's existing 14 cases pass
  unchanged, and `src/components/structure.test.ts`,
  `src/app/route-boundary.test.ts` and `scripts/grooves/boundary.test.ts` are
  green with no edit.

### Track E — Verification

- **Goal** — every R and AC traced to a passing case; AC7's demo path walked in
  the browser; AC10b's before/after numbers recorded.
- **Owns** — nothing. Writes no source and no test.
- **Role** — `verifier`
- **Depends on** — Tracks A–D.
- **Parallel with** — nothing.
- **Done when** — `npm test`, `npx tsc --noEmit`, `npm run lint`,
  `npm run build` are clean, the coverage table below is confirmed case by case,
  and the report carries the four measured numbers.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B — two new file pairs, no shared path,
  both behind frozen contracts, neither with a consumer yet.
- **Wave 2:** Track C — the whole rewire. Roughly 70% of the epic.
- **Wave 3:** Track D — its `GroovePuzzle.tsx` assertions describe C's result.
- **Wave 4:** Track E — gates, trace, demo.

**One scheduling note for the lead.** Wave 1 is the only honest parallelism in
this epic, and it is small. That is not a decomposition failure; it is the
roadmap's own finding restated one level down — "this feature buys parallelism
for the features that come *after* it, and pays for it with a serial build of
its own." Track C is one agent's long job: 120 test blocks re-expressed, 42 of
them changing observation mechanism. Do not split it to look wider.

## Implementation

### Track A — The door

Baseline: the app suite is green at 114 files / 2306 tests. This track adds
files nothing imports, so it cannot go red anywhere else.

#### Step A1 — The door exists and is narrow

Covers: R1, R11, AC10

- **Test first** — `src/features/daily-groove/lib/presentation/index.test.ts`:

  ```ts
  import * as door from './index'

  it('exports the view model function and nothing else at runtime (R1, R11, AC10)', () => {
    expect(Object.keys(door)).toEqual(['guessCardView'])
  })

  it('re-exports none of the modules behind it (R11, AC10)', () => {
    const source = readFileSync(resolve(__dirname, 'index.ts'), 'utf8')
    expect(source).not.toMatch(/export \*/)
    for (const module of [
      'coaching', 'coachingFamily', 'coachingMoves', 'confirmed', 'moves',
      'nearMiss', 'ruledOut', 'verdict', 'date', 'staffLabel',
    ]) {
      expect(source).not.toMatch(new RegExp(`export \\{[^}]*\\} from '\\./${module}'`))
    }
  })
  ```

  Run it: fails with `Failed to resolve import "./index"`.
- **Implement** — `src/features/daily-groove/lib/presentation/index.ts`:
  the C1 type declarations plus `export function guessCardView(input:
  GuessCardViewInput): GuessCardView` returning a stub with empty lists. The
  single `export type { Feedback }` re-export is the one admitted by C1 and does
  not match the pattern above (it is `export type`, from `./feedback`, and
  `Feedback` is part of the view model's shape).
- **Green when** — both cases pass.
- **Refactor** — none.

#### Step A2 — The two option lists

Covers: R3, R2a, AC2

- **Test first** — `index.test.ts`: four cases.

  ```ts
  it('offers the twelve roots in the design order in full mode (R3)', () => {
    expect(guessCardView(input()).roots.map((o) => o.value)).toEqual(ROOTS)
  })

  it('offers simple mode’s six roots, including the answer (R3)', () => {
    const view = guessCardView(input({ simple: true }))
    expect(view.roots.map((o) => o.value)).toEqual(simpleRootOptions(DATE, ANSWER))
    expect(view.roots.map((o) => o.value)).toContain('C')
  })

  it('offers the day’s deterministic flavour options in full mode (R3)', () => {
    expect(guessCardView(input()).flavours.map((o) => o.value)).toEqual(
      flavourOptions(DATE, GROOVE, GROOVES),
    )
  })

  it('offers the two families in simple mode (R3)', () => {
    expect(guessCardView(input({ simple: true })).flavours.map((o) => o.value)).toEqual(FAMILIES)
  })
  ```

  `input(overrides)` is the file's one builder: `GROOVE` from the fixture,
  `answer: ANSWER`, `attempts: []`, `date: DATE` (a fixed `new Date(2026, 7,
  29, 12, 0, 0)`), everything else `null`/`false`, `tapSounds: true`.
  Run it: fails with `expected [] to deeply equal [ 'C', 'D♭', … ]`.
- **Implement** — rules 1 and 2 of C1, wrapping each value as
  `{ value, state: 'open' }` for now.
- **Green when** — the four pass.
- **Refactor** — none.

#### Step A3 — The per-option state merge

Covers: R3a, R3b, AC2

- **Test first** — `index.test.ts`: the truth table lifted from
  `GuessCard.optionStatesFor`, six rows, plus the two rows feature-17's cases
  pinned.

  ```ts
  const stateOf = (options: readonly OptionView[], value: string) =>
    options.find((o) => o.value === value)?.state

  it.each([
    ['nothing guessed', [], { C: 'open', G: 'open' }],
    ['a root the player ruled out', [miss('G', wrong, false)], { G: 'out', C: 'open' }],
    ['a confirmed root locks every other out', [miss('C', wrong, true)], { C: 'confirmed', G: 'out' }],
  ])('reads the root row after %s (R3a)', (_name, attempts, expected) => { … })
  ```

  Plus, as their own cases:
  - a confirmed value **absent** from the current option list leaves the row
    unlocked and falls back to ruled-out dimming (feature-17 E2's edge, in both
    directions — root confirmed but not offered, flavour confirmed but not
    offered);
  - `eliminatedCount` roots the app ruled out by narrowing appear as `'out'`
    even though the player never guessed them;
  - the selected value is never made `'out'` by its own selection.

  Run it: fails with `expected 'open' to be 'out'`.
- **Implement** — rule 5 of C1 as a module-private `optionStates` and wire it
  into both lists.
- **Green when** — all rows pass.
- **Refactor** — none. `optionStates` stays private; the door exports the union,
  not the helper.

#### Step A4 — The offered selection

Covers: R3, R2a, AC2

- **Test first** — `index.test.ts`:

  ```ts
  it('offers a stored selection the current row still holds (R3)', () => {
    expect(guessCardView(input({ selectedRoot: 'G' })).selectedRoot).toBe('G')
  })

  it('offers none when the stored root is absent from the row (R3)', () => {
    const absent = ROOTS.find((r) => !simpleRootOptions(DATE, ANSWER).includes(r))
    expect(guessCardView(input({ simple: true, selectedRoot: absent })).selectedRoot).toBeNull()
  })
  ```

  Plus the same pair for the flavour half against `FAMILIES`.
  Run it: fails with `expected 'B♭' to be null`.
- **Implement** — rule 6.
- **Green when** — the four pass.
- **Refactor** — none.

#### Step A5 — Check enablement

Covers: R3, R3c, AC2

- **Test first** — `index.test.ts`, five cases: enabled with both offered and
  `canCheck`; disabled with only one offered; disabled when `canCheck` is false;
  disabled when `revealed`; disabled when the stored root is offered but the
  stored flavour is not.
  Run it: fails with `expected true to be false`.
- **Implement** — rule 7.
- **Green when** — all five pass.
- **Refactor** — none.

#### Step A6 — The check button's label and tone

Covers: R3c, R8, R9, AC2, AC8

This is the **moved** group: the five rows of `CTA_CASES` at
`GuessCard.test.tsx:212`, re-expressed as pure calls. The block at line 212 is
deleted from `GuessCard.test.tsx` in Step C5, not here.

- **Test first** — `index.test.ts`:

  ```ts
  it.each([
    ['nothing chosen', {}, 'Pick a root and a mode'],
    ['only a root', { selectedRoot: 'G' }, 'Pick a mode'],
    ['only a mode', { selectedFlavour: 'Dorian' }, 'Pick a root'],
    ['both chosen', { selectedRoot: 'G', selectedFlavour: 'Dorian', canCheck: true }, 'Check G Dorian'],
    ['a solved day', { selectedRoot: 'C', selectedFlavour: 'Aeolian', solved: true }, 'Solved'],
  ])('asks for the half that is missing with %s (F20 E2 R3c; was GuessCard.test.tsx CTA_CASES)', (_n, over, label) => {
    expect(guessCardView(input(over)).check.label).toBe(label)
  })

  it.each([
    ['idle while a half is missing', {}, 'idle'],
    ['ready once a check is legal', { selectedRoot: 'G', selectedFlavour: 'Dorian', canCheck: true }, 'ready'],
    ['solved once the day is won', { solved: true }, 'solved'],
    ['idle on a revealed day', { selectedRoot: 'G', selectedFlavour: 'Dorian', canCheck: true, revealed: true }, 'idle'],
  ])('tones the control %s (R3c)', (_n, over, tone) => {
    expect(guessCardView(input(over)).check.tone).toBe(tone)
  })
  ```

  Run it: fails with `expected '' to be 'Pick a root and a mode'`.
- **Implement** — rules 8 and 9. The label strings are copied character for
  character out of `GuessCard.tsx`, including the em-dash-free
  `` `Check ${root} ${flavour}` `` shape and `'Pick a root and a mode'`.
- **Green when** — all nine pass.
- **Refactor** — none.

#### Step A7 — The hint box's contents

Covers: R3, AC2

- **Test first** — `index.test.ts`, asserting against the real constants
  imported from `./feedback`, `./moves` and `./coachingMoves` — the same imports
  `GroovePuzzle.guessing.test.tsx` uses:

  ```ts
  it('carries the opening move and no verdict on a fresh day (R3)', () => {
    const hint = guessCardView(input()).hint
    expect(hint.show).toBe(true)
    expect(hint.feedback).toBeNull()
    expect(hint.coaching).toEqual({ message: LADDER[0].message, tone: 'neutral' })
    expect(hint.eliminated).toBeNull()
  })
  ```

  Plus: the verdict appears on the first miss and is suppressed on a repeat miss
  that reveals nothing new (`shouldShowVerdict`'s rule); the coaching switches
  to `COLOUR_MOVES` once a root is confirmed and to `TONIC_MOVES` once a flavour
  is; `SIMPLE_COLOUR_MOVES` under `simple: true`; the `soundsOff` variant under
  `tapSounds: false`; `eliminated` is the narrowing count when the nudge shows
  and `null` when a root is confirmed or the day is solved; `hint.show` is false
  on a solved day and on a revealed day.
  Run it: fails with `expected undefined to be true`.
- **Implement** — rules 11–14.
- **Green when** — the group passes.
- **Refactor** — none. Every wording assertion cites the module constant, never
  a literal string, so feature-18's words stay owned by feature-18's files.

#### Step A8 — The give-up offer and the day being over

Covers: R3, AC2

- **Test first** — `index.test.ts`: `giveUp` is false with zero, one and two
  misses, true on the third miss, false once solved, false once revealed;
  `over` is false on a playable day and true on each of solved and revealed.
  Run it: fails with `expected false to be true`.
- **Implement** — rules 10 and 15.
- **Green when** — the group passes.
- **Refactor** — none.

#### Step A9 — It is a pure function

Covers: R2, R2a, AC1

- **Test first** — `index.test.ts`:

  ```ts
  it('returns equal output for equal input, called twice (R2, AC1)', () => {
    const args = input({ attempts: [miss('G', wrong, false)], selectedRoot: 'F' })
    expect(guessCardView(args)).toEqual(guessCardView(args))
  })

  it('mutates none of its input (R2)', () => {
    const attempts = [miss('G', wrong, false)]
    const frozen = JSON.stringify(attempts)
    guessCardView(input({ attempts }))
    expect(JSON.stringify(attempts)).toBe(frozen)
  })

  it('touches no React, no clock and no storage (R2, AC1)', () => {
    const source = readFileSync(resolve(__dirname, 'index.ts'), 'utf8')
    expect(source).not.toMatch(/from 'react'/)
    expect(source).not.toMatch(/\bnew Date\(/)
    expect(source).not.toMatch(/\bDate\.now\(/)
    expect(source).not.toMatch(/localStorage|sessionStorage/)
  })

  it('reads the same on a day it is not (R2, AC1)', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2027, 0, 1))
      expect(guessCardView(input())).toEqual(BASELINE)
    } finally {
      vi.useRealTimers()
    }
  })
  ```

  The last case is the one that would catch a hidden `new Date()` behind an
  import: the view model must depend on `input.date` alone. Run it: fails if any
  of the four does.
- **Implement** — nothing, if A2–A8 were written to the rules. If the clock case
  fails, the offending call is inside a theory function being handed the wrong
  argument; fix the call, not the test.
- **Green when** — the four pass.
- **Refactor** — none.

### Track B — The session context

#### Step B1 — Called outside the provider, the hook throws

Covers: R4c, AC4b

- **Test first** — `src/features/daily-groove/state/PuzzleSessionContext.test.tsx`:

  ```ts
  it('throws rather than returning a default outside the provider (R4c, AC4b)', () => {
    expect(() => renderHook(() => usePuzzleSessionContext())).toThrow(
      /must be used inside <PuzzleSessionProvider>/,
    )
  })
  ```

  Run it: fails with `Failed to resolve import "./PuzzleSessionContext"`.
- **Implement** — `PuzzleSessionContext.tsx` per C2: a `createContext<PuzzleSessionValue | null>(null)`,
  the provider, and the hook that throws on `null`.
- **Green when** — the case passes.
- **Refactor** — none.

#### Step B2 — Every consumer under one provider reads one instance

Covers: R4b, AC4a

- **Test first** — `PuzzleSessionContext.test.tsx`: render two sibling probes
  inside one provider, each pushing the value it read into a shared array, and
  assert `Object.is(read[0], read[1])` and that both are the object passed in.
  Run it: fails with `expected undefined to be the provided value` before the
  provider forwards its `value`.
- **Implement** — the provider forwards `props.value` untouched.
- **Green when** — the case passes.
- **Refactor** — none.

#### Step B3 — The value carries the session and both settings

Covers: R4a, R4b

- **Test first** — `PuzzleSessionContext.test.tsx`: a probe under a provider fed
  a value built from a real `renderHook(() => usePuzzleSession(GROOVE, DATE))`
  result plus `simple`/`setSimple`/`tapSounds`/`setTapSounds`, asserting the
  probe reads back `groove`, `today`, the four session actions by identity, and
  both settings with their setters.
  Run it: fails on the first key the type does not carry.
- **Implement** — nothing beyond C2's type; the case pins the shape so Track C
  can build against it.
- **Green when** — the case passes and `npx tsc --noEmit` is clean.
- **Refactor** — none.

### Track C — The card feeds itself

**Before the first edit**, record the baseline the reconciliation is checked
against:

```
npx vitest run src/features/daily-groove/components/puzzle/GuessCard.test.tsx
  → 138 passed, duration 5.41s
npm test
  → 114 files, 2306 tests, 40.03s
```

#### Step C1 — The shell provides one session, and the card reads it

Covers: R4b, R4c, AC4a

- **Test first** — `src/features/daily-groove/components/puzzle/GuessCard.test.tsx`,
  two new cases at the top, both through `renderPuzzle()`:

  ```ts
  it('scores a guess made on the card against the shell’s own session (F20 E2 R4b, AC4a)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, 'G', wrongFlavour())

    expect(hintRegion()).toHaveTextContent(/not it|wrong colour|somewhere else/i)
    expect(screen.getByRole('radiogroup', { name: 'Root' })).toBeInTheDocument()
  })

  it('shows the shell’s solved panel when the card solves the day (F20 E2 R4b, AC4a)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, 'C', 'Aeolian')

    expect(control()).toHaveAccessibleName('Solved')
    expect(screen.getByText(CHANGES_READ)).toBeInTheDocument()
  })
  ```

  The second is the rendered proof of one store: the solved panel is the shell's,
  and it only appears if the shell's `solved` is the same store the card mutated.
  Run it: passes today (the card still gets props from the same shell) — this is
  the one step whose test is green before the change. It is written first anyway,
  because it is the case that must **stay** green through C2–C10 and is the
  regression net for the whole rewire.
- **Implement** — `GroovePuzzle.tsx`: wrap `GroovePuzzleView`'s returned
  `<section>` in `<PuzzleSessionProvider value={sessionValue}>`, where
  `sessionValue` is a `useMemo` over `{ groove, today, session, simple,
  setSimple, tapSounds, setTapSounds }`. `usePuzzleSession`'s result is captured
  as one object (`const session = usePuzzleSession(groove, today, simple,
  resultStore)`) and destructured where the shell still needs fields. Both
  `guessCard` placements are inside the provider.
- **Green when** — the two cases pass and the whole suite is still green: at this
  point nothing has been removed, so `GuessCard` still takes 27 props.
- **Refactor** — none yet.

#### Step C2 — The harness reaches a rung without a mock

Covers: R10, R10a

- **Test first** — `GuessCard.test.tsx`, one case that cannot pass without the
  helper:

  ```ts
  it('opens on the rung the stored day left the player at (F20 E2 R10, R10a)', async () => {
    await seedDay(storedDay({ attempts: [miss('G', wrongFlavour(), false)] }))
    await renderPuzzle()

    expect(within(rootGroup()).getByRole('button', { name: 'G' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(hintRegion()).toHaveTextContent(LADDER[1].message)
  })
  ```

  Run it: fails with `seedDay is not a function` — the import does not resolve.
- **Implement** — `testing/puzzleHarness.tsx`: add `ANSWER`, `clearStored`,
  `seedDay`, `seedPreferences`, `storedDay` per C4, and move `soundedNotes` and
  `startedAt` in from `GroovePuzzle.sounding.test.tsx`, which now imports them.
  Add `beforeEach(clearStored)` to `GuessCard.test.tsx`.
- **Green when** — the case passes, and `GroovePuzzle.sounding.test.tsx` still
  reports **63 blocks** with no case changed.
- **Refactor** — none. The helpers use `createLocalStore().save` and
  `createLocalPreferenceStore().update`, never a `localStorage` key literal, so
  the storage envelope's shape stays owned by the persistence module.

#### Step C3 — The prop list is two

Covers: R4, R4a, R5, AC4, AC5

- **Test first** — `GuessCard.test.tsx`: rewrite the disk-reading case at line
  370 and add its sibling.

  ```ts
  it('takes exactly the two callbacks it cannot own (F20 E2 R5, AC5)', () => {
    const source = readFileSync(resolve(__dirname, 'GuessCard.tsx'), 'utf8')
    const block = source.match(/type GuessCardProps = \{([\s\S]*?)\n\}/)
    expect(block).not.toBeNull()
    const members = [...(block as RegExpMatchArray)[1].matchAll(/^\s*(\w+)/gm)].map((m) => m[1])
    expect(members).toEqual(['onHearRoot', 'onHearMode'])
  })

  it('reads its state from the session and its derivation from the door (F20 E2 R4, R4a, AC4)', () => {
    const source = readFileSync(resolve(__dirname, 'GuessCard.tsx'), 'utf8')
    expect(source).toContain("from '../../lib/presentation'")
    expect(source).toContain("from '../../state/PuzzleSessionContext'")
    expect(source).toContain('usePuzzleSessionContext()')
    expect(source).toContain('guessCardView(')
  })
  ```

  The first replaces the old "is never given the day's root" assertion and keeps
  its subject — the card is still shown not to know the answer, now by the
  stronger statement that it knows nothing but two callbacks. Run it: fails with
  `expected [ 'roots', 'flavours', … ] to deeply equal [ 'onHearRoot', 'onHearMode' ]`.
- **Implement** — `GuessCard.tsx`: prop type to C3; body opens with

  ```ts
  const { groove, today, session, simple, setSimple, tapSounds, setTapSounds } =
    usePuzzleSessionContext()
  const view = guessCardView({
    groove,
    date: today,
    answer: session.answer,
    attempts: session.attempts,
    selectedRoot: session.selectedRoot,
    selectedFlavour: session.selectedFlavour,
    solved: session.solved,
    revealed: session.revealed,
    canCheck: session.canCheck,
    simple,
    tapSounds,
  })
  ```

  and every former prop reference is replaced by `view.*` or `session.*`.
  `GroovePuzzle.tsx`: the call site becomes
  `<GuessCard onHearRoot={hearRoot} onHearMode={handleHearMode} />`.
- **Green when** — the two cases pass and `npx tsc --noEmit` is clean.
  `GuessCard.test.tsx` is now almost entirely red — that is expected, and
  C4–C9 turn it green group by group.
- **Refactor** — delete the `props()` builder, the four `Feedback` fixtures and
  the now-unused `vi` import from `GuessCard.test.tsx` once C9 lands, not before:
  the builder is what the remaining red cases still reference.

#### Step C4 — The rows come from the view model, and the card owns the one mapping

Covers: R3a, R3b, AC2, AC3

- **Test first** — `GuessCard.test.tsx`: add

  ```ts
  it('holds the one mapping from the domain state to the design system’s (F20 E2 R3b, AC3)', () => {
    const source = readFileSync(resolve(__dirname, 'GuessCard.tsx'), 'utf8')
    expect(source).not.toContain('optionStatesFor')
    expect(source.match(/ChipOptionState/g) ?? []).toHaveLength(2)
    expect(source).toMatch(/state === 'out'/)
  })
  ```

  and re-express every chip-state case at a seeded rung instead of with props.
  The twelve blocks under `describe('the row locks once a check confirms a
  half (F17 E2)')` and the ruled-out group at lines 789–930 keep their titles,
  their subjects and their assertions; only the setup changes, from
  `props({ ruledOutRoots: […], confirmedRoots: […] })` to
  `await seedDay(storedDay({ attempts: […] }))` plus `await renderPuzzle()`.
  Run it: fails with `expected 3 to be 2` on the mapping case, and with
  `Cannot destructure property 'roots' of props` on the re-expressed ones until
  C3's card lands.
- **Implement** — `GuessCard.tsx`: one module-private

  ```ts
  const chipStates = (
    options: readonly OptionView[],
  ): Record<string, ChipOptionState> => {
    const states: Record<string, ChipOptionState> = {}
    for (const option of options) {
      if (option.state === 'out') states[option.value] = { unavailable: true }
    }
    return states
  }
  ```

  and both `ChipGroup`s take `options={view.roots.map((o) => o.value)}` and
  `optionStates={chipStates(view.roots)}`.
- **Green when** — the chip-state group passes with the same expectations it had
  before, and `optionStatesFor` appears nowhere in `src/`.
- **Refactor** — none.

#### Step C5 — The check control comes from the view model

Covers: R3c, R8, R9, AC2, AC8

- **Test first** — `GuessCard.test.tsx`: delete the `it.each(CTA_CASES)` block at
  line 212 and the `CTA_CASES` array with it — the five cases are now Step A6's,
  cited there by their old name. Re-express the three rendered label cases (lines
  161, 169, 186) and the tone case (line 683) at seeded rungs and through clicks:

  ```ts
  it('prompts and stays disabled until both halves are chosen (R7, AC6)', async () => {
    await renderPuzzle()

    expect(control()).toHaveAccessibleName('Pick a root and a mode')
    expect(control()).toBeDisabled()
  })
  ```

  Run it: `CTA_CASES is not defined` before the deletion, then the rendered ones
  fail on the props the card no longer takes.
- **Implement** — `GuessCard.tsx`: `<Button onPress={disarming(session.check)}
  disabled={!view.check.enabled} tone={view.check.tone} size="lg">
  {view.check.label}</Button>`. The local `label`, `tone` and `bothChosen`
  bindings are deleted.
- **Green when** — the group passes; `GuessCard.test.tsx` is at 133 blocks'
  worth of cases for this group.
- **Refactor** — none.

#### Step C6 — The hint box comes from the view model

Covers: R3, R7, AC2

- **Test first** — `GuessCard.test.tsx`: re-express the hint group (lines
  250–460) at seeded rungs, with every text expectation reading the real
  constant. The subject of each case is unchanged — the live region, the order of
  verdict then coaching then count, the single `aria-live`, the box's label, the
  absence of any root name in the nudge:

  ```ts
  it('shows the coaching under the verdict in the hint box (R12, AC11)', async () => {
    await seedDay(storedDay({ attempts: [miss('C', wrongFlavour(), true)] }))
    await renderPuzzle()

    const verdict = verdictLine() as HTMLElement
    const coaching = coachingLine() as HTMLElement
    expect(nudge()).toContainElement(verdict)
    expect(verdict).toHaveTextContent('Right home note, wrong colour.')
    expect(coaching).toHaveTextContent(COLOUR_MOVES[0].message)
    expect(precedes(verdict, coaching)).toBe(true)
    expect(coaching).toHaveAttribute('data-tone', 'neutral')
  })
  ```

  Run it: fails with `Unable to find an element with the role complementary`
  until the card reads `view.hint`.
- **Implement** — `GuessCard.tsx`:

  ```tsx
  {view.hint.show && (
    <NudgeBox
      feedback={view.hint.feedback}
      coaching={view.hint.coaching}
      eliminated={view.hint.eliminated}
    />
  )}
  ```

  `NudgeBox` is untouched, prop for prop.
- **Green when** — the group passes with the same assertions.
- **Refactor** — none.

#### Step C7 — The give-up path comes from the view model

Covers: R3, R7, AC2

- **Test first** — `GuessCard.test.tsx`: re-express the give-up group (lines
  931–1088) at a seeded three-miss rung. The `armed` two-press behaviour stays
  local to the card, so those cases keep their exact sequences; only the
  observation of "the day ended" changes from `expect(onReveal)
  .toHaveBeenCalledTimes(1)` to the rendered result — the answer on the meta
  line and the solved panel:

  ```ts
  it('ends the day on the second press, exactly once (R7, AC8a)', async () => {
    const user = userEvent.setup()
    await seedDay(storedDay({ attempts: threeMisses() }))
    await renderPuzzle()

    await user.click(giveUp())
    await user.click(giveUp())

    expect(screen.getByText(CHANGES_READ)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /give up/i })).toBeNull()
  })
  ```

  Run it: fails with `Unable to find an element with the text: Cm · Fm · G7 · Cm`.
- **Implement** — `GuessCard.tsx`: `{view.giveUp && (<Button onPress={armed ?
  session.reveal : () => setArmed(true)} …>)}`. Note the guard is now
  `view.giveUp` alone: `showReveal && !revealed` is folded into rule 15.
- **Green when** — the group passes.
- **Refactor** — none.

#### Step C8 — The toggles read the settings from the context

Covers: R4a, R7, AC4

- **Test first** — `GuessCard.test.tsx`: re-express the simple-mode group (lines
  1089–1240) and the tap-sounds group (lines 1736–1936). The `onToggleSimple`
  and `onToggleTapSounds` spies become the rendered consequence — the row's
  contents change, the switch's `aria-checked` moves, the caption swaps — and the
  "settles on a day that is already over" cases seed a solved or revealed day:

  ```ts
  it('reports the mode the player asked for, not the one they left (R1, AC1)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    expect(within(rootGroup()).getAllByRole('button')).toHaveLength(12)
    await user.click(modeSwitch())

    await waitFor(() =>
      expect(within(rootGroup()).getAllByRole('button')).toHaveLength(6),
    )
    expect(modeSwitch()).toBeChecked()
  })
  ```

  A case that needs the day to *open* in simple mode or with the sounds off uses
  `await seedPreferences({ simpleMode: true })` before the mount.
  Run it: fails with `expected 12 to be 6` until the card reads `simple` from the
  context.
- **Implement** — `GuessCard.tsx`: `<ModeToggle simple={simple}
  onChange={disarming(setSimple)} disabled={view.over} />` and
  `<TapSoundsToggle on={tapSounds} onChange={disarming(setTapSounds)} />`; the
  glyph is `adornment={tapSounds ? '♪' : undefined}` on both rows, read from the
  context.
- **Green when** — both groups pass.
- **Refactor** — none.

#### Step C9 — The taps still sound

Covers: R5, R7

- **Test first** — `GuessCard.test.tsx`: re-express the fifteen hear-tap blocks
  against the fake context, using the harness's moved helpers, with
  `installPuzzleAudio()` in the group's `beforeEach`:

  ```ts
  it('reports the root and asks for its note on the same tap (R1, R2, AC1)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(within(rootGroup()).getByRole('button', { name: 'E♭' }))

    expect(within(rootGroup()).getByRole('button', { name: 'E♭' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await soundedNotes(1)
  })
  ```

  and the negative form asserts `expect(fake.sources).toHaveLength(0)`.
  Run it: fails with `expected length 0 to be 1` until the shell's real
  `onHearRoot` is what the card calls.
- **Implement** — nothing in the source: `onHearRoot` and `onHearMode` are
  already the surviving props and `GroovePuzzle.tsx` already passes them. This
  step is test work; if a case fails, the cause is the setup, not the card.
- **Green when** — the fifteen pass, and the overlap with
  `GroovePuzzle.sounding.test.tsx` is written down for the report.
- **Refactor** — now delete `props()`, the four `Feedback` fixtures, the
  `render`/`GuessCard` direct imports and any leftover `vi.fn()` from
  `GuessCard.test.tsx`. `grep -n "props(\|vi.fn()" GuessCard.test.tsx` must
  return nothing.

#### Step C10 — The shell stops calculating

Covers: R6, AC6

- **Test first** — `GuessCard.test.tsx` is the wrong home for a claim about
  `GroovePuzzle.tsx`; the assertion is Step D3's, in `structure.test.ts`. What
  this step is tested by is the existing suite: `GroovePuzzle.guessing.test.tsx`
  (82 blocks), `.page.test.tsx` (38), `.header.test.tsx` (10), `.intro.test.tsx`
  (14), `.sounding.test.tsx` (63) and `.copy.test.tsx` (5) must all pass with
  **no edit**, which is the strongest available statement that nothing the player
  can observe changed (R7, AC7). Run them: green before the deletion, and they
  are the tripwire during it.
- **Implement** — `GroovePuzzle.tsx`: delete the imports of
  `../lib/presentation/feedback`, `../lib/presentation/coaching`,
  `../lib/presentation/verdict`, `../lib/presentation/confirmed` and
  `../lib/presentation/ruledOut`; the value imports of `ROOTS`,
  `simpleRootOptions`, `flavourOptions` and `FAMILIES` (keeping
  `import type { Family }`, `flavourPool`, `loopSecondsOf`, `simpleLickMode`,
  `barChords` and `metaLine`); the nine `useMemo`s for `feedback`, `coaching`,
  `showVerdict`, `showReveal`, `roots`, `flavours`, `narrowing`, `confirmed` and
  `showNudge`; and the three offered-value expressions `offeredRoot`,
  `offeredFlavour` and `canCheckOffered`.
- **Green when** — all six composed files pass untouched, `npm test`,
  `npx tsc --noEmit`, `npm run lint` and `npm run build` are clean.
- **Refactor** — `GroovePuzzle.tsx`'s remaining `useMemo`s are `source`,
  `passes` and the context value. Do not go looking for more to remove: the
  remaining sideways imports are Epic 3's.

#### Step C11 — Shared mode is untouched

Covers: R4b, AC4a

- **Test first** — `GuessCard.test.tsx`, one new case:

  ```ts
  it('records nothing and hydrates nothing on a shared groove (F20 E2 R4b, AC4a)', async () => {
    const user = userEvent.setup()
    await seedDay(storedDay({ attempts: [miss('G', wrongFlavour(), false)], solved: false }))
    await renderPuzzle(<GroovePuzzle groove={GROOVE} mode="shared" />)

    expect(within(rootGroup()).getByRole('button', { name: 'G' })).toHaveAttribute(
      'aria-disabled',
      'false',
    )

    await guess(user, 'G', wrongFlavour())
    await renderPuzzle(<GroovePuzzle groove={GROOVE} mode="shared" />)
    expect(hintRegion()).toHaveTextContent(LADDER[0].message)
  })
  ```

  The stored day is not restored (the read-only store's `get` returns `null`) and
  the guess is not saved. Run it: passes today and must keep passing — this is
  the case that would catch a provider wired above the `resultStore` decision.
- **Implement** — nothing. `createReadOnlyStore` and its `useState` stay exactly
  where they are.
- **Green when** — the case passes.
- **Refactor** — none.

#### Step C12 — The count is reconciled and the clock is recorded

Covers: R8, R9, R10c, AC8, AC10a, AC10b

- **Test first** — no new assertion; this is a measurement step, and the numbers
  go in the epic's report.

  ```
  npx vitest run src/features/daily-groove/components/puzzle/GuessCard.test.tsx
  npx vitest run src/features/daily-groove/lib/presentation/index.test.ts
  npm test
  grep -cE "^\s*(it|test)(\.each)?\(" src/features/daily-groove/components/GroovePuzzle.guessing.test.tsx
  grep -cE "^\s*(it|test)(\.each)?\(" src/features/daily-groove/components/GroovePuzzle.sounding.test.tsx
  ```

- **Green when** — all of:
  - `GuessCard.test.tsx` ≥ **133** cases and its file duration recorded;
  - `GuessCard.test.tsx` + `index.test.ts` ≥ **138** cases (R8's floor,
    corrected);
  - `guessing` = **82** blocks and `sounding` = **63** blocks (AC10a);
  - `npm test` green, wall clock recorded beside the 40.03s baseline (AC10b).
- **Refactor** — none. If the sum comes in under 138, a case was dropped: find it
  in `git diff` rather than adding a new one to make the number.

### Track D — The structure knows what changed

#### Step D1 — `state/` holds the store factory and the session context

Covers: R12, AC11

- **Test first** — `src/features/daily-groove/structure.test.ts`, in the existing
  `describe('daily-groove feature structure')`:

  ```ts
  it('holds the store factory and the session context under state/ (F20 E2 R12)', () => {
    const files = readdirSync(stateDir)
      .filter((name) => !/\.(test|spec)\.tsx?$/.test(name))
      .sort()
    expect(files).toEqual(['PuzzleSessionContext.tsx', 'useDailyGrooveStore.ts'])
  })
  ```

  Run it: fails with `expected [ 'useDailyGrooveStore.ts' ] to deeply equal […]`
  if Track B has not landed, and passes once it has.
- **Implement** — nothing; the assertion describes the tree Track B built.
- **Green when** — it passes and the file's existing cases still do.
- **Refactor** — none.

#### Step D2 — The door exists and knows no design system

Covers: R3b, R11, AC3, AC10

- **Test first** — `structure.test.ts`, a new describe:

  ```ts
  describe('the coaching module has one door', () => {
    it('has an index.ts beside the modules it fronts (F20 E2 R1, R11)', () => {
      expect(existsSync(join(LIB, 'presentation', 'index.ts'))).toBe(true)
      expect(existsSync(join(LIB, 'presentation', 'index.test.ts'))).toBe(true)
    })

    it('imports nothing from the design system (F20 E2 R3b, AC3)', () => {
      const offenders: string[] = []
      for (const file of filesUnder(join(LIB, 'presentation'))) {
        for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
          if (specifier.startsWith('@/components/')) offenders.push(`${file} -> ${specifier}`)
        }
      }
      expect(offenders).toEqual([])
    })
  })
  ```

  Run it: the first fails before Track A, the second passes today — and it must
  keep passing, which is its whole job. Break it deliberately once (add
  `import type { ChipOptionState } from '@/components/controls/ChipGroup'` to
  `index.ts`, see it fail, revert) so the guard is known to work.
- **Implement** — nothing.
- **Green when** — both pass and the deliberate break was seen to fail.
- **Refactor** — none.

#### Step D3 — The shell computes nothing the card renders

Covers: R6, AC6

- **Test first** — `structure.test.ts`, extending
  `describe('GroovePuzzle holds no archive plumbing')` into a sibling:

  ```ts
  describe('GroovePuzzle composes rather than calculates', () => {
    const source = () => readFileSync(join(COMPONENTS, 'GroovePuzzle.tsx'), 'utf8')

    it('imports none of the coaching modules (F20 E2 R6, AC6)', () => {
      const banned = ['feedback', 'coaching', 'verdict', 'confirmed', 'ruledOut']
      const offenders = importSpecifiers(source()).filter((specifier) =>
        banned.some((name) => specifier === `../lib/presentation/${name}`),
      )
      expect(offenders).toEqual([])
    })

    it('computes no offered selection (F20 E2 R6, AC6)', () => {
      for (const binding of ['offeredRoot', 'offeredFlavour', 'canCheckOffered']) {
        expect(source()).not.toContain(binding)
      }
    })

    it('provides the session it creates (F20 E2 R4b)', () => {
      expect(source()).toContain('PuzzleSessionProvider')
    })
  })
  ```

  Run it: all three fail before Track C, with the first naming the five
  specifiers.
- **Implement** — nothing; Track C did the work.
- **Green when** — the three pass. `../lib/presentation/date` is deliberately
  absent from `banned` — `metaLine` is not coaching and the PRD keeps it.
- **Refactor** — none.

#### Step D4 — The other structural guards are untouched

Covers: R12, AC11

- **Test first** — no new test. Run `npx vitest run src/components/structure.test.ts
  src/app/route-boundary.test.ts src/lib/hash.test.ts` and
  `npm run test:gen` for `scripts/grooves/boundary.test.ts`.
- **Implement** — nothing. If any of them needed an edit, this epic touched a
  boundary it had no business touching, and that is a stop-and-report.
- **Green when** — all green with `git diff --stat` showing no change to those
  files.
- **Refactor** — none.

## Integration and verification

### The wire-up, already inside the steps

There is no separate integration step: Step C1 lands the provider, Step C3
lands both new imports in the card, and Step C10 removes the parent's
calculation. The four gates are run at the end of C10 and again in Track E.

### The demo path (AC7, R7)

Walked by hand in the browser after Track C, once with `localStorage` cleared and
once as a returner:

1. First visit — the help panel, the opening move in the hint box, twelve roots,
   four modes, "Pick a root and a mode" disabled.
2. A wrong guess with the right root — the verdict "Right home note, wrong
   colour." above `COLOUR_MOVES[0]`, the guessed root dimmed, the rest live.
3. A second and third miss — the ladder advances, the narrowing count appears
   ("N roots ruled out"), Give up appears on the third.
4. A lock-in — check a guess whose root matches: every other root leaves the row,
   the confirmed chip stays pressed and selectable, and still sounds.
5. Simple mode on and off mid-day — six roots and two families, and back.
6. Tap sounds off — the glyph leaves both rows, the caption drops its tap clause,
   a tap selects and stays silent.
7. Solve — the card reads "Solved", the hint box goes, the solved panel and the
   chord symbols appear, the meta line names the answer.
8. Give up on a fresh day after three misses — two presses, the answer shows, the
   check control stays disabled.
9. A shared link — the shared notice, no date on the meta line, nothing recorded,
   the "play today" link.

Nothing on that walk may differ from the same walk on `main`.

### The numbers the report must carry (AC10b, R10c)

| Measurement | Before | After |
| :-- | :-- | :-- |
| `npm test` wall clock | 40.03s | — |
| `npm test` files / tests | 114 / 2306 | — |
| `GuessCard.test.tsx` duration | 5.41s | — |
| `GuessCard.test.tsx` cases | 138 | — |
| `index.test.ts` cases | 0 | — |
| `GuessCard` call-site props | 27 | — |
| `GroovePuzzle.tsx` lines / `useMemo`s | 406 / 11 | — |

Each measured the same way: one cold run of the same command on the same
machine, reading vitest's own `Duration` and `Tests` lines.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1, D2 |
| R2 | A9 |
| R2a | A2, A4, A9 |
| R3 | A2, A4, A5, A7, A8, C4, C6, C7 |
| R3a | A3, C4 |
| R3b | A3, C4, D2 |
| R3c | A5, A6, C5 |
| R4 | C3 |
| R4a | C3, C8, B3 |
| R4b | B2, B3, C1, C11, D3 |
| R4c | B1, C1 |
| R5 | C3, C9 |
| R6 | C10, D3 |
| R7 | C6, C7, C8, C9, C10, demo path |
| R8 | A6, C12 |
| R9 | A6, C6, C12 |
| R10 | C2, C4–C9 |
| R10a | C2, C3 (refactor), C9 (refactor) |
| R10b | C12 |
| R10c | C12 |
| R11 | A1, D2 |
| R12 | D1, D2, D3, D4 |
| AC1 | A9 |
| AC2 | A2, A3, A4, A5, A6, A7, A8, C4, C5, C6, C7 |
| AC3 | A3, C4, D2 |
| AC4 | C3, C8 |
| AC4a | B2, C1, C11, D3 |
| AC4b | B1 |
| AC5 | C3 |
| AC6 | C10, D3 |
| AC7 | C10 (six composed files unchanged), demo path |
| AC8 | A6, C12 |
| AC9 | C2, C4–C9, C9 (refactor) |
| AC10 | A1, D2 |
| AC10a | C2, C12 |
| AC10b | C12 |
| AC11 | C10, D4 |

## Assumptions

- **The door's flavour pool comes from `GROOVES` inside
  `lib/presentation/index.ts`**, not from an input. `lib/theory/music.ts` closes
  over the same constant today, and `lib/presentation/` is inside the feature, so
  the import is legal where `src/lib/`'s would not be. It keeps `GuessCardViewInput`
  down to session plus settings plus the groove, which is what R2a asks for.
  Determinism is unaffected — the catalogue is a compile-time constant.
- **`OptionState` has three members, not two.** `open`, `confirmed` and `out`.
  The card renders `confirmed` and `open` identically, but the distinction is
  what "the confirmed chip stays live" means in the domain, and it is what makes
  feature-17 E2's rule assertable without rendering.
- **`PuzzleSessionContext.tsx` imports `UsePuzzleSession` type-only.** That gives
  `state/` no runtime dependency on `hooks/` and creates no cycle. Declaring the
  session's shape a second time inside `state/` would duplicate thirteen fields
  and let the two drift.
- **The context carries `groove` and `today` as well as the session and the
  settings.** The view model needs both, the shell already holds both, and a card
  that read its date from a second place would have the second seam the PRD's
  assumptions rule out.
- **`guessCardView` is not memoised.** Called on every render of the card. See
  *Architecture*; a `useMemo` inside the card is available later without moving
  the door.
- **`renderFeature()` in AC9 means "a feature mount from `testing/`".** Rung
  cases use `puzzleHarness.renderPuzzle()` against the fixture groove, because a
  deterministic answer is what a chip-state or coaching-rung assertion needs; the
  three composed-page cases keep `testing/renderFeature.tsx` and today's real
  groove, which is the point of those three.
- **Seeding is done through the persistence module's own `save` and `update`,**
  never a `localStorage` key literal, so the envelope shape stays owned by
  `lib/persistence/`.
- **`GroovePuzzle.sounding.test.tsx` is touched for one import line only.** Two
  helpers move out of it into the harness. No case added, changed or removed; the
  block count stays 63.
- **The five `GroovePuzzle.*.test.tsx` files keep their `vi.mock` of
  `../lib/persistence/storage`.** It is pre-existing, it is inside the feature,
  and rewriting five files' seeding is not this epic's job. R10a binds the new
  work, and the new work uses no mock.
- **`GuessCard.test.tsx` is not split into topic files.** R10b, and the PRD's own
  assumption: whether it wants feature-14's shape one level down is answerable
  only once this lands and the runtime is known.
- **`GuessCard.tsx` will get longer, not shorter.** It sheds a 27-member prop
  type and two derivations, and gains a context read, a view-model call and a
  chip mapping. The PRD is explicit that splitting it is out of scope and that
  its size afterwards is a finding.

## Decision log

### Cycle 1 — 2026-09-03

**Q1. How many props does the call site pass, and how many are derived?**
Decision: **27 and 15**, measured on this tree. Feature-19's uncommitted work
removed `dots` and `dotStates`, so the roadmap's and PRD's 28/13 are one prop and
one derived value out of date; and the PRD's "thirteen derived" excluded the three
offered values it names in the next sentence, which are derived too. The prop
table in *Architecture* is the record.
Changed: Approach, Architecture (both tables), Step C3, the report table.

**Q2. What is `GuessCard.test.tsx`'s real case count?**
Decision: **138** executed cases across **120** `it`/`it.each` blocks, 2341
lines, 5.41s. R8's floor of 115 and the PRD's "142 cases" are both wrong; every
check in this spec uses 138, and 133 for `GuessCard.test.tsx` alone after the
five that move.
Changed: Case reconciliation, Step C12, the report table.

**Q3. What actually moves out of `GuessCard.test.tsx`?**
Decision: **the five rows of `CTA_CASES`, and nothing else on coaching-text
grounds** — because the file contains no coaching-text assertion to move. Every
feedback, coaching, verdict and nudge case there hands the card a synthetic
`Feedback` fixture and asserts the card renders what it was given; the real
wording is asserted in `coaching.test.ts`, `moves.test.ts`,
`coachingMoves.test.ts`, `feedback.test.ts`, `verdict.test.ts` and
`GroovePuzzle.guessing.test.tsx`. The PRD's Q3 answer describes an empty set for
this file. It is not reopened, because R9's *rule* still decides every case
correctly once "what the coaching says" is read as "which value the derivation
produces" — that is the reconciliation table. AC8's second clause is checked
against the enumerated five.
Cost: the file does not shrink and gets roughly 2.4× slower; `index.test.ts` is
net-new coverage rather than a relocation. Recorded rather than hidden.
Changed: Approach, Case reconciliation, Steps A6, C5, C12.

**Q4. How do the fifteen hear-tap blocks survive, given `onHearRoot` and
`onHearMode` stay props a feature mount fills in?**
Decision: **rewritten in place against the fake `AudioContext`**, using
`soundedNotes` moved into the harness. `docs/testing.md` prefers a rendered
observation to a spy, so the mechanism change moves toward the standard. They
stay in `GuessCard.test.tsx` because R8 counts that file and R10b keeps it, even
though several end up close to cases `GroovePuzzle.sounding.test.tsx` already
has; the overlap is reported as a finding for a later cycle rather than resolved
by deleting coverage.
Changed: Architecture ("The taps"), Contracts C4, Step C9.

**Q5. How does a rendered case reach a rung without a `vi.mock` of an internal
path?**
Decision: **seed real `localStorage` through `createLocalStore().save`**, from
harness helpers. `useProgress`'s default store reads it on mount, `hydrate`
restores the rung, `useProgress.integration.test.ts` already proves the path, and
nothing is mocked and nothing is added to a component.
Changed: Architecture ("How a rendered case reaches a rung"), Contracts C4,
Step C2.

**Q6. Does `GuessCard` still need `solved`, `revealed` and the selection?**
Decision: **no.** `over`, `check` and `giveUp` in the view model cover every use
of `solved` and `revealed`, and the offered selection is a view-model field. The
prop type is exactly the two hear callbacks, which is what AC5 reads off disk.
Changed: Contracts C1 and C3, Steps C3, C5, C7.
