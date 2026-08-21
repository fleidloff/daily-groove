# Tech spec — Epic 2: Pick your attributes and guess them

PRD: [../prd/epic-2-pick-and-guess-attributes.md](../prd/epic-2-pick-and-guess-attributes.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Widen the Epic 1 slice from one hard-wired scale guess to an opt-in set of three.
Nothing in the frozen contract changes: `DailyResult.guesses` /
`correctness` are already `Partial` maps, so "attempted" is simply the set of
keys present. Three disjoint tracks: extend the pure scoring/seed logic, add the
new UI atoms (attribute selector, a generalized per-attribute picker, a result
breakdown), then rewire the hook and `GroovePuzzle` to compose them. Tracks 1
and 2 run in parallel behind the new component prop contracts; the compose track
follows.

## Architecture

- **No contract change.** Attempted attributes = `Object.keys(result.guesses)`.
- **Scoring** gains `scoreSelected(groove, guesses)` returning a correctness map
  over exactly the attempted keys — a thin fold over the existing
  `scoreAttribute`.
- **Picker generalization.** `ScalePicker` is replaced by a generic
  `AttributePicker` (attribute + options + value), used for all three attributes.
  `ScalePicker` and its test are removed in the same step.
- **Selection UI.** `AttributeSelector` toggles which attributes are in play;
  only selected attributes render a picker.
- **State.** The Epic 1 Zustand store (`createDailyGrooveStore`) widens its state
  to `{ selectedAttrs, guesses, submitted, result }` and gains
  `toggleAttribute`/`setGuess` actions; `submit` is blocked while `selectedAttrs`
  is empty and builds the `DailyResult` via `scoreSelected`.

## Contracts

Additions to the Epic 1 surface (the Epic 1 `types.ts` is unchanged).

```ts
// lib/scoring.ts  (add)
export function scoreSelected(
  groove: Groove,
  guesses: Partial<Record<Attribute, string>>,
): Partial<Record<Attribute, boolean>>   // one entry per attempted attribute
```

```ts
// components/AttributeSelector.tsx
type AttributeSelectorProps = {
  selected: Attribute[]
  onToggle: (a: Attribute) => void
  disabled?: boolean
}
// components/AttributePicker.tsx  (generalizes ScalePicker)
type AttributePickerProps = {
  attribute: Attribute
  options: string[]
  value: string | null
  onSelect: (v: string) => void
  disabled?: boolean
}
// components/ResultBreakdown.tsx
type BreakdownRow = {
  attribute: Attribute
  attempted: boolean
  guess?: string
  correct?: boolean
  answer: string          // the groove's correct value, always revealed
}
type ResultBreakdownProps = { rows: BreakdownRow[] }
```

## Tracks

### Track A — Scoring & option pools
- **Goal** — `scoreSelected` and chord/progression distractor pools, unit-tested.
- **Owns** — `src/features/daily-groove/lib/scoring.ts`, `lib/seed.ts` (+tests).
- **Depends on** — Epic 1 contracts only.
- **Parallel with** — Track B.
- **Done when** — `lib/` tests pass.

### Track B — UI atoms
- **Goal** — `AttributeSelector`, `AttributePicker`, `ResultBreakdown`.
- **Owns** — `components/AttributeSelector.tsx`, `components/AttributePicker.tsx`,
  `components/ResultBreakdown.tsx` (+tests); removes `components/ScalePicker.*`.
- **Depends on** — the `OptionGroup` DS contract + the new prop contracts.
- **Parallel with** — Track A.
- **Done when** — component tests pass in isolation.

### Track C — Hook & composition
- **Goal** — widened `createDailyGrooveStore` and rewired `GroovePuzzle`.
- **Owns** — `hooks/useDailyGrooveStore.ts`, `components/GroovePuzzle.tsx`
  (+tests).
- **Depends on** — Tracks A and B (contracts; mocks in tests).
- **Parallel with** — none (Wave 2).
- **Done when** — hook + puzzle tests pass; full suite green.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B.
- **Wave 2:** Track C — composes A + B.
- **Wave 3:** Demo verification.

## Implementation

### Track A — Scoring & option pools

#### Step A1 — Score the attempted attributes

Covers: R4, R5, AC4

- **Test first** — `lib/scoring.test.ts`: for a groove
  `{ scale:'C minor', chord:'Dmaj7', progression:'Dm–G–C' }`, assert
  `scoreSelected(g, { scale:'C minor', chord:'A7' })` equals
  `{ scale:true, chord:false }` and has **no** `progression` key. Run it: fails
  — "scoreSelected is not a function".
- **Implement** — add `scoreSelected` folding `scoreAttribute` over the guessed
  keys only.
- **Green when** — correctness map covers exactly the attempted keys.
- **Refactor** — none.

#### Step A2 — Chord & progression distractor pools

Covers: R4

- **Test first** — `lib/seed.test.ts`: assert `CHORD_POOL` and `PROGRESSION_POOL`
  are exported, each length ≥ 6, and contain every `chord` / `progression` value
  used in `GROOVES`. Run it: fails — pools not exported.
- **Implement** — add `CHORD_POOL`, `PROGRESSION_POOL` to `lib/seed.ts`.
- **Green when** — pool assertions pass.
- **Refactor** — none.

### Track B — UI atoms

#### Step B1 — `AttributeSelector`

Covers: R1, R3

- **Test first** — `components/AttributeSelector.test.tsx`: renders three
  toggles; clicking `chord` calls `onToggle('chord')`; `selected=['scale']`
  shows scale checked, others unchecked; `disabled` blocks toggling. Run it:
  fails — component missing.
- **Implement** — `components/AttributeSelector.tsx` per contract.
- **Green when** — toggle + checked-state + disabled assertions pass.
- **Refactor** — none.

#### Step B2 — `AttributePicker` (replaces `ScalePicker`)

Covers: R4, R6

- **Test first** — `components/AttributePicker.test.tsx`: render with
  `attribute='chord'`, options, `value`; picking calls `onSelect`; renders
  exactly the given options via `OptionGroup`; scale behaves identically when
  `attribute='scale'`. Run it: fails — component missing.
- **Implement** — `components/AttributePicker.tsx` wrapping `OptionGroup`; delete
  `components/ScalePicker.tsx` and `ScalePicker.test.tsx`.
- **Green when** — picker tests pass; the removed `ScalePicker` no longer
  referenced (suite green).
- **Refactor** — this step *is* the refactor of Epic 1's `ScalePicker`.

#### Step B3 — `ResultBreakdown`

Covers: R4, AC2

- **Test first** — `components/ResultBreakdown.test.tsx`: given rows for scale
  (attempted, correct), chord (attempted, wrong, answer shown), progression
  (not attempted → "skipped"), assert each row renders its state and the answer
  is always visible. Run it: fails — component missing.
- **Implement** — `components/ResultBreakdown.tsx` per contract.
- **Green when** — correct / wrong / skipped rows render as asserted.
- **Refactor** — none.

### Track C — Hook & composition

> State lives in the Epic 1 Zustand store (`createDailyGrooveStore`); these steps
> widen it.

#### Step C1 — Widen the daily-groove store

Covers: R2, R5

- **Test first** — `hooks/useDailyGrooveStore.test.ts`: initial `selectedAttrs=[]`,
  `guesses={}`; `toggleAttribute('scale')` adds it; `setGuess('scale','C minor')`
  records it; `submit` with an empty `selectedAttrs` is a **no-op**
  (`submitted` stays false); after selecting + guessing, `submit` sets
  `submitted` and a `result` whose `guesses`/`correctness` cover only the
  attempted attributes (mocked `scoreSelected`). Run it: fails on the new
  actions.
- **Implement** — widen the store's state and actions: add `selectedAttrs`,
  `guesses`, `toggleAttribute`, `setGuess`, and a guarded `submit` building the
  `DailyResult` via `scoreSelected` + `isoDate`.
- **Green when** — all transitions pass, including the empty-selection guard.
- **Refactor** — none.

#### Step C2 — Rewire `GroovePuzzle`

Covers: R1, R2, R3, R4, R6, AC1, AC2, AC3

- **Test first** — `components/GroovePuzzle.test.tsx` (lib mocked): (a) select
  scale + chord → only those two pickers render, progression has none (AC1, R3);
  (b) answer both, submit → breakdown marks scale/chord and shows progression
  skipped (AC2); (c) no attribute selected → submit is disabled/blocked with a
  prompt (AC3, R2); (d) all three selected with mixed answers → each row
  independent (R4). Run it: fails — puzzle still scale-only.
- **Implement** — rewire `GroovePuzzle` to render `AttributeSelector`, an
  `AttributePicker` per selected attribute (options via `buildOptions` from each
  pool), a guarded submit, and `ResultBreakdown`.
- **Green when** — all four assertions pass; full suite green.
- **Refactor** — drop any scale-only leftovers from Epic 1's puzzle.

## Integration and verification

#### Step I1 — Manual demo (PRD demo path)

- `npm run dev`: play today's groove → select scale + chord, leave progression
  off → answer → submit → breakdown marks the two attempted parts and shows
  progression as skipped (AC1/AC2). Try submitting with nothing selected → blocked
  (AC3). Select all three with a deliberate wrong answer → mixed breakdown (R4).

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | B1, C2 |
| R2 | C1, C2 |
| R3 | B1, B2, C2 |
| R4 | A1, A2, B3, C2 |
| R5 | A1, C1 |
| R6 | B2, C2 |
| AC1 | C2, I1 |
| AC2 | B3, C2, I1 |
| AC3 | C1, C2, I1 |
| AC4 | A1, C2, I1 |

## Assumptions

- **No `types.ts` change** — `Partial` maps already model opt-in attributes;
  attempted = present keys.
- The distractor/option-count pattern and count (4) match Epic 1 (`buildOptions`
  seeded per date + attribute).
- Selected attributes are answered and submitted together (one submit action),
  matching the PRD.
- State widens the Epic 1 Zustand store (`createDailyGrooveStore`); this spec
  adds **no** new architectural question of its own.

## Decision log

_This epic introduced no architectural questions of its own. It inherits Epic
1's Cycle 1 decision to hold puzzle state in a per-instance Zustand store, which
this spec's Track C widens (state `selectedAttrs`/`guesses`, actions
`toggleAttribute`/`setGuess`)._
