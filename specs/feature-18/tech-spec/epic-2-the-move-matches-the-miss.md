# Tech spec — Epic 2: The move matches the miss

PRD: [../prd/epic-2-the-move-matches-the-miss.md](../prd/epic-2-the-move-matches-the-miss.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Four pieces, and the order is the order of the dependency.

First, a new pure module that answers one question — *which family, and how far
into it* — from the attempt list alone. It answers it by calling
`confirmedHalves`, the same function the chip rows are drawn from, so R1 and AC4
are true by construction rather than by two implementations agreeing. It walks
the list to find the miss that first confirmed a half, which is what R7b needs
and what nothing persists.

Second, the six moves, in their own module with no logic in it. They are a
musical judgement about what is audible in these grooves, so they get their own
track under the `musician` role and their own file, which is what keeps that
track from colliding with the selector's.

Third, Epic 1's coaching selector gains one input — the row the player is
currently looking at — and one branch: ask the new module for a family and an
index, take the table that family names, clamp the index to the table's length.
The general family's index *is* the miss count, so Epic 1's ladder keeps every
number and every string it shipped.

Fourth, the page passes `simple` to the selector. That is the whole of the
wiring, and it is what makes R9a true without a reload: `simple` is React state
the page already holds, so the memo recomputes the moment the switch is flipped.

Two things are deliberately **not** built. There is no second reading of which
half is confirmed — `confirmedHalves` is the only one, and the family selector
calls it rather than re-deriving from `rootMatched`/`flavourMatched`. And
nothing is stored: no key, no field on `DailyResult`, no latch. The family and
the position are derived per render exactly as the ladder position is.

## Architecture

### The dependency shape

```
GroovePuzzle ──▶ lib/presentation/coaching.ts        (selectCoaching, Epic 1's)
   simple            │
                     ├──▶ lib/presentation/coachingFamily.ts   (coachingPosition)
                     │              └──▶ lib/presentation/confirmed.ts
                     │                         (confirmedHalves — the rows' own)
                     └──▶ lib/presentation/coachingMoves.ts    (the six strings)
```

`coachingMoves.ts` imports nothing from `coaching.ts`. It is a leaf inside the
slice, so there is no cycle to reason about and the musician's track can land
before the selector's.

The arrow that is *missing* is the point: `NudgeBox`, `FeedbackLine`, `GuessCard`
and `Chip` learn nothing. Epic 1 put a coaching line in the box; this epic
changes which string arrives there and nothing about the box. Three of the four
files the roadmap warned the two epics would collide over are untouched here —
see *What this epic does not touch*.

### The family, and where it was entered

R7a and R7b together say the position is counted from the miss that entered the
family, not from the day's first miss. Nothing persists that miss, so it is
recovered by walking the attempts in order and asking `confirmedHalves` about
each prefix:

```
attempts   [ G+wrong   ] [ A+wrong   ] [ G+Aeolian ] [ A+Aeolian ] [ B♭+Aeolian ]
misses            1             2             3             4              5
confirmed        {}            {}      {flavours:[A]} {flavours:[A]} {flavours:[A]}
                                       ↑ first prefix that reports it
family        general       general        tonic         tonic          tonic
index            1             2          3−3 = 0      4−3 = 1        5−3 = 2
move          rung 2        rung 3        tonic 1       tonic 2      tonic 2, held
```

The entry ordinal is the **miss** ordinal of the first prefix whose
`confirmedHalves` reports the half — 3 in the walk above. The index is
`misses − entry`, unclamped; the clamp against a table's length is the
selector's, because the depth of a table is a property of the table. That is
what makes R7c ("two moves deep") and R7d ("holds on the second") assertions in
Track C and not arithmetic buried in Track A.

The general family has no entry ordinal: its index *is* the miss count, which is
exactly what Epic 1's ladder is indexed by. Epic 2 therefore changes no rung
number and no rung string.

### Why the family is read from `confirmedHalves` and not from `matchedHalf`

The roadmap named `matchedHalf` on the last attempt; R1 supersedes it, and the
difference is testable. Take `[C+wrong, G+wrong, A+wrong]` on a C-Aeolian day:
`matchedHalf` of the last attempt is `neither`, so a `matchedHalf` implementation
sends the player back to the general ladder three misses after their root was
confirmed and their root row locked. `confirmedHalves` still reports `['C']`.
The PRD says the two agree in practice because a locked row leaves only the
confirmed chip selectable — but the list above is reachable in exactly one way
that matters: the row does not lock until the *next* render, and a stored day
rehydrated from `localStorage` is replayed from its attempts. Step A8 is that
list, written before the implementation exists, so the naive reading cannot
survive one commit.

It is also the whole of AC4. "Selected from the same confirmed-halves result the
chip rows render from" is not a comment above a function here; it is
`coachingFamily.ts` importing `./confirmed` and having no other way to know.

### Both halves confirmed on an open day

The PRD says both halves confirmed "is not a state — it is a solve". That is
true of a single check and false of two: `[C+Dorian, G+Aeolian]` on a C-Aeolian
day confirms the root on the first miss and the mode on the second, and the day
is still open with both rows locked to one live chip each. The function must be
total over that, so the rule is stated rather than left to fall out:

> **The family is the one entered most recently.** Walking the attempts, each
> half's entry ordinal is recorded; the family is whichever half entered later.
> A tie can only be a single attempt confirming both, which is a solve and a day
> whose Hint box is gone (Epic 1 R14) — it resolves to `colour` for determinism
> and nothing can render it.

"Most recently" is R7a generalised: confirming a half is a new listening job, and
the second confirmation is a newer job than the first. It also keeps R7 true —
the family never moves backwards to `general`, because a confirmed half never
un-confirms.

### The family survives a simple-mode toggle; the row's lock does not

Feature-17 shipped a behaviour that pulls against R7, and it is worth naming
before someone discovers it in a demo. Attempts store the label the player
guessed, so a mode confirmed in the full row is `'Aeolian'` and one confirmed in
simple mode is `'Minor'`. `GuessCard`'s `optionStatesFor` locks a row only when a
confirmed label is *in the options it is rendering*, so flipping the switch
mid-day unlocks the mode row. Two passing tests in
`components/GroovePuzzle.guessing.test.tsx` say so today — *"keeps both family
chips live when the switch is flipped after a confirmed mode (R6, AC8)"* and
*"keeps every mode live when the switch is flipped after a confirmed family (R6,
AC8)"*.

The coaching does **not** follow the row here. R7 is explicit — *"a player is
never returned to the general ladder once they have left it"* — and
`confirmedHalves(attempts)` still reports the confirmed flavour whichever row is
on screen. So after that toggle the mode row shows two live chips while the
coaching stays in the tonic family. That is the PRD's answer, not an oversight,
and it costs one predicate to reverse.

The root half has no such tension: `simpleRootOptions` always contains the day's
answer root, so a confirmed root locks its row in both modes. That is exactly the
reasoning R9a gives for why the colour family survives the switch and only its
*wording* changes.

### Simple mode changes the wording, not the family

R9a's "the row the player is currently looking at" is the `simple` flag and
nothing else — not a property of the attempts, not a property of the confirmed
label. `selectCoaching` takes it as an input, and the page passes the same
`simple` that drives the two `ChipGroup`s. One value, two consumers, so they
cannot disagree, and the swap happens on the toggle's re-render with no reload.

Only the colour table is switched (R8). The tonic table and the general ladder
are shared (R9), which is asserted directly rather than left implicit: Step C5
runs the same attempts through `simple: true` and `simple: false` and demands
the same string for both.

### What the words may not say, and why that is a test rather than a review note

Three copy rules become mechanical assertions over the six strings, and they are
the reason the musician's brief in Track B is a set of constraints rather than a
set of sentences:

| Rule | Assertion | Where |
| :-- | :-- | :-- |
| R10 / AC10 — no root, no mode name | no member of `ROOTS`, `flavourPool(GROOVES)` or `FAMILIES` appears as a whole token | Step B2 |
| R6 / AC5 — never send them after a root they hold | no colour move names `root`, `tonic` or `home note` | Step B4 |
| R6 / AC6 — never send them after a mode they hold | no tonic move names `mode`, `colour`, `flavour` or `scale` | Step B5 |
| R10 / AC11 — a tap move works with the taps off | a message matching the tap regex has a `soundsOff`; no `soundsOff` matches it | Step B3 |

The first of those has a consequence sharp enough to state on its own: **`FAMILIES`
is `['Major', 'Minor']`, so no move added by this epic may use the word "major"
or "minor" at all** — including "compare it against a major scale you already
know", which is one of the phrases the briefing floated. The simple-mode colour
moves are the ones this bites hardest: they are about exactly the distinction the
two banned words name, and must describe the third without naming what it turns
into. That is the single hardest sentence in this epic and it belongs to the
musician.

### What this epic does not touch

The roadmap put the two epics in different waves because they share
`lib/presentation/feedback.ts`, `components/puzzle/NudgeBox.tsx` and the Hint-box
wiring in `components/puzzle/GuessCard.tsx`. With Epic 1 landed, this epic needs
none of the three, and no track below lists any of them:

| File | Why it is safe |
| :-- | :-- |
| `lib/presentation/feedback.ts` | the verdict, `matchedHalf`, `missCount`, `dotStates`, `shouldOfferReveal`, `shouldShowNudge` and every tone are unchanged. This epic reads `Feedback` as a type and writes nothing here |
| `components/puzzle/NudgeBox.tsx`, `FeedbackLine.tsx` | Epic 1 owns the coaching slot, the muted treatment and the single live region. This epic changes which string arrives, not the box |
| `components/puzzle/GuessCard.tsx` | the coaching is selected in the page and arrives as a prop. `GuessCard` already receives `simple` and needs no new one |
| `src/components/**` | no design-system change of any kind |
| `src/features/daily-groove/index.ts` | the derivation is internal to the slice; the slice stays as removable as it was |
| `scripts/**` | nothing generator-side. **Every track here runs `npm test`** — no track takes `npm run test:gen`, including the musician's, whose file is app code |

