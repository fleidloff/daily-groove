# PRD — Epic 2: The puzzle card feeds itself

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

`GroovePuzzle.tsx` computes thirteen derived values and posts them down to
`GuessCard` as props, which is why every coaching feature ends up editing the one
file that everything else also edits. This epic puts the coaching modules behind
one door, has `GuessCard` open it itself, and leaves `GroovePuzzle` composing
rather than calculating. The puzzle plays, scores, nudges, locks and solves
exactly as it does today.

## Problem

`GroovePuzzle.tsx` is where features go to collide: 9 of the last 40 commits, 395
lines, 40 imports — 23 of them reaching sideways into its own `lib/`, `data/` and
`hooks/` — and a `GuessCard` call site passing **28 props**.

Thirteen of those 28 are derived — `feedback`, `coaching`, `showVerdict`,
`showNudge`, `dots`, `ruledOutRoots`, `ruledOutFlavours`, `confirmedRoots`,
`confirmedFlavours`, `eliminated`, `showReveal`, `roots`, `flavours`. Every one is
a pure function of attempts, answer, date and the two settings. Every one is
`useMemo`'d in the parent and handed down.

`GuessCard` then derives more of its own: the button's label and tone, whether
both halves are chosen, whether the day is over, and — in `optionStatesFor` — the
merge of ruled-out and confirmed into per-chip states. So the calculation is
split across two files, and the seam between them is a prop list.

Feature-14 lifted `usePuzzleSession` and `useTransport` out of this file and got
it to 274 lines. It is back at 395. More hooks is not the fix: the hooks moved
*lifetime* out and left *derivation* in.

`lib/presentation/` is eleven modules and five of them arrived with feature-18
alone. That is the growth rate the door has to absorb.

## Scope

- one entry point into the coaching modules, returning the guess card's whole
  view model
- `GuessCard` calls it rather than receiving its output
- `GroovePuzzle` stops computing what it does not render
- the assertions about *what the coaching says* move to the module that decides it

**Out of scope**
- **any change to what the coaching says.** Feature-18 is choosing those words
  right now. This epic moves where they are computed and nothing else
- the audio, puzzle, persistence and theory modules — Epic 3 gives them entry
  points
- removing `GroovePuzzle`'s remaining sideways imports — Epic 3
- splitting `GuessCard.tsx` itself. It sheds props and test lines here; if it is
  still too big afterwards that is a finding, not this epic's job
- `date` and `staffLabel`. They live in `lib/presentation/` but are not coaching
  and do not go behind this door
- a second `features/` slice

## Requirements

- **R1** — `src/features/daily-groove/lib/presentation/` exposes one entry point
  that takes the puzzle's state and returns the guess card's complete view model.
- **R2** — It is a pure function, not a hook. Same inputs, same output, no React,
  no clock, no storage — so it is tested as a plain function per
  `docs/testing.md`.
- **R3** — The view model covers every derived value the card renders: the two
  option lists and their per-chip states, the attempt dots, the nudge box's
  contents and whether it shows, the check button's label and tone, and whether
  the give-up path is offered.
- **R3a** — The merge of ruled-out and confirmed into per-chip state moves out of
  `GuessCard.optionStatesFor` and into the view model. Four props — `ruledOutRoots`,
  `ruledOutFlavours`, `confirmedRoots`, `confirmedFlavours` — become the two
  option lists the card actually renders.
- **R3b** — The check button's label and tone are part of the view model. They are
  derived from selection and solved state, which is the same derivation as
  everything else on the card, and leaving them behind would mean the seam runs
  through the middle of one concern.
- **R4** — `GuessCard` calls the entry point itself. It does not receive the view
  model as a prop. A boundary only the parent may cross is not a boundary.
- **R5** — `GuessCard`'s remaining props are the genuinely interactive ones: the
  callbacks, the two current selections, and the state the card cannot derive.
  The thirteen derived props are gone — not thirteen arbitrary props bundled into
  an object.
- **R6** — `GroovePuzzle.tsx` no longer imports `feedback`, `coaching`, `verdict`,
  `confirmed` or `ruledOut`, and no longer holds a `useMemo` for any value only
  `GuessCard` renders.
