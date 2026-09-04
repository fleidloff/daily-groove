# Tech spec — Epic 3: Attempts, feedback, and the nudge

PRD: [../prd/epic-3-attempts-feedback-and-the-nudge.md](../prd/epic-3-attempts-feedback-and-the-nudge.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Almost all of this epic is a pure function. Given the answer and the attempt list,
which feedback shows, whether the nudge is up, and what each of the three dots
looks like are all derivable with no state of their own — Epic 2's store already
holds everything needed. So the logic goes in `lib/feedback.ts`, tested directly,
and the UI is three small presentational components fed by it.

That split is what makes the epic safe: the branching that is easy to get wrong
gets exhaustive unit tests, and the components only have to render what they are
handed.

## Architecture

```
src/features/daily-groove/
  lib/feedback.ts     NEW   selectFeedback, nudgeState, dotStates   (Track A)
  components/AttemptDots.tsx   NEW                                  (Track B)
  components/FeedbackLine.tsx  NEW                                  (Track B)
  components/NudgeBox.tsx      NEW                                  (Track B)
  components/GuessCard.tsx     composes the three                   (Track C)
```

Feedback is derived, never stored. The nudge appears once two attempts have failed
and stays for the rest of the day, which falls out of `attempts.filter(a =>
!a.correct).length >= 2` rather than needing a latch. The dot row is always three
entries long regardless of how many attempts have been spent, so a fourth guess
leaves it visually full.

## Contracts

```ts
// src/features/daily-groove/lib/feedback.ts
export type FeedbackTone = 'neutral' | 'warm' | 'solved'

export type Feedback = { message: string; tone: FeedbackTone }

export type DotState = 'unspent' | 'spent' | 'solved'

export function selectFeedback(attempts: Attempt[], solved: boolean): Feedback
export function shouldShowNudge(attempts: Attempt[], solved: boolean): boolean
export function dotStates(attempts: Attempt[], solved: boolean): DotState[]  // always length 3
```

- `AttemptDots({ states })`
- `FeedbackLine({ feedback })`
- `NudgeBox({ root })`

## Tracks

### Track A — Feedback logic

- **Goal** — every branch of feedback, nudge visibility and dot state, as pure
  functions.
- **Owns** — `lib/feedback.ts` and its test
- **Depends on** — Epic 2's `Attempt` contract only
- **Parallel with** — Track B
- **Done when** — its tests pass with no UI present.

### Track B — Presentational components

- **Goal** — the dot row, the feedback line and the nudge box render what they are
  given.
- **Owns** — `components/AttemptDots.tsx`, `FeedbackLine.tsx`, `NudgeBox.tsx` and
  their tests
- **Depends on** — the `DotState` and `Feedback` contracts only
- **Parallel with** — Track A
- **Done when** — its tests pass against hand-built props.

### Track C — Wiring into the card

- **Goal** — the card shows all three, driven by props from `GroovePuzzle`.
- **Owns** — `components/GuessCard.tsx`
- **Depends on** — Tracks A and B as built code
- **Parallel with** — none

## Execution waves

- **Wave 1 (parallel):** Track A, Track B
- **Wave 2:** Track C
- **Wave 3:** Integration

## Implementation

### Track A — Feedback logic

#### Step A1 — Before any guess, the line is opening guidance

Covers: R4, AC4

- **Test first** — `lib/feedback.test.ts`: assert `selectFeedback([], false)`
  returns the opening guidance with tone `neutral`. Run it: fails,
  `selectFeedback` is not a function.
- **Implement** — `lib/feedback.ts`: the empty-attempts branch.
- **Green when** — the opening message and tone come back.
- **Refactor** — none.

#### Step A2 — A right root and wrong flavour says so

Covers: R3, AC5

- **Test first** — same file: with one attempt where `rootMatched` is true and
  `flavourMatched` false, assert the message names the root as right and the tone
  is `warm`. Run it: fails, the opening guidance comes back instead.
- **Implement** — `lib/feedback.ts`: branch on the last attempt.
- **Green when** — the root-matched wording returns.
- **Refactor** — none.

#### Step A3 — A right flavour and wrong root says so

Covers: R3, AC6

- **Test first** — same file: the mirror case; assert the message names the flavour
  as close and the tonic as elsewhere. Run it: fails, the root branch is returned.
- **Implement** — `lib/feedback.ts`: the second branch.
- **Green when** — the flavour-matched wording returns.
- **Refactor** — none.

#### Step A4 — Neither half right says so

Covers: R3, AC7

- **Test first** — same file: both flags false; assert the "not it, no penalty"
  wording with tone `warm`. Run it: fails, an earlier branch matches.
- **Implement** — `lib/feedback.ts`: the fallback branch.
- **Green when** — the neither-matched wording returns.
- **Refactor** — collapse the three branches into a lookup keyed on the two flags.

#### Step A5 — Solving overrides everything

Covers: R9, AC13

- **Test first** — same file: with `solved` true and three attempts, assert the
  solved wording and tone `solved`, regardless of the last attempt's flags. Run it:
  fails, a warm branch is returned.
- **Implement** — `lib/feedback.ts`: check `solved` first.
- **Green when** — the solved branch wins.
- **Refactor** — none.

#### Step A6 — The nudge appears on the second miss and stays

Covers: R5, AC8

- **Test first** — same file: assert `shouldShowNudge` is false with zero and one
  failed attempt, true at two, and still true at four; and false when `solved`.
  Run it: fails, not a function.
- **Implement** — `lib/feedback.ts`: count failures, compare to two, and gate on
  `!solved`.
- **Green when** — all five cases hold.
- **Refactor** — none.

#### Step A7 — The dot row is always three long

Covers: R1, R2, AC1, AC2, AC3

- **Test first** — same file: assert `dotStates([], false)` is three `unspent`;
  one failure gives one `spent` and two `unspent`; five failures give three
  `spent`; and a solve gives three `solved`. Run it: fails, not a function.
- **Implement** — `lib/feedback.ts`: build a fixed three-entry array, capping the
  spent count at three.
- **Green when** — all four shapes come back, always length three.
- **Refactor** — none.

### Track B — Presentational components

#### Step B1 — The dot row renders its states

Covers: R1, R2, AC1, AC2, AC3

- **Test first** — `components/AttemptDots.test.tsx`: render with
  `['spent','unspent','unspent']`, assert three dots render, that the row has an
  accessible label describing attempts spent, and that the states produce distinct
  classes. Run it: fails, module not found.
- **Implement** — `components/AttemptDots.tsx`: maps states to token colours;
  `aria-label` such as "1 of 3 attempts spent".
- **Green when** — three dots render with distinguishable states.
- **Refactor** — none.

#### Step B2 — Feedback is announced, not just coloured

Covers: R8, R10, AC14

- **Test first** — `components/FeedbackLine.test.tsx`: assert the message renders
  inside an element with `role="status"`, and that the three tones differ by class
  while the text alone still distinguishes them. Run it: fails, module not found.
- **Implement** — `components/FeedbackLine.tsx`: `role="status"` with
  `aria-live="polite"`.
- **Green when** — the message is in a live region.
- **Refactor** — none.

#### Step B3 — The nudge names the root

Covers: R6, AC9

- **Test first** — `components/NudgeBox.test.tsx`: render `<NudgeBox root="G" />`
  and assert the text names G as the root and carries the "a nudge" eyebrow. Run
  it: fails, module not found.
- **Implement** — `components/NudgeBox.tsx`: the canvas' hint-box treatment.
- **Green when** — the root is named.
- **Refactor** — none.

### Track C — Wiring into the card

#### Step C1 — The card shows dots, feedback and the nudge

Covers: R1, R3, R5, R6, AC8, AC9

- **Test first** — `components/GuessCard.test.tsx`: guess wrong twice and assert
  two dots are spent, the feedback names which half matched, and the nudge appears
  naming the day's root. Run it: fails, none of the three render.
- **Implement** — `GroovePuzzle` derives `feedback`, `showNudge` and `dots` from
  the store's attempts through `lib/feedback.ts` and passes them to `GuessCard`,
  which stays presentational per Epic 2's ownership rule; `GuessCard` replaces Epic
  2's throwaway result line with `FeedbackLine`.
- **Green when** — all three respond to guessing.
- **Refactor** — delete the plain result line from Epic 2 Step C3.

#### Step C2 — The nudge does not touch the chips

Covers: R6, R7, AC9, AC10, AC11

- **Test first** — same file: after the nudge appears, assert no root chip is
  pressed, all twelve remain enabled, and no chip carries a "tried" marking; then
  assert a fourth guess is still possible. Run it: fails if the nudge was wired to
  auto-select.
- **Implement** — nothing beyond keeping the nudge presentational.
- **Green when** — the chips are untouched and guessing continues.
- **Refactor** — none.

#### Step C3 — Solving withdraws the nudge

Covers: R9, AC13

- **Test first** — same file: with the nudge showing, solve the day; assert the
  nudge is gone, the feedback shows the solved wording, and the dots are all
  solved. Run it: fails, the nudge persists.
- **Implement** — `GuessCard`: `shouldShowNudge` already gates on `solved`; render
  accordingly.
- **Green when** — the nudge disappears on the solve.
- **Refactor** — none.

## Integration and verification

#### Step I1 — Feedback never relies on colour alone

Covers: R10, AC14

- **Test first** — `components/FeedbackLine.test.tsx`: assert each of the three
  tones produces a distinct message string, so a reader with no colour perception
  can still tell the cases apart. Run it: fails if two branches share wording.
- **Implement** — adjust wording.
- **Green when** — all three messages differ.

#### Step I2 — The demo path, by hand

- `npm test`, `npm run build` — green.
- `npm run dev`: guess with the right root and wrong flavour, and read the
  targeted feedback; guess wrong again and watch the nudge appear naming the root;
  guess a fourth and fifth time and confirm you are never locked out; solve it and
  watch the nudge withdraw and the dots turn.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A7, B1, C1 |
| R2 | A7, B1 |
| R3 | A2, A3, A4, C1 |
| R4 | A1 |
| R5 | A6, C1 |
| R6 | B3, C1, C2 |
| R7 | C2 |
| R8 | B2 |
| R9 | A5, C3 |
| R10 | B2, I1 |
| AC1 | A7, B1 |
| AC2 | A7, B1 |
| AC3 | A7, B1 |
| AC4 | A1 |
| AC5 | A2 |
| AC6 | A3 |
| AC7 | A4 |
| AC8 | A6, C1 |
| AC9 | B3, C1, C2 |
| AC10 | C2 |
| AC11 | C2 |
| AC12 | A6 |
| AC13 | A5, C3 |
| AC14 | B2, I1 |

## Assumptions

- Feedback wording is authored in `lib/feedback.ts` as plain strings rather than
  extracted to a message catalogue; there is no i18n in this project.
- The nudge's wording adapts the canvas' hint-box copy to name the root, dropping
  the interval advice the app cannot verify for an arbitrary groove.
- `dotStates` caps at three rather than taking the cap as a parameter; the canvas
  fixes the row at three and nothing in the roadmap makes it configurable.
- The dot row's accessible label carries the count, so the information is available
  without seeing the dots.
- `GuessCard` gains `feedback`, `showNudge`, `dots` and `answerRoot` props rather
  than reaching for the store, keeping Epic 2's rule that only `GroovePuzzle`
  subscribes.

No architectural questions remain for this epic — the logic is pure, the components
are presentational, and every contract it needs was frozen in Epic 2.
