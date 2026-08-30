# Tech spec — Epic 3: The attempt row stops lying

PRD: [../prd/epic-3-the-attempt-row-stops-lying.md](../prd/epic-3-the-attempt-row-stops-lying.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Three behaviours, three seams, and they barely touch.

The **reveal threshold** is a fourth pure derivation in
`lib/presentation/feedback.ts`, sitting beside `shouldShowNudge` over the same
input. The **terminal state** is a `revealed` boolean that travels the same road
`solved` already travels — store field, `hydrate`, `DailyResult`, `useProgress`
— so nothing new is invented for it. The **auto-selected root** is the one piece
that is not a derivation: selecting a chip is an action, so it belongs where the
other selection actions live, in the store, which already closes over the day's
answer.

The arming of the give-up control is the exception to all of that: it is
transient UI state for one card, it must not survive a reload, and nothing else
reads it. It stays `useState` inside `GuessCard`.

## Architecture

```
attempts[] ──► feedback.ts   shouldShowNudge(attempts, solved)     (exists)
                             shouldOfferReveal(attempts, solved, revealed)  (new)
                             dotStates(attempts, solved)           (exists)

store       ──► selectedRoot / selectedFlavour / attempts / solved (exists)
                revealed                                            (new)
                check()   — on the 2nd miss, also sets selectedRoot = answer.root
                reveal()  — sets revealed, leaves attempts alone

DailyResult ──► { date, answer, attempts, solved, grooveId, revealed? }

GuessCard   ──► useState armed          — transient, never persisted
```

**Why the auto-select lives in `check()`.** The store already closes over
`answer` and is the only writer of `selectedRoot`. Putting the rule there means
one place decides what is selected, it happens synchronously with the miss that
triggers it, and no effect has to watch a count and write back. An effect in
`usePuzzleSession` or `GroovePuzzle` would be a second writer racing the first,
and would fire again on every re-render unless latched.

**Why `revealed` is store state and not just a record field.** `solved` is
already both — store state for the session, `DailyResult` field for the reload —
and `hydrate` is what joins them. A `revealed` that lived only in `useProgress`
would make `GuessCard` read two sources for one question, and would not survive
`hydrate`'s reset path.

**What a revealed day renders.** `SolvedPanel` grows a `revealed` prop rather
than a second component: the panel's content is identical bar one line, and two
components sharing a layout is the duplication `docs/architecture.md` warns
about. With `revealed`, the "solved in *n* tries · streak now *k*" line is
replaced by a line naming the day as given up.

## Contracts

Frozen before the tracks start.

```ts
// src/features/daily-groove/lib/presentation/feedback.ts
/** The reveal is offered from this many misses, and stays until the day ends. */
export function shouldOfferReveal(
  attempts: Attempt[],
  solved: boolean,
  revealed: boolean,
): boolean
```

```ts
// src/features/daily-groove/types.ts
export type DailyResult = {
  date: string
  answer: Answer
  attempts: Attempt[]
  solved: boolean
  grooveId?: string
  /** The day was given up on. Absent on records written before feature-7. */
  revealed?: boolean
}
```

```ts
// src/features/daily-groove/state/useDailyGrooveStore.ts
export type DailyGrooveState = {
  // …existing…
  revealed: boolean
  /** End the day without solving it. Idempotent; a solved day ignores it. */
  reveal(): void
}
```

```ts
// src/features/daily-groove/hooks/usePuzzleSession.ts
export type UsePuzzleSession = {
  // …existing…
  revealed: boolean
  reveal(): void
}
```

```ts
// src/features/daily-groove/components/puzzle/GuessCard.tsx
type GuessCardProps = {
  // …existing…
  revealed: boolean
  showReveal: boolean
  onReveal(): void
}

// src/features/daily-groove/components/puzzle/SolvedPanel.tsx
type SolvedPanelProps = {
  // …existing…
  revealed: boolean
}
```

## Tracks

### Track A — The derivation

- **Goal** — `shouldOfferReveal` exists and is proven over the attempt list.
- **Owns** — `lib/presentation/feedback.ts` and `feedback.test.ts`.
- **Depends on** — nothing.
- **Parallel with** — Tracks B and C.
- **Done when** — `feedback.test.ts` passes.

### Track B — The terminal state

- **Goal** — a day can be revealed, the reveal persists, and the second miss
  selects the root.
- **Owns** — `types.ts`, `state/useDailyGrooveStore.ts`, `hooks/useProgress.ts`,
  `hooks/usePuzzleSession.ts` and their tests.
- **Depends on** — the `DailyResult` and `DailyGrooveState` contracts.
- **Parallel with** — Tracks A and C.
- **Done when** — the store and hook tests pass with no component rendered.

### Track C — The card and the panel

- **Goal** — the dots explain themselves, the give-up control arms and fires,
  and a revealed day renders without claiming a win.
- **Owns** — `components/puzzle/AttemptDots.tsx`,
  `components/puzzle/GuessCard.tsx`, `components/puzzle/SolvedPanel.tsx` and
  their tests.
- **Depends on** — the `GuessCardProps` and `SolvedPanelProps` contracts. It
  builds against props and needs neither Track A nor Track B to exist.
- **Parallel with** — Tracks A and B.
- **Done when** — its component tests pass, driven entirely from props.

### Track D — Integration

- **Goal** — `GroovePuzzle` wires the three together and the feature tests pass
  end to end.
- **Owns** — `components/GroovePuzzle.tsx`, `GroovePuzzle.test.tsx`,
  `structure.test.ts`.
- **Depends on** — A, B and C all merged.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C
- **Wave 2:** Track D — the only step that needs all three

## Implementation

### Track A — The derivation

#### Step A1 — The reveal is offered from the third miss

Covers: R6, R11, AC6, AC7

- **Test first** — `lib/presentation/feedback.test.ts`: assert
  `shouldOfferReveal(misses(2), false, false)` is `false`,
  `shouldOfferReveal(misses(3), false, false)` is `true`, and
  `shouldOfferReveal(misses(5), true, false)` is `false` — a solved day never
  offers it. Run it: fails with `shouldOfferReveal is not a function`.
- **Implement** — `feedback.ts`: add `const REVEAL_AFTER_MISSES = 3` beside
  `NUDGE_AFTER_MISSES`, and `shouldOfferReveal(attempts, solved, revealed)`
  returning `!solved && !revealed && missCount(attempts) >= REVEAL_AFTER_MISSES`,
  reusing the existing private `missCount`.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step A2 — A revealed day stops offering it

Covers: R11, R12, AC12

- **Test first** — `feedback.test.ts`: assert `shouldOfferReveal(misses(4),
  false, true)` is `false`, and that calling it twice with the same arguments
  returns the same value with no module state involved. Run it: passes if A1
  included the `revealed` guard; fails otherwise.
- **Implement** — none if A1 is complete.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step A3 — Four misses leave the dots full

Covers: R3, AC2

- **Test first** — `feedback.test.ts`: assert `dotStates(misses(4), false)` has
  length 3 and every entry is `'spent'`. Run it: passes today — `dotStates`
  already clamps. The step pins R3 against the reveal work, which is the change
  most likely to tempt someone into extending the row.
- **Implement** — none.
- **Green when** — the assertion passes.
- **Refactor** — none.

### Track B — The terminal state

#### Step B1 — The store can end a day without solving it

Covers: R7, R9, R12

- **Test first** — `state/useDailyGrooveStore.test.ts`: create a store, call
  `reveal()`, assert `revealed` is `true`, `solved` is `false`, and `attempts`
  is unchanged. Then assert a further `check()` with a fresh valid pair records
  no attempt. Run it: fails with `reveal is not a function`.
- **Implement** — `useDailyGrooveStore.ts`: add `revealed: false` to the initial
  state and a `reveal()` action setting `revealed: true`, guarded to no-op when
  `solved`. Extend `canCheck()` to return `false` when `revealed`.
- **Green when** — all four assertions pass, and every existing store test stays
  green.
- **Refactor** — none.

#### Step B2 — The second miss selects the day's root

Covers: R4, R5, AC3, AC4

- **Test first** — `useDailyGrooveStore.test.ts`: with an answer of
  `{ root: 'E', flavour: 'Dorian' }`, check two wrong pairs and assert
  `selectedRoot === 'E'` afterwards. Then call `selectRoot('C')`, check a third
  wrong pair, and assert `selectedRoot === 'C'` — the rule fires once, not on
  every subsequent miss. Run it: fails, `selectedRoot` is the last guessed root.
- **Implement** — `useDailyGrooveStore.ts`: in `check()`, after appending the
  attempt, if the new miss count is exactly `2` and the attempt was wrong, also
  set `selectedRoot: answer.root`. Exactly `2`, not `>= 2`, is what makes it
  fire once.
- **Green when** — both assertions pass.
- **Refactor** — none. The miss count is derived from the new attempt list
  inline; do not add a stored counter.

#### Step B3 — A revealed day survives a reload

Covers: R8, R9, R13, AC9, AC13

- **Test first** — `useDailyGrooveStore.test.ts`: `hydrate({ …, revealed: true })`
  and assert `revealed` is `true` and `canCheck()` is `false`. Then
  `hydrate({ … })` with no `revealed` key and assert `revealed` is `false`. Then
  `hydrate(null)` and assert `revealed` is `false`. Run it: fails — `hydrate`
  does not set the field.
- **Implement** — `useDailyGrooveStore.ts`: `hydrate` sets
  `revealed: result?.revealed ?? false` on both the record and the null path.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step B4 — The record carries the flag

Covers: R9, R13

- **Test first** — `hooks/useProgress.test.ts`: call `recordAttempt` with
  `revealed: true` against a mock `ResultStore` and assert the saved
  `DailyResult` has `revealed: true`. Assert a call without it saves a record
  whose `revealed` is `undefined`, not `false` — absent, so old records and new
  unrevealed ones look the same. Run it: fails, `DayProgress` has no such field.
- **Implement** — `types.ts`: add `revealed?: boolean` to `DailyResult`.
  `useProgress.ts`: add `revealed?: boolean` to `DayProgress` and spread it into
  the record.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step B5 — The session exposes the reveal

Covers: R7, R8, R9

- **Test first** — `hooks/usePuzzleSession.test.ts`: render the hook, call
  `reveal()`, and assert `revealed` is `true` and that the injected store
  received a `save` with `revealed: true`. Run it: fails with `reveal is not a
  function`.
- **Implement** — `usePuzzleSession.ts`: read `revealed` and the store's
  `reveal` through `useStore`; wrap `reveal` in a `useCallback` that calls the
  store action then `recordAttempt({ answer, attempts, solved, grooveId,
  revealed: true })`. Return both from the hook.
- **Green when** — both assertions pass.
- **Refactor** — `check` and `reveal` now build the same record shape; extract a
  local `persist(partial)` helper if the duplication is more than two lines.

#### Step B6 — A revealed day does not extend the streak

Covers: R10, AC11

- **Test first** — `lib/persistence/streak.test.ts`: build results where
  yesterday is solved and today is `{ solved: false, revealed: true }`, and
  assert `computeStreak` returns the run ending yesterday — the revealed day
  neither extends nor is skipped. Run it: passes today, because `isQualifying`
  keys on `solved` alone.
- **Implement** — none. This step exists to prove the "no change to
  `streak.ts`" claim in the PRD's *Out of scope*, and to fail loudly if someone
  later teaches the streak about `revealed`.
- **Green when** — the assertion passes and `streak.ts` is unmodified.
- **Refactor** — none.

### Track C — The card and the panel

#### Step C1 — The dots say what they mean

Covers: R1, R2, AC1

- **Test first** — `components/puzzle/AttemptDots.test.tsx`: render with two
  spent dots and assert the element's accessible name contains both the spent
  count and the words explaining that three is par and guessing continues, and
  that `getByRole('img')` has a matching `title` attribute. Run it: fails — the
  current label is `2 of 3 attempts spent` and there is no `title`.
- **Implement** — `AttemptDots.tsx`: extend `labelFor` to append the
  explanation, and pass the same string to a `title` attribute on the wrapping
  `<span>`. The solved branch keeps its own short label.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step C2 — No tooltip component appears

Covers: R2, AC1

- **Test first** — `src/components/structure.test.ts`: assert no file under
  `src/components/` has a name matching `/Tooltip/`. Run it: passes today; it
  pins the decision that this epic adds no primitive.
- **Implement** — none.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step C3 — The give-up control arms

Covers: R6, R6a, AC6, AC8

- **Test first** — `components/puzzle/GuessCard.test.tsx`: render with
  `showReveal={false}` and assert no give-up control. Re-render with
  `showReveal`, assert a button reading "Give up and show the answer", press it
  once, and assert `onReveal` was *not* called and the button now reads a
  confirming label naming what it will do. Run it: fails — the prop and control
  do not exist.
- **Implement** — `GuessCard.tsx`: add the three contract props, a
  `const [armed, setArmed] = useState(false)`, and below `FeedbackLine` a
  control rendered when `showReveal`. Its label is `armed ? 'Yes — end the day
  and show the answer' : 'Give up and show the answer'`; its handler is
  `armed ? onReveal : () => setArmed(true)`.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step C4 — The second press ends the day

Covers: R7, AC8a

- **Test first** — `GuessCard.test.tsx`: press the armed control and assert
  `onReveal` was called exactly once. Run it: fails if C3 wired the handler
  wrongly.
- **Implement** — none if C3 is correct.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step C5 — Doing anything else disarms it

Covers: R6b, AC8b, AC8c

- **Test first** — `GuessCard.test.tsx`: arm the control, then click a root
  chip; assert the control reads the unarmed label again and `onReveal` was not
  called. Repeat with the check control instead of a chip. Run it: fails — the
  armed flag is sticky.
- **Implement** — `GuessCard.tsx`: wrap `onSelectRoot`, `onSelectFlavour` and
  `onCheck` in local handlers that call `setArmed(false)` first. No effect, no
  timer.
- **Green when** — both assertions pass.
- **Refactor** — the three wrappers are the same shape; a single
  `const disarming = (fn) => (...args) => { setArmed(false); fn(...args) }`
  reads better than three inline arrows.

#### Step C6 — A revealed card is inert

Covers: R7, AC8a

- **Test first** — `GuessCard.test.tsx`: render with `revealed`, assert every
  chip is disabled, the check control is disabled, and no give-up control is
  present. Run it: fails — `disabled` is currently `solved` alone.
- **Implement** — `GuessCard.tsx`: both `ChipGroup`s take `disabled={solved ||
  revealed}`; the check control's `disabled` and `tone` account for `revealed`;
  `showReveal` is false once revealed, which Track A's derivation already
  guarantees.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step C7 — The panel shows the solution without claiming it

Covers: R10, R10a, AC10, AC10a

- **Test first** — `components/puzzle/SolvedPanel.test.tsx`: render with
  `revealed`, and assert the chord, the progression and every scale note are
  present, that no text matches `/solved in/`, and that no text matches
  `/streak now/`. Then render with `revealed={false}` and assert the tries line
  is back. Run it: fails — the panel always renders the tries line.
- **Implement** — `SolvedPanel.tsx`: add the `revealed` prop; replace the
  `Text` holding `solved in … · streak now …` with a revealed variant reading
  the day as given up. `PanelColumns` and both `LabelledColumn`s are untouched.
- **Green when** — all assertions pass.
- **Refactor** — none.

### Track D — Integration

#### Step D1 — The puzzle wires the three together

Covers: R4, R6, R7, R8, AC3, AC6, AC8a, AC9

- **Test first** — `components/GroovePuzzle.test.tsx`: play three wrong guesses
  through the rendered feature, assert the give-up control appears, press it
  twice, and assert the answer panel is on screen and the chips are dead.
  Separately, seed the injected store with a `revealed: true` record for today
  and assert the page renders the terminal state on first paint. Run it: fails —
  `GroovePuzzle` passes none of the new props.
- **Implement** — `GroovePuzzle.tsx`: pull `revealed` and `reveal` from
  `usePuzzleSession`; compute `showReveal` with `shouldOfferReveal(attempts,
  solved, revealed)` in a `useMemo` beside the existing three; pass `revealed`,
  `showReveal` and `onReveal` to `GuessCard`; render `SolvedPanel` when `solved
  || revealed`, passing `revealed`.
- **Green when** — both assertions pass and the existing suite stays green.
- **Refactor** — none.

#### Step D2 — The auto-select is visible end to end

Covers: R4, R5, AC3, AC4, AC5

- **Test first** — `GroovePuzzle.test.tsx`: guess wrong twice through the UI and
  assert the correct root's chip is now pressed, the nudge box is present, and
  no chip is disabled. Then press a different root chip and assert the
  selection follows the player. Run it: fails if Step B2 landed the rule
  anywhere but the store.
- **Implement** — none expected.
- **Green when** — all assertions pass.
- **Refactor** — none.

#### Step D3 — The structural test knows the tree

Covers: R12

- **Test first** — `src/features/daily-groove/structure.test.ts`: run it. If
  Track C added no new component file, `REGIONS` is already correct and it
  passes; if a `RevealControl` component was extracted, this fails naming it.
- **Implement** — add any new component name to the `puzzle` region list.
- **Green when** — the structural suite passes.
- **Refactor** — none.

## Integration and verification

- **Demo path** — `npm run dev`. Guess wrong twice: the nudge appears and its
  root is already selected. Guess wrong a third time: "Give up and show the
  answer" appears. Press it once — it asks to confirm. Press a chip — it goes
  back to asking. Press it twice — the answer panel appears with the changes and
  the notes, no tries line, and the chips are dead. Reload: the same terminal
  state. Tomorrow: the streak has not advanced.
- **Keyboard pass** — tab to the dot row and confirm the explanation is in its
  accessible name; tab to the give-up control and drive both presses from the
  keyboard.
- **Full suite** — `npm test`, `npm run lint`, `npm run build` clean.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | C1 |
| R2 | C1, C2 |
| R3 | A3 |
| R4 | B2, D2 |
| R5 | B2, D2 |
| R6 | A1, C3, D1 |
| R6a | C3, C4 |
| R6b | C5 |
| R7 | B1, C4, C6, D1 |
| R8 | B3, B5, D1 |
| R9 | B1, B3, B4 |
| R10 | B6, C7 |
| R10a | C7 |
| R11 | A1, A2 |
| R12 | A2, D3 |
| R13 | B3, B4 |
| AC1 | C1, C2 |
| AC2 | A3 |
| AC3 | B2, D2 |
| AC4 | B2, D2 |
| AC5 | D2 |
| AC6 | A1, C3, D1 |
| AC7 | A1 |
| AC8 | C3 |
| AC8a | C4, C6, D1 |
| AC8b | C5 |
| AC8c | C5 |
| AC9 | B3, D1 |
| AC10 | C7 |
| AC10a | C7 |
| AC11 | B6 |
| AC12 | A2 |
| AC13 | B3, B4 |

## Assumptions

- The give-up control is a `Button` with `tone="idle"`, which is the muted
  treatment and reads as secondary next to the check control's `ready`.
- Its confirming label states the consequence rather than asking "Sure?", so the
  second press is a decision.
- `armed` is `useState` in `GuessCard` and is never lifted, never persisted, and
  never derived. A reload lands unarmed.
- The revealed line in `SolvedPanel` uses the existing `inverted-muted` tone, so
  no new token is introduced.
- `shouldOfferReveal` takes `revealed` as a third argument rather than reading a
  store: `feedback.ts` is a pure module and stays one.

## Decision log

Settled architectural decisions. The sections above are the source of truth —
this records how they got there, and what each one cost. Append-only: never
rewrite or prune a past cycle.

### Cycle 1 — 2026-08-30

**Q1. Where does the second miss select the root?**
Decision: **A) Inside the store's `check()`** — it already closes over `answer`
and is the only writer of `selectedRoot`, so the rule needs no effect, no latch
and no second writer, and it fires synchronously with the miss that triggers it.
Changed: nothing. The Architecture section and Step B2 were drafted against this
choice; the alternatives would have moved B2's assertions out of the store test
and into a hook or component test.

**Q2. Where does `revealed` live?**
Decision: **A) Store state plus a `DailyResult` field, hydrated exactly as
`solved` is** — it is the same kind of fact as `solved` and needs the same
reload behaviour, and `hydrate` is what already joins the two.
Changed: nothing. Contracts, Track B and `GuessCardProps` were drafted against
this choice.