## Contracts

Frozen before any track starts. C1 is Epic 1's and is restated as what this epic
builds against; C2–C6 are this epic's own.

### C1 — Epic 1's coaching selector, as Epic 1's spec froze it

This section was first written against Epic 1's PRD, before Epic 1's tech spec
existed. **That spec now exists**, and its contracts C1 and C2 are the real
shape. All three of the claims below were checked against it and hold; three
names and one calling convention differ, and are mapped here so Step C0
confirms rather than discovers.

```ts
// src/features/daily-groove/lib/presentation/moves.ts — Epic 1's, wave 1
export type Move = {
  message: string
  soundsOff?: string
}

export const LADDER: readonly [Move, Move, Move, Move]

// src/features/daily-groove/lib/presentation/coaching.ts — Epic 1's, wave 2
import type { Attempt } from '../../types'
import type { Feedback } from './feedback'

export type CoachingInput = {
  attempts: readonly Attempt[]
  tapSounds: boolean
}

export function selectCoaching(input: CoachingInput): Feedback  // tone: 'neutral'
```

**The mapping, resolved:**

| This spec first assumed | Epic 1 froze | Consequence here |
| :-- | :-- | :-- |
| `selectCoaching(attempts, tapSounds)` | `selectCoaching({ attempts, tapSounds })` | Track C widens the object with `simple`, which is tidier than a third positional argument |
| `GENERAL_LADDER` in `coaching.ts` | `LADDER` in its own `moves.ts` | already exported, so Step C0's point 2 needs no work |
| `CoachingMove` | `Move` | **C3 below declares its own `Move`.** Import Epic 1's from `./moves` instead of redeclaring an identical type in a sibling module |
| "3 or 4 rungs" | exactly 4, as a fixed tuple | the clamp still holds; no rung moves |

Three claims this epic actually leans on, in decreasing order of how much it
would cost if Epic 1 shipped something else — **all three verified against Epic
1's spec:**

1. **The selector is a function of `attempts` and `tapSounds`, returning one
   move.** Epic 1's PRD R7 and its Q2 answer both say so. If this is false the
   epic does not have a seam and the spec needs a cycle.
2. **The general ladder is a table indexed by the miss count and clamped to its
   last entry.** Epic 1's *Behaviour details* table is exactly that. Track C
   replaces the clamp's input with `coachingPosition(attempts).index`, which for
   the general family *is* the miss count — so if this holds, no rung moves.
3. **The move is selected in `GroovePuzzle.tsx`**, beside `feedback`, `dots` and
   `showReveal`, and reaches `NudgeBox` as a prop through `GuessCard`. This is
   where every other derivation on this card is done today.

**Step C0 still runs**, because a spec is a plan and the tree is the fact — but
it is now a confirmation, not a discovery. Claim (3) is the one that would have
changed ownership, and it holds: Epic 1's Track F calls
`selectCoaching({ attempts, tapSounds })` in a `useMemo` inside
`GroovePuzzle.tsx`, beside `feedback`, `dots` and `showReveal`. **Track D's
`Owns` is unchanged and does not gain the `GuessCard` files.**

Names are not load-bearing; the shape is. Where they differ, Track C uses Epic
1's names throughout, per the mapping table above.

### C2 — Which family, and how far into it

```ts
// src/features/daily-groove/lib/presentation/coachingFamily.ts   (new)
import type { Attempt } from '../../types'

export type CoachingFamily = 'general' | 'colour' | 'tonic'

export type CoachingPosition = {
  family: CoachingFamily
  index: number
}

export function coachingPosition(
  attempts: readonly Attempt[],
): CoachingPosition
```

Frozen semantics:

- `family` comes from `confirmedHalves(attempts)`, imported from `./confirmed`.
  Neither half → `'general'`. Root only → `'colour'`. Mode only → `'tonic'`.
  Both → whichever entered later; a tie → `'colour'` (unreachable on an open
  day, see *Architecture*).
- `index` is **0-based and unclamped**. For `'general'` it is the number of
  attempts with `correct === false`. For the other two it is
  `misses − entry`, where `entry` is the miss ordinal of the first prefix of
  `attempts` whose `confirmedHalves` reports that half. It is never negative.
- **Total, pure, unfailing.** `coachingPosition([])` is
  `{ family: 'general', index: 0 }`; nothing in it throws on any `Attempt[]`; it
  mutates neither the array nor its entries; it reads no clock and stores
  nothing, so a rehydrated day gives the same answer as a live one (R7b needs
  nothing persisted).
- It imports `./confirmed` and `../../types`, and nothing else. In particular it
  does not import `./feedback`, and does not re-derive a confirmed half from
  `rootMatched` / `flavourMatched`.

### C3 — The six moves

```ts
// src/features/daily-groove/lib/presentation/coachingMoves.ts   (new)
export type Move = { message: string; soundsOff?: string }

export const COLOUR_MOVES: readonly Move[]          // exactly 2 — R3, R7c
export const TONIC_MOVES: readonly Move[]           // exactly 2 — R4, R7c
export const SIMPLE_COLOUR_MOVES: readonly Move[]   // exactly 2 — R8, R7c
```

Data only: no function, no import from `./coaching`, no import from anywhere in
`components/`. `Move` is declared here rather than imported so the module stays
a leaf; if Epic 1's `CoachingMove` is structurally identical, Track C may alias
one to the other, and if it is not, Track C maps at the one call site.

`soundsOff` is present **only** on a move whose `message` names a chip tap
(Epic 1's assumption: the string count is the ladder plus a handful, not the
ladder doubled). Which moves those are is the musician's call, bounded by C4.

### C4 — What every one of the six strings must satisfy

These are the frozen assertions of Track B. Each is a test before it is a
sentence, and the regexes are given here so Track B and Track D scan alike.

```ts
const NOTE_CHARS = 'A-Za-z♭♯'
const rootPattern = (root: string) =>
  new RegExp(
    `(?<![${NOTE_CHARS}])${root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![${NOTE_CHARS}])`,
  )                                              // case-SENSITIVE, as NudgeBox.test.tsx has it
const modePattern = (mode: string) => new RegExp(`\\b${mode}\\b`, 'i')
const TAP = /\btap(s|ped|ping)?\b/i
const ROOT_WORDS = /\b(root|tonic|home note)\b/i
const MODE_WORDS = /\b(mode|colou?r|flavou?r|scale)\b/i
const DEGREES = /\b(third|fourth|fifth|sixth|seventh)\b/gi
```

Over `message` and, where present, `soundsOff`:

| # | Rule | Applies to |
| :-- | :-- | :-- |
| 1 | matches no `rootPattern(r)` for `r` in `ROOTS`, and no `modePattern(m)` for `m` in `flavourPool(GROOVES)` **or** `FAMILIES` | all six |
| 2 | contains neither `♭` nor `♯` | all six |
| 3 | if `message` matches `TAP`, `soundsOff` is a non-empty string that does not match `TAP` and differs from `message`; if it does not, `soundsOff` is absent | all six |
| 4 | does not match `ROOT_WORDS` | `COLOUR_MOVES`, `SIMPLE_COLOUR_MOVES` |
| 5 | does not match `MODE_WORDS` | `TONIC_MOVES` |
| 6 | names exactly one distinct degree from `DEGREES` | `SIMPLE_COLOUR_MOVES` |
| 7 | at least one move in each table matches `TAP` | each table |
| 8 | all six messages, and every `soundsOff`, are distinct strings | across all three |
| 9 | `message.length <= 160` | all six |

Rule 1 is case-sensitive for roots (so a lower-case "a" is not the root A, the
same bargain `NudgeBox.test.tsx` already strikes) and case-insensitive for modes
and families (so "a major scale" is caught). Rule 7 is what keeps AC11 from
being vacuous in any family; see *Assumptions* for the cost of dropping it.

### C5 — The selector's widened input

```ts
// src/features/daily-groove/lib/presentation/coaching.ts   — Track C
export function selectCoaching(
  attempts: readonly Attempt[],
  tapSounds: boolean,
  simple = false,
): Feedback
```