- **R7** — Nothing the player can observe changes. Every rendered string, every
  chip state, every dot, every enable and disable, in the same conditions as
  today.
- **R8** — No assertion is deleted, weakened or skipped. The case count across the
  affected test files is the same or higher, and every assertion still proves what
  it proved.
- **R9** — A relocated assertion keeps its subject. Per `docs/testing.md`, moving
  a case about coaching text to the module that decides the text is a move;
  rewriting a rendered-behaviour case as a pure-function call is a different
  assertion wearing the old one's name, and rendered behaviour stays rendered.
- **R10** — `GuessCard`'s own tests still drive it through rendering and user
  action, not by asserting on the view model it happens to call.
- **R11** — The door is narrow: the entry point exports the view model function
  and its types, not a re-export of the eleven modules behind it. Epic 3 asserts
  this for all five entry points; this one is built to the same rule from the
  start.
- **R12** — `structure.test.ts` is updated for whatever the change creates, and
  the design-system and route boundary tests stay green untouched.

## Behaviour details

**What the card can derive and what it cannot.** The view model is a function of
attempts, the answer, the date and the two settings. `solved` and `revealed` are
already in that set. What stays a prop is what originates outside the card: the
callbacks that mutate the store, and the current selections, which are transient
UI state the store owns. Q1 settles whether the card takes those inputs as props
or reads them itself.

**Why the button belongs in the view model.** `GuessCard` currently computes
`label` from four nested conditionals over `solved`, `bothChosen`, `selectedRoot`
and `selectedFlavour`, and `tone` from `solved`, `canCheck` and `revealed`. That
is the same class of derivation as the nudge and the dots, from the same state.
Splitting it — coaching text behind the door, button text in the component — puts
the seam through the middle of one idea and guarantees the next feature has to
decide again which side its change goes on.

**Order of work against feature-18.** Feature-18 owns `coaching.ts`,
`coachingFamily.ts`, `coachingMoves.ts`, `moves.ts` and `verdict.ts`, all
currently uncommitted. This epic puts exactly those files behind a door. It
cannot start until they are merged.

## Acceptance criteria

- **AC1** (R1, R2) — Given attempts, an answer, a date and the two settings, when
  the entry point is called twice with the same inputs, then it returns equal
  output and touches no React, clock or storage.
- **AC2** (R3, R3a, R3b) — Given the view model's return value, when compared
  against what `GuessCard` renders, then every derived value the card shows comes
  from it — option lists and chip states, dots, nudge, button label and tone,
  give-up offer.
- **AC3** (R4) — Given `GuessCard.tsx`, when its imports are read, then it imports
  the coaching entry point, and no prop it receives carries the view model.
- **AC4** (R5) — Given `GuessCard`'s prop type, when its members are counted, then
  the thirteen named derived props are absent.
- **AC5** (R6) — Given `GroovePuzzle.tsx`, when its imports are read, then
  `feedback`, `coaching`, `verdict`, `confirmed` and `ruledOut` are not among them.
- **AC6** (R7) — Given a full session — first visit, a wrong guess at each rung of
  the ladder, the nudge appearing, a lock-in, a solve, a give-up, a shared link —
  when played before and after, then every rendered string and chip state matches.
- **AC7** (R8) — Given the affected test files, when cases are counted before and
  after, then the total has not fallen.
- **AC8** (R10) — Given `GuessCard.test.tsx`, when its assertions are read, then
  they act on rendered output and user events, and none asserts on the entry
  point's return value directly.
- **AC9** (R11) — Given the entry point's module, when its exports are listed,
  then it exports the view model function and its types and nothing else from
  behind the door.
- **AC10** (R12) — Given the full gate, when `npm test`, the type check, lint and
  build run, then all pass, and `structure.test.ts`, `route-boundary.test.ts` and
  the design-system boundary tests are green.

## Dependencies

**Needs to start:** feature-18 merged. Its five uncommitted `lib/presentation/`
files are the ones this epic puts behind a door.

**Independent of Epic 1.** Epic 1's shims keep every `lib/theory/` path and
signature intact, so the two run in the same wave without touching a shared file.

