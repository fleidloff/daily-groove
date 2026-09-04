# Tech spec — Epic 4: The simple switch settles once the day is over

PRD: [../prd/epic-4-the-simple-switch-settles.md](../prd/epic-4-the-simple-switch-settles.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

One prop, one call site, and the retirement of a rule. `ModeToggle` takes
`disabled` and puts it on the native `<button>`; `GuessCard` passes the `over`
value it already computes. The work that needs care is not the code — it is the
two existing tests and one doc comment that assert the opposite behaviour, which
are rewritten rather than deleted so the record shows the rule was narrowed on
purpose.

Two tracks, both small, both parallel, and nothing here touches a file any other
epic in this feature opens.

## Architecture

`ModeToggle` is already a native `<button role="switch">` with `aria-checked`.
The native `disabled` attribute is therefore the whole mechanism: the browser
declines the click, the space and enter keys, and focus, and every assistive
technology reports the state without being told a second time. No handler
guard, no `aria-disabled`, no pointer-events trick.

The state driving it is `over = solved || revealed`, which `GuessCard` computes
today at line 120 to lock the chips and word the action button. Nothing new is
derived and nothing new is passed down from `GroovePuzzle`.

Feature-7's R8a is narrowed, not deleted: *the switch stays operable for the
whole playable day — it is never locked by having guessed — and settles when the
day ends.* Both halves are load-bearing, and both are tested.

## Contracts

```ts
// src/features/daily-groove/components/puzzle/ModeToggle.tsx
type ModeToggleProps = {
  simple: boolean
  onChange(simple: boolean): void
  /**
   * The day is over. The switch keeps its position and stops responding — the
   * mode is a record of how the day was played, not a control any more.
   */
  disabled?: boolean
}
```

- Optional, defaulting to `false`, so no existing call site or test changes shape.
- `GuessCard` passes `over`; it introduces no second name for that state.

## Tracks

### Track A — The switch can settle

- **Goal** — `ModeToggle` renders disabled when told to, and is unchanged
  otherwise.
- **Owns** — `src/features/daily-groove/components/puzzle/ModeToggle.tsx`,
  `ModeToggle.test.tsx`
- **Depends on** — the `ModeToggleProps` contract only.
- **Parallel with** — B
- **Done when** — its own tests pass.

### Track B — The card decides when, and the old rule is retired

- **Goal** — the switch settles on a finished day, stays live on a playable one,
  and the tests that said otherwise now say this.
- **Owns** — `src/features/daily-groove/components/puzzle/GuessCard.tsx` (the
  `ModeToggle` call site only), `GuessCard.test.tsx`
- **Depends on** — the contract; its tests go green once A lands.
- **Parallel with** — A
- **Done when** — its tests pass and the two rewritten tests assert the new rule.

**No cross-epic seam.** Epics 1–3 touch `SolvedPanel`, `TransportPanel`,
`GroovePuzzle`, `lib/theory/` and the design system. This epic touches
`ModeToggle` and `GuessCard` and nothing else, so it can run in any wave.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B.
- **Wave 2:** Integration.

## Implementation

### Track A — The switch can settle

#### Step A1 — Without the prop, nothing changes

Covers: R3

- **Test first** — `ModeToggle.test.tsx`: render with no `disabled` and assert
  the switch is enabled, is clickable, and calls `onChange` with the opposite of
  `simple`. Run it: passes today. The track's regression guard.
- **Implement** — none.
- **Green when** — green.

#### Step A2 — Disabled means the browser refuses

Covers: R1, R1a, AC1

- **Test first** — same file: render with `disabled` and assert the button has
  the `disabled` attribute, that clicking it calls `onChange` zero times, and
  that pressing space and enter on it call it zero times. Run it: fails with a
  type error — no `disabled` prop.
- **Implement** — `ModeToggle.tsx`: add `disabled?: boolean` and spread it onto
  the `<button>`.
- **Green when** — all three assertions pass and A1 stays green.
- **Refactor** — none.

#### Step A3 — It still says which way it is set

Covers: R4, R5, AC4, AC5

- **Test first** — same file: with `disabled` and `simple`, assert the element
  still has `role="switch"` and `aria-checked="true"`, that its label text is
  still rendered, and that the track decoration is still present. Run it: passes
  if A2 only added an attribute; fails if it took a shortcut and rendered
  something else when disabled.
- **Implement** — none.
- **Green when** — green.

#### Step A4 — It stops looking like a live control

Covers: R6

- **Test first** — same file: with `disabled`, assert the button's `className`
  no longer carries `cursor-pointer` and no longer carries the hover border
  class, and that it does carry a dimmed treatment. Without `disabled`, assert
  all three are as they are today. Run it: fails, the classes are unconditional.
- **Implement** — `ModeToggle.tsx`: make the interactive classes conditional on
  `!disabled`, and add an opacity class when disabled. Keep the focus-visible
  outline in the string — a disabled button never takes focus, so it costs
  nothing and stays correct if the prop is removed.
- **Green when** — both states assert correctly.
- **Refactor** — none.

#### Step A5 — The doc comment says the new rule

Covers: R8

- **Test first** — none. This is a comment, and no test reads it.
- **Implement** — `ModeToggle.tsx`: rewrite the paragraph that reads "switching
  is never itself an attempt, and the control is never locked by having guessed
  (R8a)" to state the narrowed rule and cite this epic — operable for the whole
  playable day, settled once the day is over.
- **Green when** — the comment matches the behaviour; reviewed by eye.

### Track B — The card decides when, and the old rule is retired

#### Step B1 — A playable day keeps its live switch

Covers: R3, AC3

- **Test first** — `GuessCard.test.tsx`: with two attempts spent and the day
  unfinished, assert the switch is enabled and clicking it calls
  `onToggleSimple`. Run it: passes today. Written first because this is the half
  of feature-7's R8a that survives, and it must never be lost in the rewrite.
- **Implement** — none.
- **Green when** — green.

#### Step B2 — A solved day settles it

Covers: R1, R2, R7, AC1

- **Test first** — `GuessCard.test.tsx`: rewrite *leaves the switch operable on
  a day that is already over (R8a, AC8a)* — the same fixture, now asserting the
  switch is disabled, that clicking it calls `onToggleSimple` zero times, and
  that the chips are still disabled as they already were. Rename it to *settles
  the switch on a day that is already over (F11 E4 R1, AC1)*. Run it: fails, the
  switch is still enabled.
- **Implement** — `GuessCard.tsx`: pass `disabled={over}` to `ModeToggle` at
  the existing call site. `over` already exists; do not recompute it.
- **Green when** — the rewritten test passes and B1 stays green.
- **Refactor** — none.

#### Step B3 — A revealed day settles it too

Covers: R2, AC2

- **Test first** — `GuessCard.test.tsx`: rewrite *leaves the switch operable on
  a revealed day too (R8a, AC8a)* the same way, asserting disabled and zero
  calls, renamed to cite this epic. Run it: passes once B2's one-line change is
  in — which is the point: one state, both endings.
- **Implement** — none.
- **Green when** — green.

#### Step B4 — The disarm path is unaffected

Covers: R7

- **Test first** — `GuessCard.test.tsx`: the existing *disarms an armed give-up
  when the mode is switched instead (R6b)* test — run it unchanged. Run it:
  passes; an armed give-up only exists on a playable day, where the switch is
  still live, so `disabled={over}` cannot reach it.
- **Implement** — none.
- **Green when** — green.

#### Step B5 — Nothing else about the day moves

Covers: R7, R7a

- **Test first** — `GuessCard.test.tsx`: on a solved day, assert that after
  clicking the switch the chip row still shows the same options and the dot row
  is unchanged. Run it: passes given B2; it is the check that the unreachable
  path stays unreachable.
- **Implement** — none.
- **Green when** — green.

#### Step B6 — The feature-7 acceptance criterion is annotated, not orphaned

Covers: R8

- **Test first** — none.
- **Implement** — `specs/feature-7/prd/epic-5-simple-mode.md`: leave R8a and
  AC8a as written — they are a record of what was decided then — and add one
  line under each noting that feature-11 Epic 4 narrows them to the playable
  day. A reader who finds the old rule must be able to find the new one.
- **Green when** — both documents agree.

## Integration and verification

- **Demo path** — open the app, spend a wrong guess, flip the switch: it works,
  and the row narrows as it always did. Solve the day: the switch is still there,
  still showing simple on or off, dimmed and unresponsive to click, tap and
  keyboard. Tab through the finished card and confirm focus skips it and lands
  on the next control. Give up on a fresh day and confirm the same.
- **Full suite** — `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run
  build`.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A2, B2 |
| R1a | A2 |
| R2 | B2, B3 |
| R3 | A1, B1 |
| R4 | A3 |
| R5 | A3 |
| R6 | A4 |
| R7 | B2, B4, B5 |
| R7a | B5 |
| R8 | A5, B2, B3, B6 |
| AC1 | A2, B2 |
| AC2 | B3 |
| AC3 | B1 |
| AC4 | A3 |
| AC5 | A3 |
| AC6 | B2, B3 |

## Assumptions

- The dimmed treatment is an opacity class on the button, matching how the
  disabled chips already read; no new token.
- The switch keeps `role="switch"`. A disabled native button is announced as
  unavailable by every screen reader worth supporting, and dropping the role to
  render static text would lose the on/off state that R4 exists to keep.
- `GuessCard` passes `over` rather than `solved`, because the card has one
  terminal state and the PRD says a given-up day is over.
- No focus management is written. The day ends from the check or give-up button,
  so focus is never on the switch at the moment it disables; if that ever changes
  — a keyboard shortcut that solves, say — this becomes a real problem and a real
  requirement.