One new input, defaulted. The default is not laziness: it keeps the tree
type-checking between wave 2 and wave 3, and `false` is the pre-Epic-2 behaviour
(the full row's wording), so a forgotten wire-up degrades rather than crashes.
What catches a forgotten wire-up is Step D1, a composed test that flips the
switch and demands the wording change — which a defaulted call site fails.

The **output is unchanged**: `Feedback`, `tone: 'neutral'`, exactly as Epic 1
returns it. Epic 2 widens the input and not the output, in Epic 1's own words.

Behaviour, in full:

```
const { family, index } = coachingPosition(attempts)
const table =
  family === 'general' ? GENERAL_LADDER
  : family === 'tonic' ? TONIC_MOVES
  : simple ? SIMPLE_COLOUR_MOVES : COLOUR_MOVES
const move = table[Math.min(index, table.length - 1)]
message = tapSounds ? move.message : (move.soundsOff ?? move.message)
```

### C6 — What the page passes

```tsx
// src/features/daily-groove/components/GroovePuzzle.tsx
const coaching = useMemo(
  () => selectCoaching(attempts, tapSounds, simple),
  [attempts, tapSounds, simple],
)
```

The same `simple` that feeds `roots`, `flavours` and `usePuzzleSession`. One
memo, one added dependency, no new prop on `GuessCard`, no new state.

## Tracks

### Track A — Which family, and where it was entered

- **Goal** — `coachingPosition` exists, reads `confirmedHalves` rather than the
  last attempt, enters each family at index 0 on the miss that confirmed it,
  counts from there, never returns to `general`, and is total over any
  `Attempt[]`.
- **Owns** —
  `src/features/daily-groove/lib/presentation/coachingFamily.ts`,
  `src/features/daily-groove/lib/presentation/coachingFamily.test.ts`
  (both new; no other track writes here)
- **Role** — `implementer`
- **Depends on** — `confirmedHalves` and `Attempt`, both shipped by feature-17
  and unchanged. **Nothing Epic 1 ships.**
- **Parallel with** — Track B
- **Done when** — its ten cases pass and `npm test` is green, with no other file
  in the repo importing the module yet.

### Track B — The six moves

- **Goal** — three tables of two moves each, every string satisfying C4, and a
  recorded musical reason for each choice.
- **Owns** —
  `src/features/daily-groove/lib/presentation/coachingMoves.ts`,
  `src/features/daily-groove/lib/presentation/coachingMoves.test.ts`
  (both new; no other track writes here)
- **Role** — `musician`. **This becomes two dispatches at implementation time:**
  the musician decides the six sentences and their sounds-off wordings against
  the brief below and reports them with reasoning; an implementer then writes
  both files, tests first. The musician writes no file.
- **Depends on** — C4, and the catalogue evidence in *The musician's brief*.
  Nothing in code.
- **Parallel with** — Track A
- **Done when** — its seven cases pass under `npm test` (**not**
  `npm run test:gen`; the file is app code), and the module is imported by
  nothing yet.

### Track C — The selector picks the family

- **Goal** — `selectCoaching` takes `simple`, routes through `coachingPosition`,
  clamps each family to its own depth, and leaves every general rung exactly as
  Epic 1 shipped it.
- **Owns** —
  `src/features/daily-groove/lib/presentation/coaching.ts`,
  `src/features/daily-groove/lib/presentation/coaching.test.ts`
  (Epic 1's files, under whatever names Epic 1 gave them — see C1)
- **Role** — `implementer`
- **Depends on** — Epic 1 **landed** (Step C0 checks C1's three claims), Track A
  **real** and Track B **real**. Both are internal `lib/presentation/` paths, so
  a `vi.mock` of either would be a mock of an internal path,
  which `docs/testing.md` rules out.
- **Parallel with** — nothing in this epic.
- **Done when** — its eight cases pass, every pre-existing case in Epic 1's
  selector test passes unchanged except where C5's third argument is added, and
  `npm test` is green.

### Track D — The page hands over the row the player is looking at

- **Goal** — the page passes `simple` to the selector, and every composed
  criterion is proven by driving the real card: the three families, the entry
  point, the hold, both simple-mode cases, the mid-day toggle and the sounds-off
  wording.
- **Owns** —
  `src/features/daily-groove/components/GroovePuzzle.tsx`,
  `src/features/daily-groove/components/GroovePuzzle.guessing.test.tsx`,
  `src/features/daily-groove/components/GroovePuzzle.sounding.test.tsx`
  — plus `src/features/daily-groove/testing/puzzleHarness.tsx` **only if** Epic 1
  left no reader for the coaching line and one is needed. No other track writes
  in any of the four.
- **Role** — `implementer`
- **Depends on** — Track C's signature. Its assertions are rendered output from
  the real page, so nothing below it may be mocked.
- **Parallel with** — nothing in this epic.
- **Done when** — every step below passes, `npm test` is green, and
  `npm run lint` and `npx tsc --noEmit` are clean.

**The test-file split (feature-14) is respected as it stands**: family choice,
position and the simple-mode toggle are the guessing surface and go in
`GroovePuzzle.guessing.test.tsx`; the tap-sounds switch is the sounding surface
and goes in `GroovePuzzle.sounding.test.tsx`, beside feature-16's other
`tapSounds` cases. Nothing goes in `GroovePuzzle.page.test.tsx`, `…header…` or
`…intro…` — no case here is about composition, the header or the first visit.

### Track E — Verification

- **Goal** — every R and AC is graded against the suite and the demo, and the
  epic is confirmed to have left Epic 1's ladder, the verdict rules and the Hint
  box alone.
- **Owns** — nothing. It writes no source and no test.
- **Role** — `verifier`
- **Depends on** — Tracks A–D.
- **Parallel with** — nothing.
- **Done when** — `npm test`, `npm run lint`, `npx tsc --noEmit` and
  `npm run build` are clean, every AC traces to a passing case, and the demo path
  in *Integration and verification* has been walked.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B — two disjoint new file pairs, neither
  of which touches a file Epic 1 owns.
- **Wave 2:** Track C — needs Epic 1 landed, plus A and B for real.
- **Wave 3:** Track D — needs C's third argument.
- **Wave 4:** Track E — the demo and the grading.

**Three scheduling facts for the lead.**

1. **This epic is the feature's wave 2 and Track C is where that bites.** Tracks
   A and B are the only two that could overlap Epic 1 — they share no file with
   it and depend on nothing it ships. Track C opens Epic 1's own selector module
   and must not start while Epic 1 is open. Track D opens `GroovePuzzle.tsx`,
   which Epic 1 also opens.
2. **No wave here claims parallelism it does not have.** Feature-16's roadmap
   claimed three disjoint epics and all three landed in `GroovePuzzle.tsx`; the
   only file in this epic that more than one track would want is
   `GroovePuzzle.tsx`, and exactly one track owns it. Waves 2 and 3 are one track
   each because they genuinely are: C changes a signature D calls.
3. **Track B is the long pole and starts first.** Six sentences under nine
   mechanical constraints is the slowest deliverable here, it needs two
   dispatches, and nothing it produces depends on anything else in the epic.
   Start it at the same moment as Track A, not when Track A finishes.

## Implementation

### Track A — Which family, and where it was entered

Fixtures for the whole file, written once at the top of
`lib/presentation/coachingFamily.test.ts`, mirroring `feedback.test.ts` and
`confirmed.test.ts` so the three read alike. The day is C Aeolian throughout, as
the harness fixture plays it:

```ts
const attempt = (
  root: Attempt['root'],
  flavour: string,
  rootMatched: boolean,
  flavourMatched: boolean,
): Attempt => ({
  root,
  flavour,
  correct: rootMatched && flavourMatched,
  rootMatched,
  flavourMatched,
})

const ROOT_ONLY = attempt('C', 'Dorian', true, false)        // right root, wrong mode
const OTHER_ROOT_ONLY = attempt('C', 'Lydian', true, false)  // the root row already locked
const FLAVOUR_ONLY = attempt('G', 'Aeolian', false, true)    // right mode, wrong root
const LOCKED_MISS = attempt('A', 'Aeolian', false, true)     // the mode row already locked
const NEITHER = attempt('G', 'Dorian', false, false)
const OTHER_NEITHER = attempt('A', 'Lydian', false, false)
const EXACT = attempt('C', 'Aeolian', true, true)
```

#### Step A1 — Before anything is checked, the general ladder is at its front

Covers: R5, AC3

- **Test first** — `src/features/daily-groove/lib/presentation/coachingFamily.test.ts`:
  `expect(coachingPosition([])).toEqual({ family: 'general', index: 0 })`.
  Run it: fails with
  `Error: Failed to resolve import "./coachingFamily" from "src/features/daily-groove/lib/presentation/coachingFamily.test.ts"`.
- **Implement** — `lib/presentation/coachingFamily.ts`: the two exported types
  and `coachingPosition`, starting as `confirmedHalves(attempts)` plus a miss
  count, returning `general` with the miss count as its index.
- **Green when** — the assertion passes and `npm test` is green.
- **Refactor** — none.

#### Step A2 — Misses that confirm neither half walk the general ladder

Covers: R5, AC3

- **Test first** — same file:
  ```ts
  expect(coachingPosition([NEITHER])).toEqual({ family: 'general', index: 1 })
  expect(coachingPosition([NEITHER, OTHER_NEITHER])).toEqual({ family: 'general', index: 2 })
  expect(coachingPosition([NEITHER, OTHER_NEITHER, NEITHER, OTHER_NEITHER]).index).toBe(4)
  ```
  Run it against A1's implementation: passes if the index is the miss count, and
  is written to pin that **the general index is unclamped** — the clamp belongs
  to Epic 1's table in Track C, and a clamp here would silently cap Epic 1's
  ladder at this epic's depth.
- **Implement** — nothing, if A1 counted misses. If it returned a constant, the
  fix is the count.
- **Green when** — all three pass.
- **Refactor** — none.

#### Step A3 — A miss that confirms the root opens the colour family at its first move

Covers: R1, R2, R3, R7a, AC2

- **Test first** —
  `expect(coachingPosition([ROOT_ONLY])).toEqual({ family: 'colour', index: 0 })`.
  Run it: fails with
  `AssertionError: expected { family: 'general', index: 1 } to deeply equal { family: 'colour', index: 0 }`.
- **Implement** — read `confirmedHalves(attempts).roots`; when it is non-empty
  and `flavours` is empty, return `colour` with `misses − entry`, where `entry`
  is found by walking prefixes: for `i` from 1 to `attempts.length`, keep a
  running miss count, and take the first `i` whose
  `confirmedHalves(attempts.slice(0, i)).roots` is non-empty.
- **Green when** — A1–A3 pass together.
- **Refactor** — none.

#### Step A4 — A miss that confirms the mode opens the tonic family at its first move

Covers: R1, R2, R4, R7a, AC1

- **Test first** —
  `expect(coachingPosition([FLAVOUR_ONLY])).toEqual({ family: 'tonic', index: 0 })`.
  Run it: fails with
  `AssertionError: expected { family: 'general', index: 1 } to deeply equal { family: 'tonic', index: 0 }`
  if A3 landed the root half only.
- **Implement** — the `flavours` half of the same walk.
- **Green when** — both halves pass independently: a list of only root-confirming
  attempts never returns `tonic`, and the reverse.
- **Refactor** — the two prefix walks become one `entryMiss(attempts, half)`
  helper, private to the module.

#### Step A5 — The family is entered at its first move, whatever the general ladder had reached

Covers: R7a, AC12

**The step R7a turns on.** Written before A6 so a `family` change that carries
the general index across cannot survive one commit.

- **Test first** —
  ```ts
  it('enters a family at its own first move, not at the rung the ladder reached (R7a, AC12)', () => {
    expect(coachingPosition([NEITHER, OTHER_NEITHER, FLAVOUR_ONLY])).toEqual({
      family: 'tonic',
      index: 0,
    })
    expect(coachingPosition([NEITHER, OTHER_NEITHER, ROOT_ONLY])).toEqual({
      family: 'colour',
      index: 0,
    })
  })
  ```
  Run it against an implementation that keeps the miss count as the index: fails
  with `AssertionError: expected { family: 'tonic', index: 3 } to deeply equal { family: 'tonic', index: 0 }`.
- **Implement** — subtract the entry ordinal, as A3 specified. If A3 was built
  as written, this is already green and the step is the guard that says so.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step A6 — Position is counted from the miss that entered the family

Covers: R7b, R7d, AC13, AC14

- **Test first** —
  ```ts
  it('counts from the entering miss, not from the day’s first miss (R7b, AC13)', () => {
    expect(coachingPosition([NEITHER, OTHER_NEITHER, FLAVOUR_ONLY, LOCKED_MISS]).index).toBe(1)
    expect(coachingPosition([FLAVOUR_ONLY, LOCKED_MISS]).index).toBe(1)
    expect(coachingPosition([NEITHER, ROOT_ONLY, OTHER_ROOT_ONLY]).index).toBe(1)
  })

  it('keeps counting past the end of a table — the clamp is the selector’s (R7d, AC14)', () => {
    const long = [NEITHER, OTHER_NEITHER, FLAVOUR_ONLY, LOCKED_MISS, LOCKED_MISS, LOCKED_MISS]
    expect(coachingPosition(long)).toEqual({ family: 'tonic', index: 3 })
  })
  ```
  Run it: the first case fails with
  `AssertionError: expected 4 to be 1` against a miss-count index.
- **Implement** — nothing beyond A5, if the subtraction landed.
- **Green when** — all four assertions pass.
- **Refactor** — none.

#### Step A7 — A family never moves backwards

Covers: R7, AC7

- **Test first** —
  ```ts
  it('never returns to the general ladder once a half is confirmed (R7, AC7)', () => {
    const day = [NEITHER, FLAVOUR_ONLY, LOCKED_MISS, LOCKED_MISS, LOCKED_MISS]
    for (let n = 2; n <= day.length; n++) {
      expect(coachingPosition(day.slice(0, n)).family).toBe('tonic')
    }
  })
  ```
  Run it: fails at `n === 3` with
  `AssertionError: expected 'general' to be 'tonic'` against any implementation
  that reads the last attempt's `rootMatched`/`flavourMatched` directly rather
  than `confirmedHalves`.
- **Implement** — nothing; `confirmedHalves` is already a fold and the family
  reads it. If the assertion fails, the fix is to stop reading the last attempt,
  not to add a latch.
- **Green when** — every prefix from the confirming miss on returns `tonic`.
- **Refactor** — none.

#### Step A8 — It reads the confirmed halves, not the last attempt

Covers: R1, AC4

**The step the epic turns on**, and the one that separates the PRD from the
roadmap. Written before A9 for the same reason A5 comes before A6.

- **Test first** —
  ```ts
  it('reads confirmedHalves, not matchedHalf on the last attempt (R1, AC4)', () => {
    const day = [ROOT_ONLY, NEITHER, OTHER_NEITHER]
    expect(coachingPosition(day)).toEqual({ family: 'colour', index: 2 })
    expect(confirmedHalves(day).roots).not.toEqual([])

    for (const attempts of [day, [FLAVOUR_ONLY, NEITHER], [NEITHER], []]) {
      const { roots, flavours } = confirmedHalves(attempts)
      const expected =
        roots.length === 0 && flavours.length === 0 ? 'general'
        : flavours.length === 0 ? 'colour'
        : roots.length === 0 ? 'tonic'
        : coachingPosition(attempts).family
      expect(coachingPosition(attempts).family).toBe(expected)
    }
  })
  ```
  Run it against a `matchedHalf(attempts.at(-1))` implementation: fails with
  `AssertionError: expected { family: 'general', index: 3 } to deeply equal { family: 'colour', index: 2 }`.
- **Implement** — nothing, if A3 imported `./confirmed`. If the module derives
  the family from `rootMatched` / `flavourMatched` itself, delete that and call
  `confirmedHalves` — AC4 is the import, not a comment.
- **Green when** — every case passes, and `coachingFamily.ts` imports
  `./confirmed` and nothing else beyond `../../types`.
- **Refactor** — none.

#### Step A9 — Both halves confirmed on an open day resolves to the later one

Covers: R7a, R2

- **Test first** —
  ```ts
  it('takes the family entered most recently when both halves are confirmed (R7a)', () => {
    expect(coachingPosition([ROOT_ONLY, FLAVOUR_ONLY])).toEqual({ family: 'tonic', index: 0 })
    expect(coachingPosition([FLAVOUR_ONLY, ROOT_ONLY])).toEqual({ family: 'colour', index: 0 })
    expect(coachingPosition([ROOT_ONLY, NEITHER, FLAVOUR_ONLY]).index).toBe(0)
  })
  ```
  Run it: fails with
  `AssertionError: expected { family: 'colour', index: 1 } to deeply equal { family: 'tonic', index: 0 }`
  against an implementation that checks `roots` before `flavours`.
- **Implement** — compare the two entry ordinals and take the greater; on a tie
  return `colour`.
- **Green when** — all three pass.
- **Refactor** — none.

#### Step A10 — Total, pure, and blind to a solve

Covers: R7b, R2

- **Test first** —
  ```ts
  it('is total over any attempt list and mutates nothing', () => {
    const attempts = [NEITHER, ROOT_ONLY, EXACT]
    const before = JSON.stringify(attempts)
    expect(() => coachingPosition(attempts)).not.toThrow()
    expect(JSON.stringify(attempts)).toBe(before)
    expect(coachingPosition([EXACT]).index).toBeGreaterThanOrEqual(0)
    expect(coachingPosition([NEITHER, EXACT]).index).toBe(
      coachingPosition([NEITHER]).index,
    )
    for (const list of [[], [EXACT], [NEITHER], [FLAVOUR_ONLY, EXACT]]) {
      expect(coachingPosition(list).index).toBeGreaterThanOrEqual(0)
    }
  })
  ```
  Run it: `expected 2 to be 1` if the solving attempt is counted as a miss.
- **Implement** — the miss count filters `correct === false`, matching
  `missCount` in `feedback.ts`. The function reads no clock and holds no module
  state.
- **Green when** — every assertion passes and the file has no top-level `let`.
- **Refactor** — none.

### Track B — The six moves

#### The musician's brief

Six sentences, plus a sounds-off wording for each that names a chip tap. What
follows is the ground the decision stands on; everything in it was checked
against the tree and the catalogue on 2026-09-02, and the last row is the
constraint most likely to be discovered late.

**What the grooves actually do** (`docs/music.md`, and a scan of
`src/features/daily-groove/data/grooves.generated.ts`, 30 grooves):

| Claim | Status |
| :-- | :-- |
| Bar three carries a chord that is neither bar one's nor bar two's | **true for 30 of 30**. `barChords` folds a 3-chord progression over 4 bars as `[c0, c1, c2, c0]` and a 4-chord one as itself; in every groove the third bar is a change. "Listen for what changes in bar three" is a safe sentence |
| Bar four returns to bar one's chord | **true for 17 of 30** — the three-chord progressions only. Do not write a move that depends on it |
| The bass plays the bar's root on the downbeat, always | **true by construction**. Rest, repeat and octave-lift are each drawn per note and the downbeat is exempt from all three. A tonic move may lean on this without hedging |
| Bar one is the tonic | **true by construction** — progressions start on the tonic. So the bass note on beat one of bar one *is* the day's root, every loop, every groove |
| The comp states the third and the seventh | **usually true**. A four-pitch-class chord drops its root when the bass is sounding it, so the third and seventh are what is left; the top voice is loudest and each voice below is 12% quieter |
| The sixth is sounded | **rarely**. `6` and `m6` sit low in `QUALITIES`, so the sixth is a scale tone the player must supply rather than one the comp hands them. It is the degree that separates Dorian from Aeolian, so it is worth naming — but as something to *sing against* the groove, not to hear in it |
| Tempo | 67–130 bpm; a four-bar loop runs 7.4 s to 14.3 s. Anything asking for two comparisons inside one pass is asking a lot at 130 |

**What the chips do**, which is where a tap move points (features 10 and 16):

- A root chip plays that root as a reference note. That is the tonic family's
  tool.
- A mode chip plays a lick in that mode — in simple mode, a lick in a
  representative mode of the chosen family. That is the colour family's tool.
- An unavailable chip still sounds: `Chip` fires `onPress` regardless and
  withholds only `onSelect`. A move may point at a dimmed chip (Epic 1 R11).
- With the root confirmed, the root row is locked to one live chip, and with the
  mode confirmed the mode row is. A move should point at the row that is *still
  open*, which is the row its family is about.

**The nine rules the strings must satisfy are in C4.** Two of them will shape the
writing more than the rest:

- **No move may use the word "major" or "minor",** because `FAMILIES` is
  `['Major', 'Minor']` and AC10 bans every option label the game can show. This
  is hardest on `SIMPLE_COLOUR_MOVES`, whose whole subject is that distinction:
  the move has to send the player to the third and let them hear which way it
  leans without naming either destination. "Bright" and "heavy", "lifts" and
  "leans down", are the register available.
- **A colour move may not say root, tonic or home note** (rule 4) and **a tonic
  move may not say mode, colour, flavour or scale** (rule 5). R3's "the home
  note is settled and the question is what is built on it" has to be said as
  "the note you've locked in" or "the note under it".

**The decisions the musician is being asked to make**, and they are decisions,
not preferences:

1. Which two of *the third*, *the sixth*, *the seventh* and *the fourth* are
   reliably hearable over a four-bar loop at 67–130 bpm, and which of the two is
   the first move — the one a player is most likely to act on.
2. Whether the tonic family's first move is the bass downbeat (guaranteed by the
   arrangement, above) or the sing-and-hold job the current opening line already
   asks for — the second must not repeat the first rung of Epic 1's ladder.
3. Whether "what changes in bar three" belongs to a family here or stays in Epic
   1's general ladder. It is true of every groove; it is also the least specific
   job of the three, which argues for the general ladder and against a family
   whose player is close.
4. Which move in each table names a tap, and what it says with the taps off —
   the sounds-off wording must be a different job, not the same sentence with the
   tap clause deleted, because a player who silenced the taps still needs
   something to do.

**Report back**: the six messages, the sounds-off wordings, and one sentence per
move saying what it asks the ear to do and why it is audible in these grooves.
The implementer then writes `coachingMoves.ts` and its test, tests first, in the
order below.

#### Step B1 — Each family is exactly two moves deep

Covers: R7c

- **Test first** — `src/features/daily-groove/lib/presentation/coachingMoves.test.ts`:
  ```ts
  it.each([
    ['COLOUR_MOVES', COLOUR_MOVES],
    ['TONIC_MOVES', TONIC_MOVES],
    ['SIMPLE_COLOUR_MOVES', SIMPLE_COLOUR_MOVES],
  ])('%s holds exactly two moves (R7c)', (_name, table) => {
    expect(table).toHaveLength(2)
    for (const move of table) expect(move.message.trim().length).toBeGreaterThan(0)
  })
  ```
  Run it: fails with
  `Error: Failed to resolve import "./coachingMoves" from "src/features/daily-groove/lib/presentation/coachingMoves.test.ts"`.
- **Implement** — `lib/presentation/coachingMoves.ts`: the `Move` type and the
  three `readonly Move[]` constants, filled with the musician's sentences.
- **Green when** — the three cases pass and `npm test` is green.
- **Refactor** — none.

#### Step B2 — No move names anything the game can offer as an option

Covers: R10, AC10

- **Test first** — same file, over every message and every `soundsOff` in all
  three tables:
  ```ts
  const ALL = [...COLOUR_MOVES, ...TONIC_MOVES, ...SIMPLE_COLOUR_MOVES]
  const strings = ALL.flatMap((m) => [m.message, ...(m.soundsOff ? [m.soundsOff] : [])])

  it('names no root and no mode from any option set the game can show (R10, AC10)', () => {
    for (const text of strings) {
      for (const root of ROOTS) {
        expect(text, `names the root ${root}`).not.toMatch(rootPattern(root))
      }
      for (const mode of [...flavourPool(GROOVES), ...FAMILIES]) {
        expect(text, `names the mode ${mode}`).not.toMatch(modePattern(mode))
      }
      expect(text).not.toMatch(/[♭♯]/)
    }
  })
  ```
  with `rootPattern` copied from `components/puzzle/NudgeBox.test.tsx` (case
  sensitive) and `modePattern` from C4 (case insensitive). Imports:
  `ROOTS`, `flavourPool` from `../theory/music`, `FAMILIES` from
  `../theory/families`, `GROOVES` from `../../data/grooves.generated` — all
  inside the slice.
  Run it against copy containing "a major scale you already know": fails with
  `AssertionError: names the mode Major: expected '…a major scale…' not to match /\bMajor\b/i`.
- **Implement** — the musician's strings, rewritten until green. A failure here
  is a copy change, never a regex change.
- **Green when** — every string passes for all 12 roots and all 14 mode labels.
- **Refactor** — none. In particular, do not narrow the mode list to the day's
  four options: the union is the point, because the same string is shown in both
  rows' worlds.

#### Step B3 — A move that names a tap works with the taps off

Covers: R10, AC11

- **Test first** —
  ```ts
  it('pairs every tap move with a sounds-off wording, and no other (R10, AC11)', () => {
    for (const move of ALL) {
      if (TAP.test(move.message)) {
        expect(move.soundsOff, `no sounds-off for "${move.message}"`).toBeTypeOf('string')
        expect(move.soundsOff).not.toMatch(TAP)
        expect(move.soundsOff?.trim().length).toBeGreaterThan(0)
        expect(move.soundsOff).not.toBe(move.message)
      } else {
        expect(move.soundsOff).toBeUndefined()
      }
    }
  })

  it('gives each family at least one move that points at a chip (R10, AC11)', () => {
    for (const table of [COLOUR_MOVES, TONIC_MOVES, SIMPLE_COLOUR_MOVES]) {
      expect(table.some((m) => TAP.test(m.message))).toBe(true)
    }
  })
  ```
  Run it: fails with
  `AssertionError: no sounds-off for "…tap a mode to hear it…": expected undefined to be type 'string'`.
- **Implement** — add the sounds-off wordings the musician wrote; remove any
  `soundsOff` on a move that does not name a tap.
- **Green when** — both cases pass.
- **Refactor** — none.

#### Step B4 — A colour move never sends the player after the root

Covers: R6, AC5

- **Test first** —
  ```ts
  it('never asks for the half the colour family already has (R6, AC5)', () => {
    for (const move of [...COLOUR_MOVES, ...SIMPLE_COLOUR_MOVES]) {
      for (const text of [move.message, move.soundsOff ?? '']) {
        expect(text).not.toMatch(/\b(root|tonic|home note)\b/i)
      }
    }
  })
  ```
  Run it against "sing the third above the home note": fails with
  `AssertionError: expected 'Sing the third above the home note.' not to match /\b(root|tonic|home note)\b/i`.
- **Implement** — copy only.
- **Green when** — all four strings pass.
- **Refactor** — none.

#### Step B5 — A tonic move never sends the player after the mode

Covers: R6, AC6

- **Test first** —
  ```ts
  it('never asks for the half the tonic family already has (R6, AC6)', () => {
    for (const move of TONIC_MOVES) {
      for (const text of [move.message, move.soundsOff ?? '']) {
        expect(text).not.toMatch(/\b(mode|colou?r|flavou?r|scale)\b/i)
      }
    }
  })
  ```
  Run it against "hum the bass note and check it against the scale": fails with
  `AssertionError: expected '…against the scale.' not to match /\b(mode|colou?r|flavou?r|scale)\b/i`.
- **Implement** — copy only.
- **Green when** — both tonic moves pass.
- **Refactor** — none.

#### Step B6 — Simple mode's colour moves are one question about one note

Covers: R8, AC9

- **Test first** —
  ```ts
  it('asks simple mode a single-note question, in its own words (R8, AC9)', () => {
    for (const move of SIMPLE_COLOUR_MOVES) {
      const degrees = new Set(
        (move.message.match(/\b(third|fourth|fifth|sixth|seventh)\b/gi) ?? []).map((d) =>
          d.toLowerCase(),
        ),
      )
      expect(degrees.size, `"${move.message}" names ${degrees.size} degrees`).toBe(1)
    }
    const full = COLOUR_MOVES.map((m) => m.message)
    for (const move of SIMPLE_COLOUR_MOVES) expect(full).not.toContain(move.message)
  })
  ```
  Run it against a simple move reused from the full row: fails with
  `AssertionError: expected [ '…', '…' ] not to contain '…'`.
- **Implement** — copy only.
- **Green when** — both cases pass.
- **Refactor** — none.

#### Step B7 — Six moves, six distinct sentences, each short enough to be a move

Covers: R7c, R10

- **Test first** —
  ```ts
  it('says something different in every move (R7c)', () => {
    expect(new Set(strings).size).toBe(strings.length)
  })

  it('stays one job long (R10)', () => {
    for (const text of strings) expect(text.length).toBeLessThanOrEqual(160)
  })
  ```
  Run it against a duplicated string: fails with
  `AssertionError: expected 9 to be 10`.
- **Implement** — copy only.
- **Green when** — both pass. Uniqueness *against Epic 1's ladder* is Step C7,
  because only the selector's module can see both tables.
- **Refactor** — none.

### Track C — The selector picks the family

#### Step C0 — Check what Epic 1 shipped against C1

Covers: none directly — it is the gate on the whole track.

Not a test. C1's mapping table already answers all four from Epic 1's spec —
this step confirms the tree matches what that spec planned, since a spec is a
plan and only the tree is a fact. If an answer differs from the table, use Epic
1's real names, record the mapping in one line at the top of this track's work,
and continue.

1. **Where is the coaching selector?** Expected
   `src/features/daily-groove/lib/presentation/coaching.ts`, exporting a
   function of `(attempts, tapSounds)` returning `Feedback` with
   `tone: 'neutral'`. If it is a second export of `feedback.ts`, this track's
   `Owns` becomes `feedback.ts` and `feedback.test.ts` — and Track D's
   `GroovePuzzle.tsx` import changes accordingly.
2. **Is the general ladder a table indexed by the miss count and clamped to its
   last entry?** If it is a chain of `if (misses === n)`, convert it to a table
   first, as its own commit, changing no string. **The table must be exported**
   — Steps C1, C7, C8, D4, D5 and D6 all read it so the rungs are asserted in
   one place rather than retyped; if Epic 1 kept it module-private, Track C
   exports it and changes nothing else about it.
3. **What shape is a rung?** Expected `{ message, soundsOff? }`. If Epic 1 held
   two parallel arrays or a `Record<boolean, string>`, map at the one place the
   tables meet rather than rewriting Epic 1's data.
4. **Where is the selector called?** Expected `GroovePuzzle.tsx`. If it is
   `GuessCard.tsx`, tell the lead: Track D's `Owns` gains
   `components/puzzle/GuessCard.tsx` and `GuessCard.test.tsx`, and `simple` is
   already a prop there.

- **Done when** — the four answers are written down and `npm test` is green
  before any edit.

#### Step C1 — With neither half confirmed, Epic 1's ladder is untouched

Covers: R5, AC3

- **Test first** — `lib/presentation/coaching.test.ts` (Epic 1's file):
  ```ts
  it('walks Epic 1’s general ladder unchanged when nothing is confirmed (R5, AC3)', () => {
    const day: Attempt[] = []
    for (let misses = 0; misses <= 6; misses++) {
      const move = selectCoaching(day, true, false)
      expect(move.tone).toBe('neutral')
      expect(GENERAL_LADDER.map((m) => m.message)).toContain(move.message)
      expect(move.message).toBe(
        GENERAL_LADDER[Math.min(misses, GENERAL_LADDER.length - 1)].message,
      )
      day.push(NEITHER)
    }
  })
  ```
  Run it before the widening: passes, and it is written first as the **regression
  fence** — every later step in this track keeps it green or the epic has moved a
  rung it was told not to.
- **Implement** — nothing yet.
- **Green when** — it passes, and every pre-existing case in Epic 1's selector
  test still passes.
- **Refactor** — none.

#### Step C2 — A confirmed root gets a colour move

Covers: R1, R2, R3, AC2

- **Test first** —
  ```ts
  it('gives a colour move once the root is confirmed (R2, R3, AC2)', () => {
    const move = selectCoaching([ROOT_ONLY], true, false)
    expect(move.message).toBe(COLOUR_MOVES[0].message)
    expect(move.tone).toBe('neutral')
    expect(GENERAL_LADDER.map((m) => m.message)).not.toContain(move.message)
  })
  ```
  Run it: fails with
  `AssertionError: expected '<Epic 1 rung 2>' to be '<colour move 1>'`.
- **Implement** — `coaching.ts` imports `coachingPosition` from
  `./coachingFamily` and the three tables from `./coachingMoves`, and picks the
  table per C5's five lines. `simple` is added to the signature with its `false`
  default.
- **Green when** — C1 and C2 both pass.
- **Refactor** — none.

#### Step C3 — A confirmed mode gets a tonic move

Covers: R1, R2, R4, AC1

- **Test first** —
  ```ts
  it('gives a tonic move once the mode is confirmed (R2, R4, AC1)', () => {
    expect(selectCoaching([FLAVOUR_ONLY], true, false).message).toBe(TONIC_MOVES[0].message)
    expect(selectCoaching([FLAVOUR_ONLY], true, true).message).toBe(TONIC_MOVES[0].message)
  })
  ```
  Run it: fails with `AssertionError: expected '<colour move 1>' to be '<tonic move 1>'`
  if C2 branched on `roots` alone.
- **Implement** — the `tonic` branch.
- **Green when** — C1–C3 pass.
- **Refactor** — none.

#### Step C4 — Each family is two deep and holds on the second

Covers: R7c, R7d, AC13, AC14

- **Test first** —
  ```ts
  it('advances once inside a family and then holds (R7c, R7d, AC13, AC14)', () => {
    const seen = [
      selectCoaching([NEITHER, NEITHER, FLAVOUR_ONLY], true, false).message,
      selectCoaching([NEITHER, NEITHER, FLAVOUR_ONLY, LOCKED_MISS], true, false).message,
      selectCoaching([NEITHER, NEITHER, FLAVOUR_ONLY, LOCKED_MISS, LOCKED_MISS], true, false).message,
      selectCoaching([NEITHER, NEITHER, FLAVOUR_ONLY, LOCKED_MISS, LOCKED_MISS, LOCKED_MISS], true, false).message,
    ]
    expect(seen).toEqual([
      TONIC_MOVES[0].message,
      TONIC_MOVES[1].message,
      TONIC_MOVES[1].message,
      TONIC_MOVES[1].message,
    ])
  })
  ```
  Run it against an unclamped index: fails with
  `TypeError: Cannot read properties of undefined (reading 'message')`.
- **Implement** — `Math.min(index, table.length - 1)`. The clamp is per table,
  so Epic 1's ladder keeps its own depth.
- **Green when** — the four-element array matches, and C1 is still green.
- **Refactor** — none.

#### Step C5 — Simple mode changes the colour family and nothing else

Covers: R8, R9, R9a, AC8, AC9

- **Test first** —
  ```ts
  it('gives simple mode its own colour wording and the shared everything-else (R8, R9, AC8, AC9)', () => {
    expect(selectCoaching([ROOT_ONLY], true, true).message).toBe(SIMPLE_COLOUR_MOVES[0].message)
    expect(selectCoaching([ROOT_ONLY], true, true).message).not.toBe(COLOUR_MOVES[0].message)

    for (const day of [[FLAVOUR_ONLY], [FLAVOUR_ONLY, LOCKED_MISS], [], [NEITHER], [NEITHER, NEITHER]]) {
      expect(selectCoaching(day, true, true).message).toBe(
        selectCoaching(day, true, false).message,
      )
    }
  })
  ```
  Run it: fails with
  `AssertionError: expected '<colour move 1>' to be '<simple colour move 1>'`.
- **Implement** — the `simple ? SIMPLE_COLOUR_MOVES : COLOUR_MOVES` branch, and
  only there. The tonic and general branches must not read `simple` at all.
- **Green when** — both halves pass: the colour family differs across the flag,
  the tonic family and the general ladder do not.
- **Refactor** — none.

#### Step C6 — With the taps silent, every family says something else

Covers: R10, AC11

- **Test first** —
  ```ts
  it('swaps to the sounds-off wording wherever a move names a tap (R10, AC11)', () => {
    const cases: [Attempt[], Attempt, boolean, readonly Move[]][] = [
      [[ROOT_ONLY], OTHER_ROOT_ONLY, false, COLOUR_MOVES],
      [[ROOT_ONLY], OTHER_ROOT_ONLY, true, SIMPLE_COLOUR_MOVES],
      [[FLAVOUR_ONLY], LOCKED_MISS, false, TONIC_MOVES],
    ]
    for (const [day, next, simple, table] of cases) {
      for (const index of [0, 1]) {
        const attempts = index === 0 ? day : [...day, next]
        const move = table[index]
        const off = selectCoaching(attempts, false, simple).message
        expect(off).toBe(move.soundsOff ?? move.message)
        if (move.soundsOff) expect(off).not.toBe(move.message)
      }
    }
  })
  ```
  The advancing attempt is per family and never the other half's: a colour case
  advances with `OTHER_ROOT_ONLY` (the root row already locked) and a tonic case
  with `LOCKED_MISS`. Advancing a colour case with a flavour-confirming attempt
  would change the family under the assertion and is the mistake this note
  exists to prevent.
  Run it: fails with `AssertionError: expected '<tap wording>' to be '<sounds-off wording>'`
  if the widening dropped Epic 1's `tapSounds` branch.
- **Implement** — reuse Epic 1's existing `tapSounds` selection; do not write a
  second one.
- **Green when** — all six lookups pass.
- **Refactor** — if Epic 1's tap selection was inline in a ladder-specific
  branch, lift it to one `wording(move, tapSounds)` helper used by every family.

#### Step C7 — Every move the selector can return is muted and its own sentence

Covers: R10, AC10

- **Test first** —
  ```ts
  it('returns a distinct, muted move for every reachable state (R10, AC10)', () => {
    const reachable = [
      ...GENERAL_LADDER, ...COLOUR_MOVES, ...TONIC_MOVES, ...SIMPLE_COLOUR_MOVES,
    ]
    const messages = reachable.map((m) => m.message)
    expect(new Set(messages).size).toBe(messages.length)

    for (const [day, simple] of [
      [[], false], [[NEITHER], false], [[ROOT_ONLY], false],
      [[ROOT_ONLY], true], [[FLAVOUR_ONLY], false], [[FLAVOUR_ONLY], true],
    ] as [Attempt[], boolean][]) {
      for (const taps of [true, false]) {
        expect(selectCoaching(day, taps, simple).tone).toBe('neutral')
      }
    }
  })
  ```
  Run it against a colour move reused from Epic 1's ladder: fails with
  `AssertionError: expected 9 to be 10`.
- **Implement** — nothing, unless the uniqueness assertion fails, in which case
  it is a copy change in Track B's file and a message back to the musician.
- **Green when** — both halves pass.
- **Refactor** — none.

#### Step C8 — The selector reads the confirmed halves, not the last attempt

Covers: R1, R7, AC4, AC7

- **Test first** —
  ```ts
  it('stays in its family three misses after the confirming one (R1, R7, AC4, AC7)', () => {
    const day = [NEITHER, FLAVOUR_ONLY, LOCKED_MISS, LOCKED_MISS, LOCKED_MISS]
    const move = selectCoaching(day, true, false)
    expect(TONIC_MOVES.map((m) => m.message)).toContain(move.message)
    expect(GENERAL_LADDER.map((m) => m.message)).not.toContain(move.message)

    const stale = [ROOT_ONLY, NEITHER, OTHER_NEITHER]
    expect(selectCoaching(stale, true, false).message).toBe(COLOUR_MOVES[1].message)
  })
  ```
  Run it against a selector that reads `matchedHalf` of the last attempt: fails
  with `AssertionError: expected [ '<tonic 1>', '<tonic 2>' ] to contain '<Epic 1 last rung>'`.
- **Implement** — nothing; `coachingPosition` already does it. The step exists
  so the *selector's* own test file carries AC4 and not only Track A's.
- **Green when** — both assertions pass and the whole file is green.
- **Refactor** — none.

### Track D — The page hands over the row the player is looking at

Every step below drives the real page through `renderPuzzle()` and reads the
Hint box with `nudge()` from `testing/puzzleHarness.tsx`. Expected strings are
imported from `../lib/presentation/coachingMoves` and Epic 1's ladder module —
feature-internal imports from a test inside the slice, which is what keeps these
assertions from restating the copy in a second place. Nothing below mocks
anything in `lib/presentation/`.

Helpers already in `GroovePuzzle.guessing.test.tsx` and reused as they stand:
`liveIn`, `dimmedIn`, `liveRoot` (a live root that is not `'C'`), `chipTexts`,
and the harness's `guess`, `nudge`, `rootGroup`, `flavourGroup`. The fixture
groove is C Aeolian.

#### Step D1 — Flipping simple mode swaps the colour move, with no reload

Covers: R8, R9a, AC9a

**Written first in this track**, because it is the one case a forgotten third
argument fails and a defaulted signature would otherwise hide (C5).

- **Test first** — `components/GroovePuzzle.guessing.test.tsx`:
  ```ts
  it('swaps the colour move the moment simple mode is switched (R9a, AC9a)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, 'C', wrongFlavour())
    expect(nudge()).toHaveTextContent(COLOUR_MOVES[0].message)

    await user.click(screen.getByRole('switch', { name: /simple mode/i }))
    expect(nudge()).toHaveTextContent(SIMPLE_COLOUR_MOVES[0].message)
    expect(nudge()).not.toHaveTextContent(COLOUR_MOVES[0].message)

    await user.click(screen.getByRole('switch', { name: /simple mode/i }))
    expect(nudge()).toHaveTextContent(COLOUR_MOVES[0].message)
  })
  ```
  Run it: fails with
  `AssertionError: expected element to have text content '<simple colour move 1>'`
  — the page is still calling `selectCoaching(attempts, tapSounds)`.
- **Implement** — `GroovePuzzle.tsx`: add `simple` to the coaching memo's
  arguments and to its dependency array, per C6.
- **Green when** — all three reads pass, in one render, with no re-mount.
- **Refactor** — none.

#### Step D2 — A confirmed mode puts a tonic move in the box

Covers: R1, R2, R4, AC1

- **Test first** — same file:
  ```ts
  it('coaches the tonic when a check got the mode right (R2, R4, AC1)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, liveRoot(), 'Aeolian')
    expect(liveIn(flavourGroup())).toEqual(['Aeolian'])
    expect(nudge()).toHaveTextContent(TONIC_MOVES[0].message)
  })
  ```
  Run it before D1's implementation: fails with
  `AssertionError: expected element to have text content '<tonic move 1>'`.
- **Implement** — nothing beyond D1; the step proves the selection reaches the
  box.
- **Green when** — it passes.
- **Refactor** — none.

#### Step D3 — A confirmed root puts a colour move in the box

Covers: R1, R2, R3, AC2

- **Test first** —
  ```ts
  it('coaches the colour when a check got the root right (R2, R3, AC2)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, 'C', wrongFlavour())
    expect(liveIn(rootGroup())).toEqual(['C'])
    expect(nudge()).toHaveTextContent(COLOUR_MOVES[0].message)
  })
  ```
  Run it: fails as D2 does before the wiring.
- **Implement** — none.
- **Green when** — it passes.
- **Refactor** — none.

#### Step D4 — With neither half confirmed the general ladder still runs

Covers: R5, AC3

- **Test first** —
  ```ts
  it('keeps Epic 1’s ladder when a miss confirms neither half (R5, AC3)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    expect(nudge()).toHaveTextContent(GENERAL_LADDER[0].message)
    await guess(user, liveRoot(), wrongFlavour())
    expect(nudge()).toHaveTextContent(GENERAL_LADDER[1].message)
    expect(nudge()).not.toHaveTextContent(COLOUR_MOVES[0].message)
    expect(nudge()).not.toHaveTextContent(TONIC_MOVES[0].message)
  })
  ```
  Run it: green before and after the wiring — it is this track's regression
  fence, matching Step C1 in the unit tier.
- **Implement** — none.
- **Green when** — it passes both before and after D1's edit.
- **Refactor** — none.

#### Step D5 — The family is entered at its first move, and counted from there

Covers: R7a, R7b, R7c, R7d, AC12, AC13, AC14

- **Test first** —
  ```ts
  it('enters the tonic family at its first move after two general misses (R7a, AC12)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, liveRoot(), wrongFlavour())
    await guess(user, liveRoot(), otherWrongFlavour())
    expect(nudge()).toHaveTextContent(GENERAL_LADDER[2].message)

    await guess(user, liveRoot(), 'Aeolian')
    expect(nudge()).toHaveTextContent(TONIC_MOVES[0].message)
  })

  it('advances to the family’s second move on the next miss, then holds (R7b, R7c, R7d, AC13, AC14)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, liveRoot(), wrongFlavour())
    await guess(user, liveRoot(), otherWrongFlavour())
    await guess(user, liveRoot(), 'Aeolian')

    await guess(user, liveRoot(), 'Aeolian')
    expect(nudge()).toHaveTextContent(TONIC_MOVES[1].message)

    for (let more = 0; more < 3; more++) {
      await guess(user, liveRoot(), 'Aeolian')
      expect(nudge()).toHaveTextContent(TONIC_MOVES[1].message)
    }
  })
  ```
  Note: after the mode is confirmed the mode row is locked to `'Aeolian'`, so
  every later guess picks it; each guess must pick a *live* root, which is what
  `liveRoot()` returns.
  Run the first before the entry-point logic exists: fails with
  `AssertionError: expected element to have text content '<tonic move 1>'`
  where the box holds `<tonic move 2>`.
- **Implement** — none beyond Tracks A and C; these are the composed proof.
- **Green when** — both pass.
- **Refactor** — none.

#### Step D6 — Once a family is entered, it is never left

Covers: R7, AC7

- **Test first** —
  ```ts
  it('stays in the tonic family two misses after confirming the mode (R7, AC7)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, liveRoot(), 'Aeolian')
    await guess(user, liveRoot(), 'Aeolian')
    await guess(user, liveRoot(), 'Aeolian')

    const box = nudge()?.textContent ?? ''
    expect(TONIC_MOVES.some((m) => box.includes(m.message))).toBe(true)
    for (const rung of GENERAL_LADDER) expect(box).not.toContain(rung.message)
  })
  ```
  Run it against a last-attempt reading: green here by luck, because the locked
  row keeps matching — which is exactly why Step A8 exists in the unit tier and
  this one does not stand alone.
- **Implement** — none.
- **Green when** — it passes.
- **Refactor** — none.

#### Step D7 — Simple mode shares the tonic wording

Covers: R9, AC8

- **Test first** —
  ```ts
  it('gives simple mode the shared tonic wording when the family is confirmed (R9, AC8)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(screen.getByRole('switch', { name: /simple mode/i }))
    expect(chipTexts(flavourGroup())).toEqual(['Major', 'Minor'])

    await guess(user, liveRoot(), 'Minor')
    expect(nudge()).toHaveTextContent(TONIC_MOVES[0].message)
  })
  ```
  `'Minor'` is C Aeolian's family under `familyMatch`, so the check confirms the
  mode half and misses the root.
  Run it: fails with `AssertionError: expected element to have text content '<tonic move 1>'`
  if the tonic branch reads `simple`.
- **Implement** — none.
- **Green when** — it passes.
- **Refactor** — none.

#### Step D8 — Simple mode gets its own colour wording

Covers: R8, AC9

- **Test first** —
  ```ts
  it('gives simple mode its own colour wording when the root is confirmed (R8, AC9)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(screen.getByRole('switch', { name: /simple mode/i }))
    await guess(user, 'C', 'Major')

    expect(liveIn(rootGroup())).toEqual(['C'])
    expect(nudge()).toHaveTextContent(SIMPLE_COLOUR_MOVES[0].message)
    expect(nudge()).not.toHaveTextContent(COLOUR_MOVES[0].message)
  })
  ```
  `'Major'` is the wrong family for C Aeolian, so the check confirms the root and
  misses the mode. `simpleRootOptions` always contains the answer root, so `'C'`
  is offerable.
  Run it: fails with `AssertionError: expected element to have text content '<simple colour move 1>'`.
- **Implement** — none.
- **Green when** — it passes.
- **Refactor** — none.

#### Step D9 — With the taps silent, the new moves say something else

Covers: R10, AC11

- **Test first** — `components/GroovePuzzle.sounding.test.tsx`, beside
  feature-16's other `tapSounds` cases:
  ```ts
  it.each([
    ['the colour family', 'C', () => wrongFlavour(), COLOUR_MOVES],
    ['the tonic family', null, () => 'Aeolian', TONIC_MOVES],
  ])('swaps %s’s move when the tap sounds are switched off (R10, AC11)', async (_n, root, flavour, table) => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, root ?? liveRoot(), flavour())
    const move = table[0]
    expect(nudge()).toHaveTextContent(move.message)

    await user.click(screen.getByRole('switch', { name: /tap sounds/i }))
    expect(nudge()).toHaveTextContent(move.soundsOff ?? move.message)
    if (move.soundsOff) expect(nudge()).not.toHaveTextContent(move.message)
  })
  ```
  If `table[0]` is not the move that names the tap, use `table[1]` and add the
  second miss that reaches it — C4 rule 7 guarantees one of the two names a tap.
  Run it: fails with
  `AssertionError: expected element to have text content '<sounds-off wording>'`
  if `tapSounds` stopped reaching the selector.
- **Implement** — none; `tapSounds` is already an argument.
- **Green when** — both rows pass without a reload.
- **Refactor** — none.

#### Step D10 — Nothing the box says on the page names an answer

Covers: R10, AC10

- **Test first** — `components/GroovePuzzle.guessing.test.tsx`, reusing
  `rootPattern` as `NudgeBox.test.tsx` declares it:
  ```ts
  it('never names a root or a mode in the Hint box, in any family (R10, AC10)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    const read = () => nudge()?.textContent ?? ''
    const seen: string[] = [read()]

    await guess(user, 'C', wrongFlavour())      // colour
    seen.push(read())
    await user.click(screen.getByRole('switch', { name: /simple mode/i }))
    seen.push(read())                            // simple colour

    for (const text of seen) {
      for (const root of ROOTS) expect(text).not.toMatch(rootPattern(root))
      for (const mode of [...flavours(), ...FAMILIES]) {
        expect(text).not.toMatch(new RegExp(`\\b${mode}\\b`, 'i'))
      }
    }
  })
  ```
  The scan is of the whole box, so it covers the coaching, the verdict where one
  shows, and the narrowing count together.
  Run it: fails with
  `AssertionError: expected '…Minor…' not to match /\bMinor\b/i` on copy that
  named a family.
- **Implement** — none; a failure is a copy change in Track B.
- **Green when** — every scan is clean.
- **Refactor** — none.

## Integration and verification

#### Step I1 — The order the files are opened in

Tracks A and B write four new files nothing imports. Track C is the first edit to
a file Epic 1 owns, and Track D the first to `GroovePuzzle.tsx`. Before Track C
starts, `npm test` must be green on Epic 1's landed work; if it is not, Epic 1 is
not finished and Track C waits (this epic's PRD says *"needs Epic 1 finished, not
merely contracted"*).

#### Step I2 — The demo path, run by hand

`npm run dev`, `localStorage.clear()`, reload.

1. Before pressing anything — the Hint box holds Epic 1's opening line. (AC3)
2. Check a wrong root with a wrong mode — the box holds Epic 1's second rung and
   no family move. (AC3)
3. Check another wrong pair, then a pair with the **right mode and a wrong
   root** — the mode row collapses to one live chip and the box holds the
   **tonic family's first** move, not its second. (AC1, AC12)
4. Check again, keeping the locked mode — the tonic family's **second** move.
   (AC13)
5. Check twice more — the second move, unchanged. (AC7, AC14)
6. `localStorage.clear()`, reload. Check the **right root with a wrong mode** —
   the root row collapses and the box holds the **colour family's first** move,
   which names nothing about finding a root. (AC2, AC5)
7. Flip **Simple mode** on — the colour move changes to simple mode's own
   wording, immediately, with no reload; flip it back and it changes back.
   (AC9, AC9a)
8. Flip **Tap sounds** off — any move on screen that named a tap is replaced by
   its sounds-off wording. (AC11)
9. `localStorage.clear()`, reload, turn **Simple mode** on, check a wrong root
   with the right family — the box holds the same tonic wording step 3 gave.
   (AC8)
10. Read every move seen along the way — no note name, no mode name, no "major",
    no "minor". (AC10)

#### Step I3 — The suite

`npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` — all clean.
`npm run test:gen` is not run by any track and nothing here touches
`scripts/grooves/`; `npm run test:all` should still pass and is the check that
says so.

#### Step I4 — What to confirm about Epic 1 before calling this done

Three assertions of Epic 1's that this epic is most likely to have broken, named
so the verifier checks them rather than trusting a green suite:

- **Epic 1's AC5** — the general ladder still holds on its last rung, for a day
  whose misses confirm neither half. Step C1 and Step D4 are the fences.
- **Epic 1's AC9** — switching simple mode does not reset the ladder position.
  This epic changes the family across that switch and must not change the
  *general* position.
- **Epic 1's AC15–AC18** — the verdict shows on the first miss and on the miss
  that first confirms a half, and nowhere else. This epic adds no verdict and
  removes none; the composed reads in Track D use `toHaveTextContent` on the
  whole box, so a verdict appearing or vanishing would not fail them. Check the
  verdict cases by name.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A3, A4, A8, C2, C3, C8, D2, D3 |
| R2 | A3, A4, A9, A10, C2, C3, D2, D3 |
| R3 | A3, B4, B7, C2, D3 |
| R4 | A4, B5, C3, D2 |
| R5 | A1, A2, C1, D4 |
| R6 | B4, B5 |
| R7 | A7, C8, D6 |
| R7a | A3, A4, A5, A9, D5 |
| R7b | A6, A10, D5 |
| R7c | B1, B7, C4, D5 |
| R7d | A6, C4, D5 |
| R8 | B6, C5, D1, D8 |
| R9 | C5, D7 |
| R9a | C5, D1 |
| R10 | B2, B3, B7, C6, C7, D9, D10 |
| AC1 | A4, C3, D2 |
| AC2 | A3, C2, D3 |
| AC3 | A1, A2, C1, D4 |
| AC4 | A8, C8 |
| AC5 | B4 |
| AC6 | B5 |
| AC7 | A7, C8, D6 |
| AC8 | C5, D7 |
| AC9 | B6, C5, D8 |
| AC9a | D1 |
| AC10 | B2, C7, D10 |
| AC11 | B3, C6, D9 |
| AC12 | A5, D5 |
| AC13 | A6, C4, D5 |
| AC14 | A6, C4, D5 |

## Assumptions

Lower-stakes technical calls made without asking, so a reviewer can challenge
them.

- **Epic 1's selector has the shape C1 describes.** Epic 1's tech spec does not
  exist yet, so C1 is read from Epic 1's PRD *Dependencies* section rather than
  from code. Step C0 checks it before Track C writes anything, and names the one
  variation that changes a track's file ownership. If claim (1) — a function of
  attempts and `tapSounds` returning one move — turns out to be false, this spec
  needs a cycle rather than an adjustment.
- **`simple` is a third positional argument with a `false` default.** The default
  buys a type-checking tree between waves 2 and 3 at the cost of a wire-up that
  could be silently forgotten; Step D1 is written first in Track D precisely to
  catch that. If Epic 1 gave the selector an options object, `simple` becomes one
  more field and the default goes away.
- **The family is membership, not the current row.** After a mid-day simple-mode
  toggle the mode row unlocks (feature-17's own passing tests say so) while the
  coaching stays in the tonic family. R7 is explicit that a player is never
  returned to the general ladder, so this is the PRD's answer — but it is the one
  place the card and the coaching visibly disagree, and reversing it is one
  predicate in `coachingPosition` plus one test.
- **Both halves confirmed on an open day resolves to the later entry.** The PRD
  says this is not a state; two separate misses reach it. The rule is stated in
  C2 so the function is total, and it is R7a generalised rather than a new
  decision.
- **At least one move per family names a chip tap** (C4 rule 7). Without it AC11
  is vacuous in whichever family the musician left tap-free. It is a real
  constraint on the copy, justified by feature-10 and feature-16 having built a
  reference note behind every root chip and a lick behind every mode chip. The
  cost of dropping it is deleting one assertion in Step B3.
- **The mode ban is the union of every option set, not the day's four.** A move
  is one string shown in both the full row's world and simple mode's, so
  narrowing the ban to whichever set is on screen would let "major" through in
  the full row and not in simple mode. The union costs the musician the words
  "major", "minor" and "blues".
- **Track D reads the box by its text content, not by a new harness helper.**
  Importing the move tables into the composed tests keeps the strings in one
  place and keeps these assertions independent of whatever markup Epic 1 gave the
  coaching line. If Epic 1 shipped a reader, use it.
- **No new file needs a structure-test edit.** `lib/presentation/` is one of the
  six concern folders `src/features/daily-groove/structure.test.ts` allows, and
  the two new modules are colocated with their tests, so nothing in that file
  moves.

## Decision log

### Cycle 1 — 2026-09-02

**Q1. Where does the family live — in the selector, or in its own module?**
Decision: **Its own module, `lib/presentation/coachingFamily.ts`** — it lets the
family logic be built and proven before Epic 1's selector is opened, and it
keeps the one test that separates `confirmedHalves` from `matchedHalf` (Step A8)
in a file whose only subject is that question.
Changed: Contracts C2, Track A, Steps A1–A10.

**Q2. Where does the copy live?**
Decision: **`lib/presentation/coachingMoves.ts`, data only, owned by a `musician`
track** — the PRD asks for the copy to be a musical judgement with its own
track, and a track cannot be its own track if it shares a file with the selector.
Changed: Contracts C3 and C4, Track B, Steps B1–B7.

**Q3. How is "a move never asks for the half already confirmed" made mechanical?**
Decision: **Per-family word bans** — colour moves name no `root`/`tonic`/`home
note`, tonic moves name no `mode`/`colour`/`flavour`/`scale`. A rule about
imperative phrasing was considered and rejected as too fragile to assert; a
blunt noun ban is checkable and the musician can write within it.
Changed: Contracts C4 rules 4 and 5, Steps B4 and B5, AC5 and AC6 coverage.

---

**No open questions.** Every architectural decision this epic needs is either
settled by the PRD or recorded above, and the one call that could go either way —
whether the family follows the row after a mid-day simple-mode toggle — is
answered by R7 and costs one predicate to reverse. The spec is ready to execute,
with one gate: Track C and Track D must not start until Epic 1 has landed, and
Step C0 is where that is checked.