**Hands to Epic 3:** the coaching entry point — the first of the five, and the
pattern the other four follow. Epic 3's narrow-door test asserts against it too.

## Assumptions

- The entry point lives at `lib/presentation/index.ts`. It is the feature's
  internal module surface, not the feature's public `index.ts`, and the no-barrel
  rule is scoped to `src/components/`.
- The view model is one object, not several. A card with two doors is two seams to
  reason about.
- `nearMiss` and `staffLabel` are read by the solved panel rather than the guess
  card, so they stay outside this door. If the split turns out to cut a module in
  half, that is a finding for the next cycle.
- The 13-of-28 count is measured with feature-18's uncommitted work applied and
  should be re-counted when the epic starts.
- `GuessCard.test.tsx` shrinks but is not split into files by this epic. Whether
  it needs splitting is answerable only once the coaching assertions have moved
  out.

## Open questions

Tick one option per question (`- [x]`), or write your own, then re-run
`/brainstorm feature-19 epic-2`.

### Q1. How does `GuessCard` get the state it feeds the entry point?

R4 settles that the card opens the door. What it holds in its hand when it does
is still open. No persona bearing; the reason is engineering, and it decides how
far this epic reaches.

- [ ] A) `GroovePuzzle` passes the raw state — attempts, answer, date, the two
      settings — and `GuessCard` calls the entry point with them *(recommended —
      it removes the thirteen derived props without coupling the card to the
      store, keeps the card renderable in a test with plain arguments, and is the
      smallest change that satisfies the briefing's "call it directly")*
- [ ] B) `GuessCard` reads the puzzle session directly through a hook and takes
      almost no props — the fullest version of "feeds itself", and it makes the
      card untestable without the store standing up behind it
- [ ] C) A context provider holds the puzzle state and the card consumes it — no
      prop drilling anywhere, and a new indirection the repo uses nowhere else
- [ ] D) The card takes the raw state now and moves to the store in a later
      feature, once a second consumer exists to justify it

### Q2. Does the view model speak the design system's language or its own?

`GuessCard` currently maps ruled-out and confirmed into `ChipOptionState`, a type
from `@/components/controls/ChipGroup`. If the view model does that merge (R3a),
it either imports that type or defines its own and the card maps. Features may
import the design system, so both are legal. No persona bearing; the reason is
which direction the coupling should point.

- [ ] A) The view model returns domain-shaped options and `GuessCard` maps them to
      `ChipOptionState` *(recommended — it keeps `lib/presentation/` free of UI
      types, so a change to `ChipGroup`'s props is a component-level change; the
      card keeps one small mapping function, which is the kind of work a component
      is for)*
- [ ] B) The view model returns `ChipOptionState` directly — the card renders with
      no mapping at all, and a design-system prop change now reaches into
      `lib/presentation/`
- [ ] C) The view model returns both — domain state plus a ready-made render
      shape, so the card picks. Two representations to keep in step
- [ ] D) Move `ChipOptionState` into a shared types module both can import —
      neutral ground, and a third place to look for one small type

### Q3. What happens to the 2,426-line `GuessCard.test.tsx`?

It is the largest file in the repo. R8 and R9 say no assertion is lost and each
keeps its subject, but a lot of it is coaching text asserted through a render.
Once the text is decided behind a door, those cases have a cheaper home. No
persona bearing; the reason is that this file is a churn hotspot in its own right
— 8 commits in the last 40.

- [ ] A) Coaching-text cases move to the entry point's own test as pure-function
      assertions; everything about rendering, interaction and chip state stays
      *(recommended — it follows the seam this epic creates, and `docs/testing.md`
      is explicit that a relocated assertion keeps its subject: a case about what
      the coaching *says* has always been a fact about the module, not the card)*
- [ ] B) Everything stays in `GuessCard.test.tsx`; the entry point gets new tests
      of its own and the total grows — nothing to argue about, and the hotspot
      stays a hotspot
- [ ] C) Move the coaching cases *and* split what remains by region, the way
      feature-14 split `GroovePuzzle.test.tsx` — the thorough version, and it
      widens an epic that is already the wave's longer half
- [ ] D) Decide once the move is done and the real size is known, and record it as
      a finding either way
